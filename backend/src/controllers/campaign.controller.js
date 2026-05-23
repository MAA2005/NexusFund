const prisma = require("../lib/prisma");

// Fields returned in list view — omit description to keep responses small
const CAMPAIGN_LIST_SELECT = {
    id:               true,
    title:            true,
    goal_amount:      true,
    deadline:         true,
    category:         true,
    image_url:        true,
    status:           true,
    contract_address: true,
    created_at:       true,
    creator: {
        select: { id: true, email: true, country: true },
    },
    _count: {
        select: { donations: true }, // gives donorCount without a separate query
    },
};

// Fields returned in detail view — includes full description and recent donations
const CAMPAIGN_DETAIL_SELECT = {
    ...CAMPAIGN_LIST_SELECT,
    description: true,
    donations: {
        orderBy: { created_at: "desc" },
        take:    10, // last 10 donors shown on campaign page
    },
};

// Valid campaign statuses — prevents injecting arbitrary strings into WHERE clause
const VALID_STATUSES = ["ACTIVE", "SUCCESSFUL", "FAILED", "WITHDRAWN"];

// ─── POST /api/campaigns ──────────────────────────────────────────────────────
async function createCampaign(req, res) {
    const { title, description, goal_amount, deadline, category, image_url, contract_address } = req.body;

    try {
        const campaign = await prisma.campaign.create({
            data: {
                title,
                description,
                goal_amount,
                deadline:         new Date(deadline),
                category,
                image_url:        image_url || null,
                contract_address: contract_address || null,
                creator_id:       req.user.id,
            },
            include: {
                creator: {
                    select: { id: true, email: true, country: true, wallet_address: true },
                },
            },
        });

        return res.status(201).json({ campaign });
    } catch (err) {
        // P2002: unique constraint — contract_address is already used by another campaign
        if (err.code === "P2002") {
            return res.status(409).json({ error: "A campaign with this contract address already exists." });
        }
        console.error("[createCampaign]", err);
        return res.status(500).json({ error: "Failed to create campaign." });
    }
}

// ─── GET /api/campaigns ───────────────────────────────────────────────────────
async function listCampaigns(req, res) {
    // Safely parse and clamp pagination params
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    const search   = req.query.search?.trim()    || "";
    const category = req.query.category?.trim()  || "";
    const status   = VALID_STATUSES.includes(req.query.status?.toUpperCase())
        ? req.query.status.toUpperCase()
        : "";

    const where = {
        ...(search   && {
            OR: [
                { title:       { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ],
        }),
        ...(category && { category }),
        ...(status   && { status }),
    };

    try {
        // Run count and data fetch in parallel — one round-trip instead of two
        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where,
                skip,
                take:    limit,
                orderBy: { created_at: "desc" },
                select:  CAMPAIGN_LIST_SELECT,
            }),
            prisma.campaign.count({ where }),
        ]);

        return res.json({
            campaigns,
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
        console.error("[listCampaigns]", err);
        return res.status(500).json({ error: "Failed to fetch campaigns." });
    }
}

// ─── GET /api/campaigns/:id ───────────────────────────────────────────────────
async function getCampaign(req, res) {
    try {
        const campaign = await prisma.campaign.findUnique({
            where:  { id: req.params.id },
            select: CAMPAIGN_DETAIL_SELECT,
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found." });
        }

        return res.json({ campaign });
    } catch (err) {
        console.error("[getCampaign]", err);
        return res.status(500).json({ error: "Failed to fetch campaign." });
    }
}

// ─── PUT /api/campaigns/:id ───────────────────────────────────────────────────
async function updateCampaign(req, res) {
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "No fields provided to update." });
    }

    try {
        const campaign = await prisma.campaign.findUnique({
            where: { id: req.params.id },
        });

        if (!campaign) {
            return res.status(404).json({ error: "Campaign not found." });
        }

        // Ownership check — only the creator can edit their campaign
        if (campaign.creator_id !== req.user.id) {
            return res.status(403).json({ error: "You do not have permission to edit this campaign." });
        }

        const updated = await prisma.campaign.update({
            where:  { id: req.params.id },
            data:   req.body,          // safe: updateCampaignSchema.strict() already blocked unknown fields
            select: CAMPAIGN_DETAIL_SELECT,
        });

        return res.json({ campaign: updated });
    } catch (err) {
        if (err.code === "P2002") {
            return res.status(409).json({ error: "A campaign with this contract address already exists." });
        }
        console.error("[updateCampaign]", err);
        return res.status(500).json({ error: "Failed to update campaign." });
    }
}

// ─── GET /api/campaigns/mine ─────────────────────────────────────────────────
// Returns only the authenticated user's own campaigns — no client-side filtering
// needed. Registered before /:id so Express doesn't treat "mine" as a campaign ID.
async function getMyCampaigns(req, res) {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const skip  = (page - 1) * limit;

    try {
        const [campaigns, total] = await Promise.all([
            prisma.campaign.findMany({
                where:   { creator_id: req.user.id },
                skip,
                take:    limit,
                orderBy: { created_at: "desc" },
                select:  CAMPAIGN_LIST_SELECT,
            }),
            prisma.campaign.count({ where: { creator_id: req.user.id } }),
        ]);

        return res.json({
            campaigns,
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
        console.error("[getMyCampaigns]", err);
        return res.status(500).json({ error: "Failed to fetch your campaigns." });
    }
}

module.exports = { createCampaign, listCampaigns, getCampaign, updateCampaign, getMyCampaigns };
