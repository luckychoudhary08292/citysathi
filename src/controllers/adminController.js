const crypto = require("crypto");
const City = require("../models/City");
const Category = require("../models/Category");
const Tip = require("../models/Tip");
const { getCityCollection } = require("../utils/cityCollection");
const { emitLiveUpdate } = require("../services/liveUpdates");
const { ApiError } = require("../middleware/error");
const { placeJson, serviceJson, appJson, promoJson } = require("./cityController");

const { CATEGORY_VALUES } = require("../config/constants");

function generatedId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function emit(req, scope, cityId = "", action) {
  emitLiveUpdate({
    type: "DATA_UPDATED",
    cityId,
    scope,
    action,
  });
}

function cityJson(city) {
  return {
    id: city.id,
    name: city.name,
    state: city.state || "",
    latitude: city.latitude ?? 22.7196,
    longitude: city.longitude ?? 75.8577,
    heroImageUrl: city.heroImageUrl ?? null,
    collectionName: city.collectionName || `city_${city.id}`,
  };
}

function homeJson(cityId, home, places) {
  if (!home) throw new ApiError(404, "City home not found.");
  return {
    cityId,
    cityName: home.cityName || "",
    heroSubtitle: home.heroSubtitle || "",
    headerImageUrl: home.headerImageUrl ?? null,
    popularPlaces: places.map(placeJson),
    promoBanner: promoJson(home.promoBanner),
  };
}

async function requireCity(cityId) {
  const city = await City.findOne({ id: cityId }).lean();
  if (!city) throw new ApiError(404, "City not found.");
  return city;
}

async function cityDocs(cityId, docType) {
  const collection = await getCityCollection(cityId);
  return collection.find({ cityId, docType }).sort({ sortOrder: 1, name: 1 }).toArray();
}

async function findCityDoc(docType, id, requestedCityId) {
  const cities = requestedCityId
    ? [await requireCity(requestedCityId)]
    : await City.find({}).sort({ id: 1 }).lean();

  for (const city of cities) {
    const collection = await getCityCollection(city.id);
    const doc = await collection.findOne({ id, cityId: city.id, docType });
    if (doc) return { city, collection, doc };
  }
  throw new ApiError(404, `${docType} not found.`);
}

function normalizePlace(input, cityId, id) {
  const category = typeof input.category === "string" ? input.category.toUpperCase() : "";
  return {
    id,
    docType: "place",
    cityId,
    name: input.name,
    subtitle: input.subtitle ?? "",
    category: CATEGORY_VALUES.includes(category) ? category : "HERITAGE",
    rating: input.rating ?? 4.5,
    reviewCountLabel: input.reviewCountLabel ?? "100+ Reviews",
    distanceLabel: input.distanceLabel ?? "1.2 km",
    tags: input.tags ?? [],
    subCategories: input.subCategories ?? [],
    description: input.description ?? "",
    openHours: input.openHours ?? "Open Daily",
    phone: input.phone ?? "",
    address: input.address ?? "",
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    imageUrl: input.imageUrl ?? null,
    isPopular: input.isPopular ?? true,
    isTrending: input.isTrending ?? false,
  };
}

function normalizeService(input, cityId, id) {
  return {
    id,
    docType: "service",
    cityId,
    name: input.name ?? "",
    title: input.title ?? "",
    highlightNumber: input.highlightNumber ?? "",
    number: input.number ?? "",
    badgeNumber: input.badgeNumber ?? "",
    category: input.category ?? "",
    group: input.group ?? "",
    subtitle: input.subtitle ?? "",
    description: input.description ?? "",
    distanceOrHours: input.distanceOrHours ?? "",
    phone: input.phone ?? null,
    address: input.address ?? "",
    iconKey: input.iconKey ?? "",
    isUrgent: input.isUrgent ?? false,
    sortOrder: input.sortOrder ?? 0,
    latitude: input.latitude ?? 0,
    longitude: input.longitude ?? 0,
    actionUrl: input.actionUrl ?? null,
  };
}

function normalizeApp(input, cityId, id) {
  return {
    id,
    docType: "app",
    cityId,
    appName: input.appName ?? input.name ?? "",
    name: input.name ?? input.appName ?? "",
    taskCategory: input.taskCategory ?? input.category ?? "",
    task: input.task ?? "",
    category: input.category ?? input.taskCategory ?? "",
    description: input.description ?? "",
    howToUse: input.howToUse ?? "",
    highlightTag: input.highlightTag ?? null,
    badge: input.badge ?? null,
    iconUrl: input.iconUrl ?? null,
    iconKey: input.iconKey ?? "",
    playStoreUrl: input.playStoreUrl ?? input.storeUrl ?? null,
    storeUrl: input.storeUrl ?? input.playStoreUrl ?? null,
    packageName: input.packageName ?? null,
    websiteUrl: input.websiteUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
  };
}

