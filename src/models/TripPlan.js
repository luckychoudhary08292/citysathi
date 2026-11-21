const mongoose = require("mongoose");

const tripPlanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, unique: true, index: true },
    deviceId: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    cityId: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    placeIds: { type: [String], default: [] },
    startDateMillis: { type: Number, required: true },
    completedPlaceIds: { type: [String], default: [] },
    status: { type: String, enum: ["UPCOMING", "COMPLETED"], default: "UPCOMING" },
    createdAt: { type: Number, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model("TripPlan", tripPlanSchema);
