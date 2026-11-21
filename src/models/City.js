const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    state: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heroImageUrl: { type: String, required: true },
    collectionName: {
      type: String,
      required: true,
      default() {
        return `${this.id}_places`;
      },
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("City", citySchema);
