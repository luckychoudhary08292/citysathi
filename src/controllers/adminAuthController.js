const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ApiError } = require("../middleware/error");

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function login(req, res, next) {
  try {
    const configuredUsername = process.env.ADMIN_USERNAME;
    const configuredPassword = process.env.ADMIN_PASSWORD;
    if (!configuredUsername || !configuredPassword || !process.env.JWT_SECRET) {
      throw new ApiError(503, "Admin login is not configured.");
    }

    if (
      !safeEqual(req.body.username.toLowerCase(), configuredUsername.toLowerCase()) ||
      !safeEqual(req.body.password, configuredPassword)
    ) {
      throw new ApiError(401, "Invalid admin username or password.");
    }

    const token = jwt.sign(
      { sub: configuredUsername, username: configuredUsername, role: "ADMIN" },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "12h" }
    );
    res.status(200).json({ token, role: "ADMIN", message: "Admin signed in successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = { login };
