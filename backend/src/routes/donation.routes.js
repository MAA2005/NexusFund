const express = require("express");

const { recordDonation, getCampaignDonations, getMyDonations } = require("../controllers/donation.controller");
const { validate }    = require("../middleware/validate.middleware");
const { requireAuth } = require("../middleware/auth.middleware");
const { recordDonationSchema } = require("../validators/donation.validators");

const router = express.Router();

// POST /api/donations              — donate to a campaign (must be logged in)
router.post("/",           requireAuth, validate(recordDonationSchema), recordDonation);

// GET  /api/donations/mine         — donations made by the authenticated user
// MUST be before /:campaignId so Express does not treat "mine" as a campaign ID
router.get("/mine",        requireAuth, getMyDonations);

// GET  /api/donations/:campaignId  — all confirmed donations for a campaign (public)
router.get("/:campaignId", getCampaignDonations);

module.exports = router;
