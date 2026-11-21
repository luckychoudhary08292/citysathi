const TripPlan = require("../models/TripPlan");
const { ApiError } = require("../middleware/error");

function deviceIdFrom(req) {
  const deviceId = req.get("X-Device-Id");
  return deviceId && deviceId.trim() ? deviceId.trim() : "default_device";
}

function tripJson(trip) {
  return {
    id: trip.id,
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

async function listTrips(req, res, next) {
  try {
    const trips = await TripPlan.find({ deviceId: deviceIdFrom(req) }).sort({ createdAt: -1 });
    res.status(200).json(trips.map(tripJson));
  } catch (error) {
    next(error);
  }
}

async function upsertTrip(req, res, next) {
  try {
    const deviceId = deviceIdFrom(req);
    const trip = await TripPlan.findOneAndUpdate(
      { id: req.body.id, deviceId },
      { $set: { ...req.body, deviceId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(tripJson(trip));
  } catch (error) {
    next(error);
  }
}

async function patchTrip(req, res, next) {
  try {
    const trip = await TripPlan.findOneAndUpdate(
      { id: req.params.tripId, deviceId: deviceIdFrom(req) },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!trip) throw new ApiError(404, "Trip plan not found");
    res.status(200).json(tripJson(trip));
  } catch (error) {
    next(error);
  }
}

async function deleteTrip(req, res, next) {
  try {
    const result = await TripPlan.deleteOne({
      id: req.params.tripId,
      deviceId: deviceIdFrom(req),
    });
    if (!result.deletedCount) throw new ApiError(404, "Trip plan not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = { listTrips, upsertTrip, patchTrip, deleteTrip };
