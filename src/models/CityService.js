const mongoose = require("mongoose");
const { SERVICE_GROUPS } = require("../config/constants");

const cityServiceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    cityId: { type: String, required: true, index: true },
    group: { type: String, required: true, enum: SERVICE_GROUPS, index: true },
    name: { type: String, required: true },
    subtitle: { type: String, default: "" },
    distanceOrHours: { type: String, default: "" },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    phone: { type: String, default: "" },
  },
  { versionKey: false }
);

module.exports = mongoose.model("CityService", cityServiceSchema);
