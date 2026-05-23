require("dotenv").config();

const app    = require("./app");
const prisma = require("./lib/prisma");

const PORT = parseInt(process.env.PORT || "5000", 10);

async function start() {
    // Verify database connectivity before accepting any HTTP traffic.
    // If the DB is down, fail immediately with a clear message — not silently.
    try {
        await prisma.$connect();
        console.log("✓ Database connected");
    } catch (err) {
        console.error("✗ Database connection failed:", err.message);
        console.error(
            "\nCheck these things:\n" +
            "  1. PostgreSQL is installed and running\n" +
            "  2. DATABASE_URL in backend/.env is correct\n" +
            "  3. The database 'nexusfund' exists (create with: createdb nexusfund)\n"
        );
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log(`✓ NexusFund API running → http://localhost:${PORT}`);
        console.log(`  Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(`  Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown — close HTTP connections, then DB, then exit.
    // Without this, Ctrl+C would kill the process mid-request and leave
    // open DB transactions. SIGTERM is sent by deployment platforms on restart.
    async function shutdown(signal) {
        console.log(`\n[${signal}] Shutting down gracefully...`);

        server.close(async () => {
            await prisma.$disconnect();
            console.log("✓ Database disconnected. Server stopped.");
            process.exit(0);
        });

        // Force-exit after 10 seconds if graceful shutdown hangs
        setTimeout(() => {
            console.error("Forced exit after 10s timeout.");
            process.exit(1);
        }, 10_000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
}

start();
