const { ZodError } = require("zod");

/**
 * Factory function — returns middleware that validates req.body against a Zod schema.
 *
 * On success: req.body is REPLACED with the Zod-parsed result.
 *   This is important because Zod can transform values (e.g., .toLowerCase() on email,
 *   .trim() on strings). The controller receives the cleaned, safe version.
 *
 * On failure: responds 400 with an array of field-level error messages so the
 *   frontend can highlight specific form fields, not just show a generic error.
 *
 * Usage:
 *   router.post("/", validate(mySchema), myController);
 */
function validate(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const details = err.errors.map((e) => ({
                    field:   e.path.join(".") || "body",
                    message: e.message,
                }));
                return res.status(400).json({
                    error:   "Validation failed",
                    details,
                });
            }
            // Non-Zod errors are unexpected — pass to global error handler
            next(err);
        }
    };
}

module.exports = { validate };
