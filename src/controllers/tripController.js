const TripPlan = require("../models/TripPlan");
const mongoose = require("mongoose");
const City = require("../models/City");
const { ApiError } = require("../middleware/error");
const { emitLiveUpdate } = require("../services/liveUpdates");
const { stringId, stringArray } = require("../utils/serialization");
const { cityLookupFilter } = require("../utils/cityCollection");

function userIdFrom(req) {
  return (
    req.get("X-User-Id") ||
    req.authUserId ||
    req.get("X-Device-Id") ||
    (req.body && req.body.userId) ||
    "default_user"
  ).trim();
}

function deviceIdFrom(req) {
  return (req.get("X-Device-Id") || (req.body && req.body.deviceId) || "").trim();
}

function tripIdFilter(tripId) {
  const clauses = [{ id: String(tripId) }];
  if (/^[a-f\d]{24}$/i.test(String(tripId))) {
    clauses.push({ _id: new mongoose.Types.ObjectId(String(tripId)) });
  }
  return { $or: clauses };
}

function userTripFilter(tripId, userId) {
  return { $and: [tripIdFilter(tripId), { userId }] };
}

function tripJson(trip, cityId = trip.cityId) {
  return {
    id: stringId(trip),
    userId: trip.userId,
    deviceId: trip.deviceId || "",
    title: trip.title,
    cityId: cityId || "",
    duration: trip.duration,
    placeIds: stringArray(trip.placeIds),
    startDateMillis: trip.startDateMillis,
    completedPlaceIds: stringArray(trip.completedPlaceIds),
    status: trip.status,
    createdAt: trip.createdAt,
  };
}

async function normalizeCityId(cityId, requireLiveCity = false) {
  const requestedCityId = String(cityId || "").trim();
  const city = await City.findOne(cityLookupFilter(requestedCityId)).lean();
  if (!city && requireLiveCity) throw new ApiError(400, "cityId must reference a live city");
  return city ? stringId(city).toLocaleLowerCase() : requestedCityId.toLocaleLowerCase();
}

async function ensurePlacesAvailable(userId, placeIds, currentTripId) {
  const uniquePlaceIds = [...new Set(placeIds || [])];
  if (!uniquePlaceIds.length) return;

  const filter = {
    userId,
    placeIds: { $in: uniquePlaceIds },
  };
  if (currentTripId) filter.$nor = [tripIdFilter(currentTripId)];
  const existingTrip = await TripPlan.findOne(filter).select("title placeIds");

  if (existingTrip) {
    throw new ApiError(
      409,
      `Already in "${existingTrip.title}". A place can only be in 1 trip at a time.`
    );
  }
}

async function listTrips(req, res, next) {
  try {
    const filter = { userId: userIdFrom(req) };
    if (req.query.cityId) filter.cityId = await normalizeCityId(req.query.cityId);
    const trips = await TripPlan.find(filter).sort({ createdAt: -1 });
    const cityIds = [...new Set(trips.map((trip) => trip.cityId).filter(Boolean))];
    const normalizedCityIds = await Promise.all(cityIds.map(async (cityId) => [
      cityId,
      await normalizeCityId(cityId),
    ]));
    const cityIdMap = new Map(normalizedCityIds);
    res.status(200).json(trips.map((trip) =>
      tripJson(trip, cityIdMap.get(trip.cityId) || String(trip.cityId || "").toLocaleLowerCase())
    ));
  } catch (error) {
    next(error);
  }
}

async function upsertTrip(req, res, next) {
  try {
    const userId = userIdFrom(req);
    const cityId = await normalizeCityId(req.body.cityId, true);
    await ensurePlacesAvailable(userId, req.body.placeIds, req.body.id);
    const trip = await TripPlan.findOneAndUpdate(
      { id: req.body.id, userId },
      {
        $set: {
          ...req.body,
          cityId,
          userId,
          deviceId: deviceIdFrom(req),
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(tripJson(trip));
    emitLiveUpdate({ type: "DATA_UPDATED", cityId: trip.cityId, scope: "trips" });
  } catch (error) {
    next(error);
  }
}

async function patchTrip(req, res, next) {
  try {
    const userId = userIdFrom(req);
    await ensurePlacesAvailable(userId, req.body.placeIds, req.params.tripId);
    const patch = { ...req.body };
    if (patch.cityId !== undefined) patch.cityId = await normalizeCityId(patch.cityId, true);
    const trip = await TripPlan.findOneAndUpdate(
      userTripFilter(req.params.tripId, userId),
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!trip) throw new ApiError(404, "Trip plan not found");
    res.status(200).json(tripJson(trip));
    emitLiveUpdate({ type: "DATA_UPDATED", cityId: trip.cityId, scope: "trips" });
  } catch (error) {
    next(error);
  }
}

async function deleteTrip(req, res, next) {
  try {
    const trip = await TripPlan.findOneAndDelete(
      userTripFilter(req.params.tripId, userIdFrom(req))
    );
    res.status(204).end();
    if (trip) emitLiveUpdate({ type: "DATA_UPDATED", cityId: trip.cityId, scope: "trips" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listTrips, upsertTrip, patchTrip, deleteTrip };
