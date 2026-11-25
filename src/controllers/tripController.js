const TripPlan = require("../models/TripPlan");
const { ApiError } = require("../middleware/error");
const { emitLiveUpdate } = require("../services/liveUpdates");

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

function tripJson(trip) {
  return {
    id: trip.id,
    userId: trip.userId,
    deviceId: trip.deviceId,
    title: trip.title,
    cityId: trip.cityId,
    duration: trip.duration,
    placeIds: trip.placeIds,
    startDateMillis: trip.startDateMillis,
    completedPlaceIds: trip.completedPlaceIds,
    status: trip.status,
    createdAt: trip.createdAt,
  };
}

async function ensurePlacesAvailable(userId, placeIds, currentTripId) {
  const uniquePlaceIds = [...new Set(placeIds || [])];
  if (!uniquePlaceIds.length) return;

  const existingTrip = await TripPlan.findOne({
    userId,
    id: { $ne: currentTripId },
    placeIds: { $in: uniquePlaceIds },
  }).select("title placeIds");

  if (existingTrip) {
    throw new ApiError(
      409,
      `Already in "${existingTrip.title}". A place can only be in 1 trip at a time.`
    );
  }
}

async function listTrips(req, res, next) {
  try {
    const trips = await TripPlan.find({ userId: userIdFrom(req) }).sort({ createdAt: -1 });
    res.status(200).json(trips.map(tripJson));
  } catch (error) {
    next(error);
  }
}

async function upsertTrip(req, res, next) {
  try {
    const userId = userIdFrom(req);
    await ensurePlacesAvailable(userId, req.body.placeIds, req.body.id);
    const trip = await TripPlan.findOneAndUpdate(
      { id: req.body.id, userId },
      {
        $set: {
          ...req.body,
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
    const trip = await TripPlan.findOneAndUpdate(
      { id: req.params.tripId, userId },
      { $set: req.body },
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
    const trip = await TripPlan.findOneAndDelete({
      id: req.params.tripId,
      userId: userIdFrom(req),
    });
    res.status(204).end();
    if (trip) emitLiveUpdate({ type: "DATA_UPDATED", cityId: trip.cityId, scope: "trips" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listTrips, upsertTrip, patchTrip, deleteTrip };