async function listCities(_req, res) {
  const cities = await City.find({}).sort({ name: 1 }).lean();
  res.status(200).json(cities.map(cityJson));
}

async function createCity(req, res) {
  const id = req.body.id.trim();
  const city = await City.create({
    ...req.body,
    id,
    heroImageUrl: req.body.heroImageUrl ?? null,
    collectionName: req.body.collectionName || `city_${id}`,
  });
  emit(req, "cities");
  res.status(201).json(cityJson(city.toObject()));
}

async function updateCity(req, res) {
  const city = await City.findOneAndUpdate(
    { id: req.params.cityId },
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!city) throw new ApiError(404, "City not found.");
  emit(req, "cities");
  res.status(200).json(cityJson(city));
}

async function deleteCity(req, res) {
  const city = await requireCity(req.params.cityId);
  const collection = await getCityCollection(city.id);
  await Promise.all([
    collection.deleteMany({ cityId: city.id }),
    Category.deleteMany({ cityId: city.id }),
  ]);
  await City.deleteOne({ id: city.id });
  emit(req, "cities");
  res.status(204).end();
}

async function getHome(req, res) {
  const city = await requireCity(req.params.cityId);
  const collection = await getCityCollection(city.id);
  const [home, places] = await Promise.all([
    collection.findOne({ id: "home_meta", docType: "home_meta", cityId: city.id }),
    collection.find({ docType: "place", cityId: city.id, isPopular: true }).sort({ rating: -1 }).toArray(),
  ]);
  res.status(200).json(homeJson(city.id, home, places));
}

async function updateHome(req, res) {
  const city = await requireCity(req.params.cityId);
  const collection = await getCityCollection(city.id);
  const existing = await collection.findOne({ id: "home_meta", docType: "home_meta", cityId: city.id });
  let promoBanner = existing?.promoBanner ?? null;
  if (Object.prototype.hasOwnProperty.call(req.body, "promoBanner")) {
    promoBanner = req.body.promoBanner === null
      ? null
      : {
          id: "promo_banner",
          badgeText: "FEATURED",
          title: "",
          subtitle: "",
          ctaLabel: "Plan Trip",
          imageUrl: null,
          targetRoute: "plan_trip",
          ...(promoBanner || {}),
          ...req.body.promoBanner,
        };
  }
  const home = {
    id: "home_meta",
    docType: "home_meta",
    cityId: city.id,
    cityName: req.body.cityName ?? existing?.cityName ?? city.name,
    heroSubtitle: req.body.heroSubtitle ?? existing?.heroSubtitle ?? `Unforgettable journeys in ${city.name},\ncreated for you.`,
    headerImageUrl: Object.prototype.hasOwnProperty.call(req.body, "headerImageUrl")
      ? req.body.headerImageUrl
      : existing?.headerImageUrl ?? city.heroImageUrl ?? null,
    promoBanner,
  };
  await collection.updateOne(
    { id: "home_meta", docType: "home_meta" },
    { $set: home },
    { upsert: true }
  );
  const places = await collection.find({ docType: "place", cityId: city.id, isPopular: true }).sort({ rating: -1 }).toArray();
  emit(req, "home", city.id);
  res.status(200).json(homeJson(city.id, home, places));
}

async function listCategories(req, res) {
  const filter = {};
  if (req.query.cityId) filter.cityId = req.query.cityId;
  if (req.query.category) filter.category = req.query.category;
  const docs = await Category.find(filter).sort({ cityId: 1, category: 1 }).lean();
  res.status(200).json(docs.map(({ id, cityId, category, title, subCategories }) => ({
    id, cityId, category, title, subCategories,
  })));
}

async function createCategory(req, res) {
  await requireCity(req.body.cityId);
  const category = await Category.create({
    ...req.body,
    id: req.body.id || `${req.body.cityId}_${req.body.category}`,
  });
  emit(req, "categories", category.cityId);
  res.status(201).json({
    id: category.id,
    cityId: category.cityId,
    category: category.category,
    title: category.title,
    subCategories: category.subCategories,
  });
}

async function updateCategory(req, res) {
  const category = await Category.findOneAndUpdate(
    { id: req.params.id },
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!category) throw new ApiError(404, "Category not found.");
  emit(req, "categories", category.cityId);
  res.status(200).json({
    id: category.id,
    cityId: category.cityId,
    category: category.category,
    title: category.title,
    subCategories: category.subCategories,
  });
}

async function deleteCategory(req, res) {
  const category = await Category.findOneAndDelete({ id: req.params.id }).lean();
  if (!category) throw new ApiError(404, "Category not found.");
  emit(req, "categories", category.cityId);
  res.status(204).end();
}

async function listPlaces(req, res) {
  const cityIds = req.query.cityId
    ? [req.query.cityId]
    : (await City.find({}).select("id").lean()).map((city) => city.id);
  const docs = (await Promise.all(cityIds.map((cityId) => cityDocs(cityId, "place")))).flat();
  res.status(200).json(docs.map(placeJson));
}

