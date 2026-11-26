const mongoose = require("mongoose");

const mapCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, lowercase: true, trim: true },
    sortOrder: { type: Number, required: true, default: 0 },
    type: { type: String, default: "MAP" },
  },
  { timestamps: true, versionKey: false, collection: "map_categories" }
);

mapCategorySchema.index({ cityId: 1, nameLower: 1 }, { unique: true });

module.exports = mongoose.model("MapCategory", mapCategorySchema);
