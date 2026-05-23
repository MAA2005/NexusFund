require("dotenv").config();

const app    = require("./app");
const prisma = require("./lib/prisma");
const { startRetryJob } = require("./jobs/retryPending");

const PORT = parseInt(process.env.PORT || "5000", 10);

async function start() {
    try {
        await prisma.$connect();
        console.log("✓ Database connected");
    } catch (err) {
        console.error("✗ Database connection failed:", err.message);
        console.error(
            "\nCheck these things:\n" +
            "  1. PostgreSQL is running\n" +
            "  2. DATABASE_URL in .env is correct\n" +
            "  3. The database exists\n"
        );
        process.exit(1);
    }

    // Start the background job that retries PENDING blockchain transactions
    startRetryJob();
    console.log("✓ Retry job started (runs every 5 minutes)");

    const server = app.listen(PORT, () => {
        console.log(`✓ NexusFund API running → http://localhost:${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(`  Health check: http://localhost:${PORT}/health`);
    });

    async function shutdown(signal) {
        console.log(`\n[${signal}] Shutting down gracefully…`);
        server.close(async () => {
            await prisma.$disconnect();
            console.log("✓ Database disconnected. Server stopped.");
            process.exit(0);
        });
        setTimeout(() => { console.error("Forced exit after 10s."); process.exit(1); }, 10_000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
}

start();