async function createPlace(req, res) {
  const cityId = req.body.cityId;
  await requireCity(cityId);
  const doc = normalizePlace(req.body, cityId, req.body.id || generatedId("plc"));
  const collection = await getCityCollection(cityId);
  await collection.insertOne(doc);
  emit(req, "places", cityId, req.method);
  res.status(201).json(placeJson(doc));
}

async function updatePlace(req, res) {
  const found = await findCityDoc("place", req.params.id, req.body.cityId);
  const patch = { ...req.body };
  delete patch.cityId;
  delete patch.id;
  delete patch.docType;
  if (patch.category !== undefined) {
    const normalized = String(patch.category).toUpperCase();
    patch.category = CATEGORY_VALUES.includes(normalized) ? normalized : "HERITAGE";
  }
  const result = await found.collection.findOneAndUpdate(
    { id: req.params.id, docType: "place", cityId: found.city.id },
    { $set: patch },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) throw new ApiError(404, "Place not found.");
  emit(req, "places", found.city.id, req.method);
  res.status(200).json(placeJson(doc));
}

async function deletePlace(req, res) {
  const found = await findCityDoc("place", req.params.id, req.query.cityId);
  await found.collection.deleteOne({ id: req.params.id, docType: "place", cityId: found.city.id });
  emit(req, "places", found.city.id, req.method);
  res.status(204).end();
}

async function listCityContent(req, res, docType, serializer) {
  const cityIds = req.query.cityId
    ? [req.query.cityId]
    : (await City.find({}).select("id").lean()).map((city) => city.id);
  const docs = (await Promise.all(cityIds.map((cityId) => cityDocs(cityId, docType)))).flat();
  res.status(200).json(docs.map(serializer));
}

async function createCityContent(req, res, docType, scope, normalizer, serializer) {
  const cityId = req.body.cityId;
  await requireCity(cityId);
  const doc = normalizer(req.body, cityId, req.body.id || generatedId(docType === "app" ? "app" : "svc"));
  const collection = await getCityCollection(cityId);
  await collection.insertOne(doc);
  emit(req, scope, cityId);
  res.status(201).json(serializer(doc));
}

async function updateCityContent(req, res, docType, scope, normalizer, serializer) {
  const found = await findCityDoc(docType, req.params.id, req.body.cityId);
  const patchInput = { ...req.body };
  delete patchInput.cityId;
  delete patchInput.id;
  delete patchInput.docType;
  const normalized = normalizer({ ...found.doc, ...patchInput }, found.city.id, found.doc.id);
  delete normalized.id;
  const result = await found.collection.findOneAndUpdate(
    { id: req.params.id, docType, cityId: found.city.id },
    { $set: normalized },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) throw new ApiError(404, `${docType} not found.`);
  emit(req, scope, found.city.id);
  res.status(200).json(serializer(doc));
}

async function deleteCityContent(req, res, docType, scope) {
  const found = await findCityDoc(docType, req.params.id, req.query.cityId);
  await found.collection.deleteOne({ id: req.params.id, docType, cityId: found.city.id });
  emit(req, scope, found.city.id);
  res.status(204).end();
}

const listServices = (req, res) => listCityContent(req, res, "service", serviceJson);
const createService = (req, res) => createCityContent(req, res, "service", "services", normalizeService, serviceJson);
const updateService = (req, res) => updateCityContent(req, res, "service", "services", normalizeService, serviceJson);
const deleteService = (req, res) => deleteCityContent(req, res, "service", "services");

const listApps = (req, res) => listCityContent(req, res, "app", appJson);
const createApp = (req, res) => createCityContent(req, res, "app", "apps", normalizeApp, appJson);
const updateApp = (req, res) => updateCityContent(req, res, "app", "apps", normalizeApp, appJson);
const deleteApp = (req, res) => deleteCityContent(req, res, "app", "apps");

async function listTips(_req, res) {
  const tips = await Tip.find({}).sort({ timestamp: -1 }).lean();
  res.status(200).json(tips.map(({ id, placeId, placeName, note, rating, timestamp }) => ({
    id, placeId, placeName, note, rating, timestamp,
  })));
}

async function deleteTip(req, res) {
  const tip = await Tip.findOneAndDelete({ id: req.params.id }).lean();
  if (!tip) throw new ApiError(404, "Tip not found.");
  let cityId = "";
  try {
    const found = await findCityDoc("place", tip.placeId);
    cityId = found.city.id;
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }
  emit(req, "places", cityId);
  res.status(204).end();
}

module.exports = {
  listCities, createCity, updateCity, deleteCity,
  getHome, updateHome,
  listCategories, createCategory, updateCategory, deleteCategory,
  listPlaces, createPlace, updatePlace, deletePlace,
  listServices, createService, updateService, deleteService,
  listApps, createApp, updateApp, deleteApp,
  listTips, deleteTip,
};
