const mongoose = require("mongoose");

const mapCategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: "map_categories" }
);

module.exports = mongoose.model("MapCategory", mapCategorySchema);
