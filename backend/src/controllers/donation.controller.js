const prisma         = require("../lib/prisma");
const platformWallet = require("../services/platformWallet");
const { sendDonationAlert } = require("../lib/mailer");

// ─── POST /api/donations ──────────────────────────────────────────────────────
// Client sends { campaign_id, amount_usd }.
// We record the donation immediately (PENDING), respond to the user,
// then process the on-chain USDC transfer in the background.
// 1 USD = 1 USDC (stablecoin peg).
async function recordDonation(req, res) {
    const { campaign_id, amount_usd } = req.body;
    const amount_usdc = amount_usd; // USDC is dollar-pegged

    try {
        const campaign = await prisma.campaign.findUnique({
            where:   { id: campaign_id },
            include: { creator: { select: { email: true } } },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found." });
        }
        if (campaign.status !== "ACTIVE") {
            return res.status(400).json({
                error: `This campaign is ${campaign.status.toLowerCase()} and no longer accepts donations.`,
            });
        }
        if (new Date() > campaign.deadline) {
            return res.status(400).json({ error: "This campaign's deadline has passed." });
        }

        const donation = await prisma.donation.create({
            data: {
                campaign_id,
                user_id:   req.user.id,
                amount_usd,
                amount_usdc,
                tx_status: "PENDING",
            },
        });

        // Respond immediately — never make the user wait for blockchain
        res.status(201).json({
            donation: {
                id:         donation.id,
                amount_usd: donation.amount_usd,
                tx_status:  donation.tx_status,
                created_at: donation.created_at,
                message:    `Thank you! Your donation of $${amount_usd.toFixed(2)} has been received.`,
            },
        });

        // Background: send USDC via the platform wallet
        if (platformWallet.isConfigured() && campaign.contract_address) {
            (async () => {
                try {
                    const { txHash } = await platformWallet.donate({
                        campaignAddress: campaign.contract_address,
                        amountUsdc:      amount_usdc,
                    });
                    await prisma.donation.update({
                        where: { id: donation.id },
                        data: {
                            tx_hash:     txHash,
                            tx_status:   "CONFIRMED",
                            donor_wallet: process.env.PLATFORM_WALLET_ADDRESS || null,
                        },
                    });
                    console.log(`[recordDonation] ${donation.id} confirmed → ${txHash}`);

                    if (campaign.creator?.email) {
                        prisma.donation
                            .aggregate({
                                where: { campaign_id, tx_status: "CONFIRMED" },
                                _sum:  { amount_usdc: true },
                            })
                            .then(({ _sum }) => {
                                sendDonationAlert({
                                    creatorEmail:  campaign.creator.email,
                                    amountUsd:     amount_usd.toFixed(2),
                                    campaignTitle: campaign.title,
                                    totalRaised:   Number(_sum.amount_usdc ?? 0).toFixed(2),
                                    campaignId:    campaign_id,
                                });
                            })
                            .catch((e) => console.error("[recordDonation] aggregate error:", e.message));
                    }
                } catch (err) {
                    console.error(`[recordDonation] blockchain failed for ${donation.id}:`, err.message);
                    // Stays PENDING — retry job will attempt again in 5 minutes
                }
            })();
        } else if (!campaign.contract_address) {
            console.warn(`[recordDonation] Campaign ${campaign_id} not yet deployed — donation stays PENDING`);
        }
    } catch (err) {
        if (err.code === "P2003") {
            return res.status(404).json({ error: "Campaign not found." });
        }
        console.error("[recordDonation]", err);
        return res.status(500).json({ error: "Failed to record donation." });
    }
}

// ─── GET /api/donations/:campaignId ───────────────────────────────────────────
async function getCampaignDonations(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    try {
        const campaign = await prisma.campaign.findUnique({
            where:  { id: req.params.campaignId },
            select: { id: true },
        });
        if (!campaign) return res.status(404).json({ error: "Campaign not found." });

        const [donations, total] = await Promise.all([
            prisma.donation.findMany({
                where:   { campaign_id: req.params.campaignId, tx_status: "CONFIRMED" },
                orderBy: { created_at: "desc" },
                skip, take: limit,
                select: { id: true, amount_usd: true, amount_usdc: true, created_at: true },
            }),
            prisma.donation.count({
                where: { campaign_id: req.params.campaignId, tx_status: "CONFIRMED" },
            }),
        ]);

        return res.json({
            donations,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1,
            },
        });
    } catch (err) {
        console.error("[getCampaignDonations]", err);
        return res.status(500).json({ error: "Failed to fetch donations." });
    }
}

// ─── GET /api/donations/mine ──────────────────────────────────────────────────
// Returns donations for the authenticated user, identified by user_id.
async function getMyDonations(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    try {
        const [donations, total] = await Promise.all([
            prisma.donation.findMany({
                where:   { user_id: req.user.id },
                orderBy: { created_at: "desc" },
                skip, take: limit,
                include: { campaign: { select: { id: true, title: true } } },
            }),
            prisma.donation.count({ where: { user_id: req.user.id } }),
        ]);

        return res.json({
            donations,
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1,
            },
        });
    } catch (err) {
        console.error("[getMyDonations]", err);
        return res.status(500).json({ error: "Failed to fetch donations." });
    }
}

module.exports = { recordDonation, getCampaignDonations, getMyDonations };
