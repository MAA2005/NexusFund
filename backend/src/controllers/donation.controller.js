const prisma  = require("../lib/prisma");
const { sendDonationAlert } = require("../lib/mailer");

// ─── POST /api/donations ──────────────────────────────────────────────────────
// Records a donation that already happened on the blockchain.
// The blockchain is the source of financial truth — this is just a DB mirror
// for display purposes (donor list, total shown on campaign page).
//
// Production note: In a high-security deployment, this endpoint should verify
// the tx_hash on-chain before recording it (call the Polygon RPC, check the
// tx recipient and amount). We skip that here and rely on the unique tx_hash
// constraint to prevent the main abuse vector (double-recording the same tx).
async function recordDonation(req, res) {
    const { campaign_id, donor_wallet, amount_usdc, tx_hash } = req.body;

    try {
        // Verify the campaign exists and is still accepting donations
        const campaign = await prisma.campaign.findUnique({
            where:   { id: campaign_id },
            include: {
                creator: {
                    select: { email: true },
                },
            },
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

        // Check tx_hash uniqueness before attempting insert to give a clear error message.
        // The DB unique constraint is the actual guard — this check gives a better error message.
        const existing = await prisma.donation.findUnique({ where: { tx_hash } });
        if (existing) {
            return res.status(409).json({ error: "This transaction has already been recorded." });
        }

        const donation = await prisma.donation.create({
            data: {
                campaign_id,
                donor_wallet,
                amount_usdc,
                tx_hash,
            },
        });

        // ── Send email notification to campaign creator ────────────────────────
        // Run fire-and-forget: we respond 201 immediately and let the email send
        // in the background. Email failure must never fail the donation record.
        if (campaign.creator?.email) {
            prisma.donation
                .aggregate({
                    where: { campaign_id },
                    _sum:  { amount_usdc: true },
                })
                .then(({ _sum }) => {
                    const totalRaised = Number(_sum.amount_usdc ?? 0).toFixed(2);
                    sendDonationAlert({
                        creatorEmail:  campaign.creator.email,
                        donorWallet:   donor_wallet,
                        amountUsdc:    Number(amount_usdc).toFixed(2),
                        campaignTitle: campaign.title,
                        totalRaised,
                        campaignId:    campaign_id,
                    });
                })
                .catch((err) => console.error("[recordDonation] aggregate failed:", err.message));
        }

        return res.status(201).json({ donation });
    } catch (err) {
        // P2002: Prisma unique constraint — catches the race condition where two
        // identical requests arrive simultaneously and both pass the findUnique check above
        if (err.code === "P2002") {
            return res.status(409).json({ error: "This transaction has already been recorded." });
        }
        // P2003: Foreign key constraint — campaign_id doesn't exist in campaigns table
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
        // Confirm campaign exists before returning its donations
        const campaign = await prisma.campaign.findUnique({
            where:  { id: req.params.campaignId },
            select: { id: true },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found." });
        }

        const [donations, total] = await Promise.all([
            prisma.donation.findMany({
                where:   { campaign_id: req.params.campaignId },
                orderBy: { created_at: "desc" },
                skip,
                take:    limit,
            }),
            prisma.donation.count({
                where: { campaign_id: req.params.campaignId },
            }),
        ]);

        return res.json({
            donations,
            pagination: {
                total,
                page,
                limit,
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
// Returns all donations made by the authenticated user, identified by their
// wallet address. Includes campaign title so the dashboard can display it.
async function getMyDonations(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    try {
        const user = await prisma.user.findUnique({
            where:  { id: req.user.id },
            select: { wallet_address: true },
        });

        if (!user?.wallet_address) {
            return res.json({ donations: [], pagination: { total: 0, page, limit, totalPages: 0, hasNext: false, hasPrev: false } });
        }

        const [donations, total] = await Promise.all([
            prisma.donation.findMany({
                where:   { donor_wallet: { equals: user.wallet_address, mode: "insensitive" } },
                orderBy: { created_at: "desc" },
                skip,
                take:    limit,
                include: {
                    campaign: { select: { id: true, title: true } },
                },
            }),
            prisma.donation.count({
                where: { donor_wallet: { equals: user.wallet_address, mode: "insensitive" } },
            }),
        ]);

        return res.json({
            donations,
            pagination: {
                total,
                page,
                limit,
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
