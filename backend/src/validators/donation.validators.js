const { z } = require("zod");

// The client only sends campaign_id and the dollar amount.
// The backend owns all blockchain logic — no wallet address or tx hash from the client.
const recordDonationSchema = z.object({
    campaign_id: z
        .string({ required_error: "campaign_id is required" })
        .cuid("campaign_id must be a valid CUID"),

    amount_usd: z
        .number({ required_error: "amount_usd is required", invalid_type_error: "amount_usd must be a number" })
        .positive("Donation amount must be positive")
        .max(1_000_000, "Donation amount exceeds maximum"),
});

module.exports = { recordDonationSchema };
