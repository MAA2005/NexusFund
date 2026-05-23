const express         = require("express");
const { balance }     = require("../controllers/wallet.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// GET /api/wallet/balance — returns wallet address + USDC balance for the logged-in user
router.get("/balance", requireAuth, balance);

module.exports = router;
