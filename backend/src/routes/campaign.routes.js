const express = require("express");

const { createCampaign, listCampaigns, getCampaign, updateCampaign, getMyCampaigns } = require("../controllers/campaign.controller");
const { requireAuth }             = require("../middleware/auth.middleware");
const { validate }                = require("../middleware/validate.middleware");
const { createCampaignSchema, updateCampaignSchema } = require("../validators/campaign.validators");

const router = express.Router();

// GET  /api/campaigns         — public list with pagination, search, category filter
router.get("/",      listCampaigns);

// POST /api/campaigns         — create a campaign (must be logged in)
router.post("/",     requireAuth, validate(createCampaignSchema), createCampaign);

// GET  /api/campaigns/mine    — authenticated user's own campaigns
// IMPORTANT: must be before /:id so Express does not treat "mine" as a campaign ID.
router.get("/mine",  requireAuth, getMyCampaigns);

// GET  /api/campaigns/:id     — public single campaign with recent donations
router.get("/:id",   getCampaign);

// PUT  /api/campaigns/:id     — update own campaign (must be logged in + owner)
router.put("/:id",   requireAuth, validate(updateCampaignSchema), updateCampaign);

module.exports = router;
