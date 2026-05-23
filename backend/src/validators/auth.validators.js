const { z } = require("zod");

const registerSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .email("Invalid email address")
        .toLowerCase() // normalise before DB insert — prevents duplicate accounts with different casing
        .trim(),

    password: z
        .string({ required_error: "Password is required" })
        .min(8,  "Password must be at least 8 characters")
        .regex(/[a-zA-Z]/, "Password must contain at least one letter")
        .regex(/[0-9]/,    "Password must contain at least one number"),

    country: z
        .string({ required_error: "Country is required" })
        .min(2,   "Country must be at least 2 characters")
        .max(100, "Country name is too long")
        .trim(),

    // Wallet address is optional at registration — users without MetaMask can still sign up.
    // Phase 2 introduces custodial wallets for them.
    wallet_address: z
        .string()
        .regex(
            /^0x[a-fA-F0-9]{40}$/,
            "Wallet address must be a valid Ethereum address (0x followed by 40 hex characters)"
        )
        .optional()
        .nullable(),
});

const loginSchema = z.object({
    email: z
        .string({ required_error: "Email is required" })
        .email("Invalid email address")
        .toLowerCase()
        .trim(),

    password: z
        .string({ required_error: "Password is required" })
        .min(1, "Password is required"),
});

module.exports = { registerSchema, loginSchema };
