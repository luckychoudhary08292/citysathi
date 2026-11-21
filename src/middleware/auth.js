const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ApiError } = require("./error");

async function auth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) throw new ApiError(401, "Unauthorized");

    let payload;
    try {
      payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch (_error) {
      throw new ApiError(401, "Invalid or expired token");
    }

    const user = await User.findById(payload.sub).select("+passwordHash");
    if (!user) throw new ApiError(401, "Unauthorized");
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = auth;
