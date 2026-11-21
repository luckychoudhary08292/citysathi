const Tip = require("../models/Tip");

function tipJson(tip) {
  return {
    id: tip.id,
    placeId: tip.placeId,
    placeName: tip.placeName,
    note: tip.note,
    rating: tip.rating,
    timestamp: tip.timestamp,
  };
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
    const tip = await Tip.create({
      ...req.body,
      placeId: req.params.placeId,
    });
    res.status(201).json(tipJson(tip));
  } catch (error) {
    next(error);
  }
}

module.exports = { listTips, createTip };
