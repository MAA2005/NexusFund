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
// FRONTEND_URL supports comma-separated origins so multiple Vercel preview URLs
// can be allowlisted without a wildcard.
// The origin function returns only the matching single origin — browsers reject
// responses where Access-Control-Allow-Origin contains more than one value.
const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // Allow requests with no Origin header (server-to-server, curl, mobile)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, origin);
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods:        ["GET", "POST", "PUT"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials:    true,
    })
);

// ─── Body parser ──────────────────────────────────────────────────────────────
// 10kb limit blocks large payload attacks. JSON campaigns have descriptions
// up to 5000 chars (~5kb) — 10kb gives room without opening a DoS vector.
app.use(express.json({ limit: "10kb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Global limiter: 100 requests per IP per 15-minute window
const globalLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            100,
    message:        { error: "Too many requests. Please slow down and try again later." },
    standardHeaders: true,  // Sends RateLimit-* headers so clients can self-throttle
    legacyHeaders:  false,
});

// Strict limiter for auth endpoints: 10 attempts per 15 minutes
// This limits password-guessing attacks without locking out real users
const authLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            10,
    message:        { error: "Too many authentication attempts. Please wait 15 minutes before trying again." },
    standardHeaders: true,
    legacyHeaders:  false,
});

app.use(globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",      authLimiter, authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/wallet",    walletRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
// Used by deployment platforms (Render, Railway, etc.) to verify the server is alive
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Express recognises this as an error handler because it has 4 parameters (err first)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    // Log full error server-side — never send stack traces to the client
    console.error("[Error]", err);

    const statusCode = err.status || err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production"
            ? "Internal server error"   // hide implementation details in prod
            : err.message;             // show details in development

    res.status(statusCode).json({ error: message });
});

module.exports = app;
