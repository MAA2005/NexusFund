const { z } = require("zod");

const CAMPAIGN_CATEGORIES = [
    "medical", "education", "disaster", "community", "business", "creative", "other",
];

const createCampaignSchema = z.object({
    title: z
        .string({ required_error: "Title is required" })
        .min(3,   "Title must be at least 3 characters")
        .max(200, "Title cannot exceed 200 characters")
        .trim(),

    description: z
        .string({ required_error: "Description is required" })
        .min(20,   "Description must be at least 20 characters")
        .max(5000, "Description cannot exceed 5000 characters")
        .trim(),

    goal_amount: z
        .number({ required_error: "Goal amount is required", invalid_type_error: "Goal must be a number" })
        .positive("Goal must be a positive number")
        .max(10_000_000, "Goal cannot exceed 10,000,000"),

    deadline: z
        .string({ required_error: "Deadline is required" })
        .datetime({ message: "Deadline must be a valid ISO 8601 date" })
        .refine(
            (val) => new Date(val) > new Date(),
            { message: "Deadline must be in the future" }
        ),

    category: z.enum(CAMPAIGN_CATEGORIES, {
        errorMap: () => ({ message: `Category must be one of: ${CAMPAIGN_CATEGORIES.join(", ")}` }),
    }),

    image_url: z
        .string()
        .url("image_url must be a valid URL")
        .optional()
        .nullable(),
});

// .strict() rejects unknown fields — prevents mass-assignment (e.g. sending status: "WITHDRAWN")
const updateCampaignSchema = z
    .object({
        title:       z.string().min(3).max(200).trim().optional(),
        description: z.string().min(20).max(5000).trim().optional(),
        image_url:   z.string().url().optional().nullable(),
    })
    .strict();

module.exports = { createCampaignSchema, updateCampaignSchema };
