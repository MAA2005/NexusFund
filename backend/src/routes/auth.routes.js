const express = require("express");

const { register, login, me } = require("../controllers/auth.controller");
const { requireAuth }         = require("../middleware/auth.middleware");
const { validate }            = require("../middleware/validate.middleware");
const { registerSchema, loginSchema } = require("../validators/auth.validators");

const router = express.Router();

// POST /api/auth/register — create account, returns JWT
router.post("/register", validate(registerSchema), register);

// POST /api/auth/login — verify credentials, returns JWT
router.post("/login",    validate(loginSchema),    login);

// GET  /api/auth/me — returns current user's profile (requires valid JWT)
router.get("/me",        requireAuth,              me);

module.exports = router;
