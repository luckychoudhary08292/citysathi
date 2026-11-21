const mongoose = require("mongoose");

const userAccountSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, trim: true, minlength: 2 },
    usernameLower: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    resetToken: { type: String, default: null, select: false },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true, versionKey: false, collection: "users" }
);

module.exports = mongoose.model("UserAccount", userAccountSchema);
