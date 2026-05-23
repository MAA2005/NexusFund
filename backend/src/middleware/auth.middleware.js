const jwt = require("jsonwebtoken");

/**
 * Protects routes that require a logged-in user.
 * Reads the token from the Authorization header: "Bearer <token>"
 * On success, attaches { id, email } to req.user and calls next().
 * On failure, returns 401 — never 403 (which would confirm the route exists).
 */
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Authentication required. Include an Authorization: Bearer <token> header.",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Attach only the fields we need — don't expose the full token payload
        req.user = { id: decoded.id, email: decoded.email };
        next();
    } catch (err) {
        // Differentiate expired vs tampered so the client knows whether to re-login
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                error: "Your session has expired. Please log in again.",
            });
        }
        return res.status(401).json({
            error: "Invalid authentication token.",
        });
    }
}

module.exports = { requireAuth };
