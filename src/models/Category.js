const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    cityId: { type: String, required: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ["HERITAGE", "FOOD", "SHOPPING", "ENTERTAINMENT", "NATURE", "CULTURE"],
    },
    title: { type: String, required: true },
    subCategories: { type: [String], default: [] },
  },
  { versionKey: false, collection: "categories" }
);

categorySchema.index({ cityId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
