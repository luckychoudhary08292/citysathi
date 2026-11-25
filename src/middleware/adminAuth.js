const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ApiError } = require("./error");

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function adminAuth(req, _res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = req.get("X-Admin-Key");
  if (configuredKey && suppliedKey && safeEqual(configuredKey, suppliedKey)) {
    req.admin = { username: "api-key" };
    return next();
  }

  const header = req.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Admin authentication is required."));
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    if (payload.role !== "ADMIN") {
      return next(new ApiError(403, "Administrator access is required."));
    }
    req.admin = { username: payload.username || payload.sub };
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    next(new ApiError(401, "Invalid or expired admin token."));
  }
}

module.exports = adminAuth;
