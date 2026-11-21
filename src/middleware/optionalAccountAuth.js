const jwt = require("jsonwebtoken");
const { ApiError } = require("./error");

function optionalAccountAuth(req, _res, next) {
  const header = req.get("Authorization");
  if (!header) return next();
  if (!header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authorization must use Bearer token format."));
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const userId = payload.userId || payload.sub;
    if (typeof userId !== "string" || !userId) {
      throw new ApiError(401, "Invalid or expired token.");
    }
    req.authUserId = userId;
    next();
  } catch (_error) {
    next(new ApiError(401, "Invalid or expired token."));
  }
}

module.exports = optionalAccountAuth;
