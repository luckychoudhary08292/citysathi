const mongoose = require("mongoose");
const City = require("../models/City");
const { ApiError } = require("../middleware/error");

async function getCityCollection(cityId) {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready");
  }
  if (!/^[a-z0-9_-]+$/i.test(cityId)) {
    throw new ApiError(400, "Invalid cityId");
  }

  const city = await City.findOne({ id: cityId }).select("collectionName").lean();
  const collectionName = city?.collectionName || `city_${cityId}`;
  if (!/^[a-z0-9_-]+$/i.test(collectionName)) {
    throw new Error(`Invalid collectionName configured for city ${cityId}`);
  }
  return mongoose.connection.db.collection(collectionName);
}

module.exports = { getCityCollection };
