const express = require("express");

const {
    createCampaign, listCampaigns, getCampaign,
    updateCampaign, getMyCampaigns, withdrawCampaign,
} = require("../controllers/campaign.controller");
const { requireAuth } = require("../middleware/auth.middleware");
const { validate }    = require("../middleware/validate.middleware");
const { createCampaignSchema, updateCampaignSchema } = require("../validators/campaign.validators");

const router = express.Router();

// GET  /api/campaigns       — public list with pagination, search, category filter
router.get("/",       listCampaigns);

// POST /api/campaigns       — create campaign (logged in required)
router.post("/",      requireAuth, validate(createCampaignSchema), createCampaign);

// GET  /api/campaigns/mine  — authenticated user's own campaigns
// MUST be before /:id so Express does not treat "mine" as a campaign ID
router.get("/mine",   requireAuth, getMyCampaigns);

// GET  /api/campaigns/:id   — public single campaign detail
router.get("/:id",    getCampaign);

// PUT  /api/campaigns/:id   — update own campaign
router.put("/:id",    requireAuth, validate(updateCampaignSchema), updateCampaign);

// POST /api/campaigns/:id/withdraw — creator initiates fund withdrawal
router.post("/:id/withdraw", requireAuth, withdrawCampaign);

module.exports = router;
