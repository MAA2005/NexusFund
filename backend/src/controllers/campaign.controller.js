const prisma         = require("../lib/prisma");
const platformWallet = require("../services/platformWallet");
const { sendWithdrawalConfirmation } = require("../lib/mailer");

function serializeCampaign(c) {
    if (!c) return c;
    return { ...c, goal_amount: c.goal_amount?.toString() ?? "0" };
}

const CAMPAIGN_LIST_SELECT = {
    id:               true,
    title:            true,
    goal_amount:      true,
    deadline:         true,
    category:         true,
    image_url:        true,
    status:           true,
    deployment_status: true,
    contract_address: true,
    created_at:       true,
    creator: { select: { id: true, email: true, country: true } },
    _count:  { select: { donations: true } },
};

const CAMPAIGN_DETAIL_SELECT = {
    ...CAMPAIGN_LIST_SELECT,
    description: true,
    donations: {
        where:   { tx_status: "CONFIRMED" },
        orderBy: { created_at: "desc" },
        take:    10,
        select:  { id: true, amount_usd: true, amount_usdc: true, created_at: true },
    },
};

const VALID_STATUSES = ["ACTIVE", "SUCCESSFUL", "FAILED", "WITHDRAWN"];

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
async function createCampaign(req, res) {
    const { title, description, goal_amount, deadline, category, image_url } = req.body;

    try {
        const campaign = await prisma.campaign.create({
            data: {
                title,
                description,
                goal_amount,
                deadline:         new Date(deadline),
                category,
                image_url:        image_url || null,
                creator_id:       req.user.id,
                deployment_status: "PENDING",
            },
            include: {
                creator: { select: { id: true, email: true, country: true } },
            },
        });

        // Return immediately — user never waits for blockchain
        res.status(201).json({ campaign: serializeCampaign(campaign) });

        // Background: deploy the smart contract
        if (platformWallet.isConfigured()) {
            (async () => {
                try {
                    const { contractAddress, txHash } = await platformWallet.deployContract({
                        title,
                        goalAmount: Number(goal_amount),
                        deadline,
                    });
                    await prisma.campaign.update({
                        where: { id: campaign.id },
                        data: {
                            contract_address:  contractAddress,
                            contract_tx_hash:  txHash,
                            deployment_status: "DEPLOYED",
                        },
                    });
                    console.log(`[createCampaign] ${campaign.id} deployed → ${contractAddress}`);
                } catch (err) {
                    console.error(`[createCampaign] deploy failed for ${campaign.id}:`, err.message);
                    // Stays PENDING — retry job picks it up every 5 minutes
                }
            })();
        } else {
            console.warn("[createCampaign] Platform wallet not configured — campaign stays PENDING until configured");
        }
    } catch (err) {
        console.error("[createCampaign]", err);
        return res.status(500).json({ error: "Failed to create campaign." });
    }
}

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
async function listCampaigns(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    const search   = req.query.search?.trim()   || "";
    const category = req.query.category?.trim() || "";
    const status   = VALID_STATUSES.includes(req.query.status?.toUpperCase())
        ? req.query.status.toUpperCase() : "";

    const where = {
        ...(search   && { OR: [
            { title:       { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ]}),
        ...(category && { category }),
        ...(status   && { status }),
    };

    try {
        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where, skip, take: limit,
                orderBy: { created_at: "desc" },
                select:  CAMPAIGN_LIST_SELECT,
            }),
            prisma.campaign.count({ where }),
        ]);

        return res.json({
            campaigns: campaigns.map(serializeCampaign),
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1,
            },
        });
    } catch (err) {
        console.error("[listCampaigns]", err.message, err.stack);
        return res.status(500).json({ error: "Failed to fetch campaigns." });
    }
}

// ─── GET /api/campaigns/:id ───────────────────────────────────────────────────
async function getCampaign(req, res) {
    try {
        const [campaign, raisedAgg, existingWithdrawal] = await Promise.all([
            prisma.campaign.findUnique({
                where:  { id: req.params.id },
                select: CAMPAIGN_DETAIL_SELECT,
            }),
            prisma.donation.aggregate({
                where: { campaign_id: req.params.id, tx_status: "CONFIRMED" },
                _sum:  { amount_usdc: true, amount_usd: true },
            }),
            prisma.withdrawal.findFirst({
                where:  { campaign_id: req.params.id },
                select: { id: true, tx_status: true, tx_hash: true, net_amount: true },
            }),
        ]);

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found." });
        }

        const total_raised_usdc = Number(raisedAgg._sum.amount_usdc ?? 0);
        const total_raised_usd  = Number(raisedAgg._sum.amount_usd  ?? 0);

        return res.json({
            campaign: {
                ...serializeCampaign(campaign),
                total_raised_usdc: total_raised_usdc.toFixed(6),
                total_raised_usd:  total_raised_usd.toFixed(2),
                withdrawal:        existingWithdrawal
                    ? {
                        ...existingWithdrawal,
                        net_amount: existingWithdrawal.net_amount?.toString(),
                    }
                    : null,
            },
        });
    } catch (err) {
        console.error("[getCampaign]", err.message, err.stack);
        return res.status(500).json({ error: "Failed to fetch campaign." });
    }
}

