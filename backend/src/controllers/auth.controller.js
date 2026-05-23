const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// 12 rounds ≈ 300ms per hash — slow enough to resist brute-force, fast enough for UX
const SALT_ROUNDS = 12;

// ─── POST /api/auth/register ──────────────────────────────────────────────────
async function register(req, res) {
    const { email, password, country } = req.body;

    try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        const user = await prisma.user.create({
            data: { email, password_hash, country },
            select: { id: true, email: true, country: true, created_at: true },
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

        // Same error for "email not found" and "wrong password" — prevents email enumeration
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = signToken(user.id, user.email);
        return res.json({
            user: { id: user.id, email: user.email, country: user.country, created_at: user.created_at },
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
            where:  { id: req.user.id },
            select: { id: true, email: true, country: true, created_at: true },
        });

        if (!user) {
            return res.status(404).json({ error: "User account no longer exists." });
        }

        return res.json({ user });
    } catch (err) {
        console.error("[me]", err);
        return res.status(500).json({ error: "Failed to fetch user data." });
    }
}

function signToken(userId, email) {
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
}

module.exports = { register, login, me };
