const express = require("express");

const { recordDonation, getCampaignDonations, getMyDonations } = require("../controllers/donation.controller");
const { validate }             = require("../middleware/validate.middleware");
const { requireAuth }          = require("../middleware/auth.middleware");
const { recordDonationSchema } = require("../validators/donation.validators");

const router = express.Router();

// POST /api/donations              — record a completed on-chain donation by tx hash
router.post("/",           validate(recordDonationSchema), recordDonation);

// GET  /api/donations/mine         — list donations made by the authenticated user
// IMPORTANT: this route must be registered before /:campaignId so Express does not
// treat the literal string "mine" as a campaign ID.
router.get("/mine",        requireAuth, getMyDonations);

// GET  /api/donations/:campaignId  — list all donations for a campaign (paginated)
router.get("/:campaignId", getCampaignDonations);

module.exports = router;
