const mongoose = require("mongoose");
const City = require("../models/City");
const { ApiError } = require("../middleware/error");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cityLookupFilter(cityId) {
  const normalized = String(cityId || "").trim();
  if (!normalized || !/^[a-z0-9_-]+$/i.test(normalized)) {
    throw new ApiError(400, "Invalid cityId");
  }

  const clauses = [{ id: new RegExp(`^${escapeRegex(normalized)}$`, "i") }];
  if (/^[a-f\d]{24}$/i.test(normalized)) {
    clauses.push({ _id: new mongoose.Types.ObjectId(normalized) });
  }
  return { $or: clauses };
}

function cityIdFilter(city, requestedCityId) {
  const values = [city?.id, city?._id?.toString(), requestedCityId]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim());
  const clauses = [...new Set(values.map((value) => value.toLocaleLowerCase()))]
    .map((value) => ({ cityId: new RegExp(`^${escapeRegex(value)}$`, "i") }));
  if (city?._id) clauses.push({ cityId: city._id });
  return { $or: clauses };
}

function cityScopedFilter(city, requestedCityId, filter = {}) {
  return { $and: [cityIdFilter(city, requestedCityId), filter] };
}

async function getCityContext(cityId) {
  if (!mongoose.connection.db) {
    throw new Error("MongoDB connection is not ready");
  }
  const requestedCityId = String(cityId || "").trim();
  const lookup = cityLookupFilter(requestedCityId);
  const city = await City.findOne(lookup).lean();
  if (!city) throw new ApiError(404, "City not found.");
  const canonicalCityId = city
    ? String(city.id || city._id).toLocaleLowerCase()
    : requestedCityId.toLocaleLowerCase();
  const collectionName = `city_${canonicalCityId}`;

  if (!/^[a-z0-9_-]+$/i.test(collectionName)) {
    throw new Error(`Invalid collectionName configured for city ${canonicalCityId}`);
  }
  return {
    city,
    cityId: canonicalCityId,
    collectionName,
    collection: mongoose.connection.db.collection(collectionName),
    cityFilter: cityIdFilter(city, requestedCityId),
  };
}

async function getCityCollection(cityId) {
  const context = await getCityContext(cityId);
  return context.collection;
}

module.exports = {
  getCityCollection,
  getCityContext,
  cityLookupFilter,
  cityIdFilter,
  cityScopedFilter,
};
