const prisma            = require("../lib/prisma");
const { getUsdcBalance } = require("../lib/wallet");

// ─── GET /api/wallet/balance ──────────────────────────────────────────────────
// Returns the authenticated user's wallet address and USDC balance.
// The private key is never read here — balance checks only need the public address.
async function balance(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where:  { id: req.user.id },
            select: { wallet_address: true },
        });

        if (!user || !user.wallet_address) {
            return res.status(404).json({ error: "No wallet found for this account." });
        }

        const usdc_balance = await getUsdcBalance(user.wallet_address);

        return res.json({
            wallet_address: user.wallet_address,
            usdc_balance,
        });
    } catch (err) {
        console.error("[wallet/balance]", err);
        return res.status(500).json({ error: "Failed to fetch wallet balance." });
    }
}

module.exports = { balance };