// ─── PUT /api/campaigns/:id ───────────────────────────────────────────────────
async function updateCampaign(req, res) {
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "No fields provided to update." });
    }

    try {
        const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
        if (!campaign) return res.status(404).json({ error: "Campaign not found." });
        if (campaign.creator_id !== req.user.id) {
            return res.status(403).json({ error: "You do not have permission to edit this campaign." });
        }

        const updated = await prisma.campaign.update({
            where:  { id: req.params.id },
            data:   req.body,
            select: CAMPAIGN_DETAIL_SELECT,
        });

        return res.json({ campaign: serializeCampaign(updated) });
    } catch (err) {
        console.error("[updateCampaign]", err.message, err.stack);
        return res.status(500).json({ error: "Failed to update campaign." });
    }
}

// ─── GET /api/campaigns/mine ──────────────────────────────────────────────────
async function getMyCampaigns(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const skip  = (page - 1) * limit;

    try {
        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where:   { creator_id: req.user.id },
                skip, take: limit,
                orderBy: { created_at: "desc" },
                select:  CAMPAIGN_LIST_SELECT,
            }),
            prisma.campaign.count({ where: { creator_id: req.user.id } }),
        ]);

        return res.json({
            campaigns: campaigns.map(serializeCampaign),
            pagination: {
                total, page, limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1,
            },
        });
    } catch (err) {
        console.error("[getMyCampaigns]", err.message, err.stack);
        return res.status(500).json({ error: "Failed to fetch your campaigns." });
    }
}

// ─── POST /api/campaigns/:id/withdraw ────────────────────────────────────────
async function withdrawCampaign(req, res) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where:   { id: req.params.id },
            include: { creator: { select: { id: true, email: true } } },
        });

        if (!campaign) return res.status(404).json({ error: "Campaign not found." });
        if (campaign.creator_id !== req.user.id) {
            return res.status(403).json({ error: "Only the campaign creator can withdraw funds." });
        }
        if (new Date() < campaign.deadline) {
            return res.status(400).json({ error: "Campaign deadline has not passed yet." });
        }

        const existingWithdrawal = await prisma.withdrawal.findFirst({
            where: { campaign_id: campaign.id },
        });
        if (existingWithdrawal) {
            return res.status(409).json({ error: "A withdrawal has already been initiated for this campaign." });
        }

        // Total raised from confirmed on-chain donations
        const raisedAgg = await prisma.donation.aggregate({
            where: { campaign_id: campaign.id, tx_status: "CONFIRMED" },
            _sum:  { amount_usdc: true },
        });
        const totalUsdc = Number(raisedAgg._sum.amount_usdc ?? 0);

        if (totalUsdc < Number(campaign.goal_amount)) {
            return res.status(400).json({ error: "Campaign has not reached its funding goal." });
        }

        const platformFee = totalUsdc * 0.025;
        const netAmount   = totalUsdc - platformFee;

        const withdrawal = await prisma.withdrawal.create({
            data: {
                campaign_id:  campaign.id,
                user_id:      req.user.id,
                amount_usdc:  totalUsdc,
                platform_fee: platformFee,
                net_amount:   netAmount,
                tx_status:    "PENDING",
            },
        });

        // Return success immediately
        res.json({
            withdrawal: {
                id:           withdrawal.id,
                amount_usdc:  totalUsdc.toFixed(2),
                platform_fee: platformFee.toFixed(2),
                net_amount:   netAmount.toFixed(2),
                tx_status:    "PENDING",
                message:      "Withdrawal initiated. Funds will be processed within 24 hours.",
            },
        });

        // Background: execute on-chain withdrawal
        if (platformWallet.isConfigured() && campaign.contract_address) {
            (async () => {
                try {
                    const { txHash } = await platformWallet.withdraw({
                        campaignAddress: campaign.contract_address,
                    });
                    await prisma.$transaction([
                        prisma.withdrawal.update({
                            where: { id: withdrawal.id },
                            data:  { tx_hash: txHash, tx_status: "CONFIRMED" },
                        }),
                        prisma.campaign.update({
                            where: { id: campaign.id },
                            data:  { status: "WITHDRAWN" },
                        }),
                    ]);
                    console.log(`[withdrawCampaign] ${campaign.id} withdrawn → ${txHash}`);

                    if (campaign.creator?.email) {
                        sendWithdrawalConfirmation({
                            creatorEmail:  campaign.creator.email,
                            campaignTitle: campaign.title,
                            netAmount:     netAmount.toFixed(2),
                            txHash,
                            campaignId:    campaign.id,
                        });
                    }
                } catch (err) {
                    console.error(`[withdrawCampaign] on-chain failed for ${campaign.id}:`, err.message);
                }
            })();
        }
    } catch (err) {
        console.error("[withdrawCampaign]", err.message);
        return res.status(500).json({ error: "Failed to initiate withdrawal." });
    }
}

module.exports = {
    createCampaign, listCampaigns, getCampaign,
    updateCampaign, getMyCampaigns, withdrawCampaign,
};
