const { PrismaClient } = require("@prisma/client");

// Singleton pattern — critical when using nodemon in development.
// Without this, each file-save triggers a hot-reload that creates a new
// PrismaClient instance. Each instance opens its own connection pool.
// PostgreSQL's default max_connections is 100. You would hit it in minutes.
// By storing the instance on globalThis, hot-reloads reuse the same client.

const globalForPrisma = globalThis;

const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log:
            process.env.NODE_ENV === "development"
                ? ["warn", "error"] // "query" level floods the console — enable manually if debugging
                : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

module.exports = prisma;
