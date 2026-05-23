const { z } = require("zod");

const recordDonationSchema = z.object({
    campaign_id: z
        .string({ required_error: "campaign_id is required" })
        .cuid("campaign_id must be a valid CUID"),

    donor_wallet: z
        .string({ required_error: "donor_wallet is required" })
        .regex(
            /^0x[a-fA-F0-9]{40}$/,
            "donor_wallet must be a valid Ethereum address (0x + 40 hex chars)"
        ),

    amount_usdc: z
        .number({ required_error: "amount_usdc is required", invalid_type_error: "amount_usdc must be a number" })
        .positive("Donation amount must be positive")
        .max(10_000_000, "Donation amount exceeds maximum"),

    // A blockchain transaction hash is always exactly 0x followed by 64 hex chars (32 bytes).
    // Validating the format prevents recording nonsense values that could never be verified on-chain.
    tx_hash: z
        .string({ required_error: "tx_hash is required" })
        .regex(
            /^0x[a-fA-F0-9]{64}$/,
            "tx_hash must be a valid transaction hash (0x + 64 hex characters)"
        ),
});

module.exports = { recordDonationSchema };
