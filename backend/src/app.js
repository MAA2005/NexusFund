require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const authRoutes     = require("./routes/auth.routes");
const campaignRoutes = require("./routes/campaign.routes");
const donationRoutes = require("./routes/donation.routes");
const walletRoutes   = require("./routes/wallet.routes");

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // Allow requests with no Origin header (server-to-server, curl, mobile)
            if (!origin) return callback(null, true);

            // Allow exact matches from FRONTEND_URL env var
            if (allowedOrigins.includes(origin)) return callback(null, origin);

            // Allow all Vercel preview deployments for this project
            if (/^https:\/\/nexus-fund-.*\.vercel\.app$/.test(origin))
                return callback(null, origin);

            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods:        ["GET", "POST", "PUT"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials:    true,
    })
);

// ─── Trust proxy (Railway sits behind a proxy) ────────────────────────────────
app.set("trust proxy", 1);

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             100,
    message:         { error: "Too many requests. Please slow down and try again later." },
    standardHeaders: true,
    legacyHeaders:   false,
});

const authLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             10,
    message:         { error: "Too many authentication attempts. Please wait 15 minutes before trying again." },
    standardHeaders: true,
    legacyHeaders:   false,
});

app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",      authLimiter, authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/wallet",    walletRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("[Error]", err);
    const statusCode = err.status || err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message;
    res.status(statusCode).json({ error: message });
});

module.exports = app;