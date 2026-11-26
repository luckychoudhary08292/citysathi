const mongoose = require("mongoose");

const tipSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    placeId: { type: String, required: true, index: true },
    placeName: { type: String, required: true },
    note: { type: String, required: true },
    rating: { type: Number, required: true, min: 0, max: 5 },
    timestamp: { type: Number, required: true, default: Date.now },
  },
  { versionKey: false, collection: "tips" }
);

module.exports = mongoose.model("Tip", tipSchema);
