const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
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

    const userId = typeof payload.sub === "string" ? payload.sub : "";
    const user = /^[a-f\d]{24}$/i.test(userId)
      ? await User.findOne({ _id: new mongoose.Types.ObjectId(userId) }).select("+passwordHash")
      : null;
    if (!user) throw new ApiError(401, "Unauthorized");
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = auth;
