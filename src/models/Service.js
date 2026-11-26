const mongoose = require("mongoose");
const { SERVICE_GROUPS, SERVICE_ICON_KEYS } = require("../config/constants");

const serviceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    docType: { type: String, enum: ["service"], default: "service" },
    cityId: { type: String, required: true, trim: true },
    group: { type: String, enum: SERVICE_GROUPS, required: true },
    serviceMode: { type: String, enum: ["CONTACT", "SERVICE_NAME"], required: true },
    name: { type: String, default: "" },
    highlightNumber: { type: String, default: "" },
    category: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    distanceOrHours: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    iconKey: { type: String, enum: SERVICE_ICON_KEYS, required: true },
    isUrgent: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    actionUrl: { type: String, default: null },
  },
  {
    versionKey: false,
    strict: true,
    collection: "service_validation",
    autoCreate: false,
    autoIndex: false,
  }
);

const Service = mongoose.model("Service", serviceSchema);

async function validateServiceDocument(value) {
  const service = new Service(value);
  await service.validate();
  return service.toObject();
}

module.exports = { serviceSchema, validateServiceDocument };
