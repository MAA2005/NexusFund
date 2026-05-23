const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { generateCustodialWallet } = require("../lib/wallet");

// 12 rounds: ~300ms per hash on modern hardware.
// This is the sweet spot — slow enough to resist brute-force, fast enough for UX.
// Never go below 10. Never go above 14 for a web API (would time out under load).
const SALT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────────────────────────
async function register(req, res) {
    const { email, password, country, wallet_address } = req.body;

    try {
        // Check for duplicate email
        const existingEmail = await prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        // Check for duplicate wallet address (only if one was provided)
        if (wallet_address) {
            const existingWallet = await prisma.user.findUnique({ where: { wallet_address } });
            if (existingWallet) {
                return res.status(409).json({ error: "This wallet address is already registered to another account." });
            }
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // If the user brought their own MetaMask wallet, use it.
        // Otherwise generate a custodial wallet for them — they never see the private key.
        let resolvedWalletAddress        = wallet_address || null;
        let resolvedEncryptedPrivateKey  = null;

        if (!wallet_address) {
            const custodial = generateCustodialWallet();
            resolvedWalletAddress       = custodial.address;
            resolvedEncryptedPrivateKey = custodial.encryptedPrivateKey;
        }

        const user = await prisma.user.create({
            data: {
                email,
                password_hash,
                country,
                wallet_address:        resolvedWalletAddress,
                encrypted_private_key: resolvedEncryptedPrivateKey,
            },
            // Never return password_hash or encrypted_private_key to the client
            select: {
                id:             true,
                email:          true,
                country:        true,
                wallet_address: true,
                created_at:     true,
            },
        });

        const token = signToken(user.id, user.email);

        return res.status(201).json({ user, token });
    } catch (err) {
        console.error("[register]", err);
        return res.status(500).json({ error: "Failed to create account. Please try again." });
    }
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
async function login(req, res) {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        // IMPORTANT: We use the SAME error message whether the email doesn't exist
        // or the password is wrong. Different messages would allow an attacker to
        // enumerate which emails are registered in our system.
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = signToken(user.id, user.email);

        return res.json({
            user: {
                id:             user.id,
                email:          user.email,
                country:        user.country,
                wallet_address: user.wallet_address,
                created_at:     user.created_at,
            },
            token,
        });
    } catch (err) {
        console.error("[login]", err);
        return res.status(500).json({ error: "Login failed. Please try again." });
    }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
async function me(req, res) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id:             true,
                email:          true,
                country:        true,
                wallet_address: true,
                created_at:     true,
            },
        });

        // This can happen if the user's account was deleted after they logged in
        if (!user) {
            return res.status(404).json({ error: "User account no longer exists." });
        }

        return res.json({ user });
    } catch (err) {
        console.error("[me]", err);
        return res.status(500).json({ error: "Failed to fetch user data." });
    }
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function signToken(userId, email) {
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
}

module.exports = { register, login, me };
