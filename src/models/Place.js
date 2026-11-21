const mongoose = require("mongoose");
const { CATEGORY_VALUES } = require("../config/constants");

const placeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    subtitle: { type: String, default: "" },
    category: { type: String, required: true, enum: CATEGORY_VALUES, index: true },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCountLabel: { type: String, default: "0 Reviews" },
    distanceLabel: { type: String, default: "" },
    tags: [{ type: String }],
    subCategories: [{ type: String }],
    description: { type: String, default: "" },
    openHours: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    isPopular: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

placeSchema.index({ cityId: 1, category: 1 });

module.exports = mongoose.model("Place", placeSchema);
