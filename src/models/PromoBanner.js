const mongoose = require("mongoose");

const promoBannerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    cityId: { type: String, required: true, index: true },
    badgeText: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    ctaLabel: { type: String, required: true },
    imageUrl: { type: String, required: true },
    targetRoute: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("PromoBanner", promoBannerSchema);
