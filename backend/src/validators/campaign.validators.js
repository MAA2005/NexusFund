const { z } = require("zod");

// These categories must match what the frontend filter renders in Step 1.4
const CAMPAIGN_CATEGORIES = [
    "medical",
    "education",
    "disaster",
    "community",
    "business",
    "creative",
    "other",
];

const createCampaignSchema = z.object({
    title: z
        .string({ required_error: "Title is required" })
        .min(3,   "Title must be at least 3 characters")
        .max(200, "Title cannot exceed 200 characters — this limit also applies on the smart contract")
        .trim(),

    description: z
        .string({ required_error: "Description is required" })
        .min(20,   "Description must be at least 20 characters")
        .max(5000, "Description cannot exceed 5000 characters")
        .trim(),

    goal_amount: z
        .number({ required_error: "Goal amount is required", invalid_type_error: "Goal must be a number" })
        .positive("Goal must be a positive number")
        .max(10_000_000, "Goal cannot exceed 10,000,000 USDC"),

    deadline: z
        .string({ required_error: "Deadline is required" })
        .datetime({ message: "Deadline must be a valid ISO 8601 date (e.g. 2026-12-31T23:59:59Z)" })
        .refine(
            (val) => new Date(val) > new Date(),
            { message: "Deadline must be in the future" }
        ),

    category: z.enum(CAMPAIGN_CATEGORIES, {
        errorMap: () => ({
            message: `Category must be one of: ${CAMPAIGN_CATEGORIES.join(", ")}`,
        }),
    }),

    image_url: z
        .string()
        .url("image_url must be a valid URL")
        .optional()
        .nullable(),

    // Filled in by the frontend after deploying the campaign contract on-chain
    contract_address: z
        .string()
        .regex(
            /^0x[a-fA-F0-9]{40}$/,
            "contract_address must be a valid Ethereum address"
        )
        .optional()
        .nullable(),
});

// .strict() is critical here — it rejects any field not listed.
// Without it, a client could send { "creator_id": "...", "status": "WITHDRAWN" }
// and Prisma would happily write those fields (mass-assignment vulnerability).
const updateCampaignSchema = z
    .object({
        title: z
            .string()
            .min(3)
            .max(200)
            .trim()
            .optional(),

        description: z
            .string()
            .min(20)
            .max(5000)
            .trim()
            .optional(),

        image_url: z
            .string()
            .url("image_url must be a valid URL")
            .optional()
            .nullable(),

        contract_address: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/, "contract_address must be a valid Ethereum address")
            .optional()
            .nullable(),
    })
    .strict(); // reject any key not in the list above

module.exports = { createCampaignSchema, updateCampaignSchema };
