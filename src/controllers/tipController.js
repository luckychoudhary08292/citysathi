const Tip = require("../models/Tip");
const City = require("../models/City");
const mongoose = require("mongoose");
const { ApiError } = require("../middleware/error");
const { getCityContext } = require("../utils/cityCollection");
const { stringId, mongoId } = require("../utils/serialization");
const { emitLiveUpdate } = require("../services/liveUpdates");

function tipJson(tip) {
  return {
    id: stringId(tip),
    _id: mongoId(tip),
    cityId: tip.cityId || "",
    placeId: tip.placeId || "",
    placeName: tip.placeName || "",
    note: tip.note || "",
    rating: tip.rating ?? 0,
    timestamp: tip.timestamp ?? 0,
  };
}

function placeIdFilter(placeId) {
  const clauses = [{ id: String(placeId) }];
  if (/^[a-f\d]{24}$/i.test(String(placeId))) {
    clauses.push({ _id: new mongoose.Types.ObjectId(String(placeId)) });
  }
  return { $or: clauses };
}

async function findPlaceCity(placeId) {
  const cities = await City.find({}).select("id").lean();
  for (const city of cities) {
    const context = await getCityContext(stringId(city));
    const place = await context.collection.findOne({
      $and: [
        placeIdFilter(placeId),
        { docType: "place" },
      ],
    });
    if (place) return context.cityId;
  }
  throw new ApiError(404, "Place not found.");
}

async function listTips(req, res, next) {
  try {
    const tips = await Tip.find({ placeId: req.params.placeId }).sort({ timestamp: -1 });
    res.status(200).json(tips.map(tipJson));
  } catch (error) {
    next(error);
  }
}

async function createTip(req, res, next) {
  try {
    const cityId = await findPlaceCity(req.params.placeId);
    if (req.body.cityId && req.body.cityId.toLocaleLowerCase() !== cityId) {
      throw new ApiError(400, "cityId does not match the requested place.");
    }
    const tip = await Tip.create({
      ...req.body,
      cityId,
      placeId: req.params.placeId,
    });
    res.status(201).json(tipJson(tip));
    emitLiveUpdate({ cityId, scope: "tips" });
  } catch (error) {
    next(error);
  }
}

module.exports = { listTips, createTip };
