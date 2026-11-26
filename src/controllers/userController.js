const City = require("../models/City");
const { getCityCollection } = require("../utils/cityCollection");
const { ApiError } = require("../middleware/error");
const { stringId, mongoId, stringArray } = require("../utils/serialization");

function subdocumentJson(document, arrayFields = []) {
  const value = typeof document.toObject === "function" ? document.toObject() : document;
  const result = { ...value, id: stringId(document), _id: mongoId(document) };
  for (const field of arrayFields) result[field] = stringArray(value[field]);
  return result;
}

async function activity(req, res) {
  const user = req.user;
  res.status(200).json({
    tripPlans: (user.tripPlans || []).map((plan) => subdocumentJson(plan, ["placeIds"])),
    savedPlaceIds: stringArray(user.savedPlaceIds),
    visitedPlaceIds: stringArray(user.visitedPlaceIds),
    contributions: (user.contributions || []).map((item) => subdocumentJson(item)),
  });
}

async function validatePlace(placeId) {
  if (placeId) {
    const cities = await City.find({}).select("id collectionName").lean();
    const matches = await Promise.all(
      cities.map(async (city) => {
        const collection = await getCityCollection(city.id);
        return collection.findOne({ id: placeId, docType: "place" });
      })
    );
    if (!matches.some(Boolean)) throw new ApiError(404, "Place not found");
  }
}

async function addSaved(req, res, next) {
  try {
    await validatePlace(req.body.placeId);
    await req.user.updateOne({ $addToSet: { savedPlaceIds: req.body.placeId } });
    res.status(200).json({ savedPlaceIds: [...new Set([...req.user.savedPlaceIds, req.body.placeId])] });
  } catch (error) {
    next(error);
  }
}

async function removeSaved(req, res) {
  await req.user.updateOne({ $pull: { savedPlaceIds: req.params.placeId } });
  res.status(200).json({ savedPlaceIds: req.user.savedPlaceIds.filter((id) => id !== req.params.placeId) });
}

async function addVisited(req, res, next) {
  try {
    await validatePlace(req.body.placeId);
    await req.user.updateOne({ $addToSet: { visitedPlaceIds: req.body.placeId } });
    res.status(200).json({ visitedPlaceIds: [...new Set([...req.user.visitedPlaceIds, req.body.placeId])] });
  } catch (error) {
    next(error);
  }
}

async function removeVisited(req, res) {
  await req.user.updateOne({ $pull: { visitedPlaceIds: req.params.placeId } });
  res.status(200).json({ visitedPlaceIds: req.user.visitedPlaceIds.filter((id) => id !== req.params.placeId) });
}

async function createPlan(req, res) {
  req.user.tripPlans.push(req.body);
  await req.user.save();
  res.status(201).json(subdocumentJson(req.user.tripPlans[req.user.tripPlans.length - 1], ["placeIds"]));
}

async function updatePlan(req, res, next) {
  try {
    const plan = req.user.tripPlans.id(req.params.planId);
    if (!plan) throw new ApiError(404, "Trip plan not found");
    Object.entries(req.body).forEach(([key, value]) => { plan[key] = value; });
    await req.user.save();
    res.status(200).json(subdocumentJson(plan, ["placeIds"]));
  } catch (error) {
    next(error);
  }
}

async function deletePlan(req, res, next) {
  try {
    const plan = req.user.tripPlans.id(req.params.planId);
    if (!plan) throw new ApiError(404, "Trip plan not found");
    req.user.tripPlans.pull(plan._id);
    await req.user.save();
    res.status(200).json({ deleted: true, planId: req.params.planId });
  } catch (error) {
    next(error);
  }
}

async function addContribution(req, res, next) {
  try {
    await validatePlace(req.body.placeId);
    req.user.contributions.push(req.body);
    await req.user.save();
    res.status(201).json(subdocumentJson(req.user.contributions[req.user.contributions.length - 1]));
  } catch (error) {
    next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    if (req.body.selectedCityId) {
      const city = await City.findOne({ id: req.body.selectedCityId });
      if (!city) throw new ApiError(400, "selectedCityId must reference a live city");
      req.user.selectedCityId = req.body.selectedCityId;
    }
    if (typeof req.body.notificationsEnabled === "boolean") {
      req.user.notificationsEnabled = req.body.notificationsEnabled;
    }
    await req.user.save();
    res.status(200).json({
      selectedCityId: req.user.selectedCityId,
      notificationsEnabled: req.user.notificationsEnabled,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  activity, addSaved, removeSaved, addVisited, removeVisited,
  createPlan, updatePlan, deletePlan, addContribution, updatePreferences,
};
