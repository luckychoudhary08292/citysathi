const mongoose = require("mongoose");

const tripPlanSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, default: "" },
    placeIds: [{ type: String }],
    notes: { type: String, default: "" },
    status: { type: String, enum: ["PLANNED", "ONGOING", "COMPLETED"], default: "PLANNED" },
  },
  { timestamps: true, versionKey: false }
);

const contributionSchema = new mongoose.Schema(
  {
    placeId: { type: String, default: "" },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    selectedCityId: { type: String, required: true },
    notificationsEnabled: { type: Boolean, default: true },
    savedPlaceIds: [{ type: String }],
    visitedPlaceIds: [{ type: String }],
    tripPlans: [tripPlanSchema],
    contributions: [contributionSchema],
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("User", userSchema);
