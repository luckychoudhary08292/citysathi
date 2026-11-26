const mongoose = require("mongoose");

const promoBannerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    badgeText: { type: String, default: "" },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    ctaLabel: { type: String, default: "" },
    imageUrl: { type: String, default: null },
    targetRoute: {
      type: String,
      enum: ["plan_trip", "explore", "map", "services"],
      default: "plan_trip",
    },
  },
  { _id: false }
);

const citySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    state: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    heroImageUrl: { type: String, default: null },
    heroSubtitle: { type: String, default: "Unforgettable journeys in {city},\ncreated for you." },
    promoBanner: { type: promoBannerSchema, default: null },
    collectionName: { type: String, required: true, unique: true },
  },
  { timestamps: true, versionKey: false, collection: "cities" }
);

citySchema.pre("validate", function setCityCollectionName() {
  if (this.id) {
    this.id = this.id.toLocaleLowerCase();
    this.collectionName = `city_${this.id}`;
  }
});

module.exports = mongoose.model("City", citySchema);
