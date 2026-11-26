const crypto = require("crypto");
const City = require("../models/City");
const Category = require("../models/Category");
const MapCategory = require("../models/MapCategory");
const Tip = require("../models/Tip");
const { emitLiveUpdate } = require("../services/liveUpdates");
const { ApiError } = require("../middleware/error");
const {
  getCityCollection,
  getCityContext,
  cityLookupFilter,
  cityIdFilter,
  cityScopedFilter,
} = require("../utils/cityCollection");
const { validateServiceDocument } = require("../models/Service");
const {
  placeJson, serviceJson, appJson, promoJson, categoryJson,
} = require("./cityController");
const mongoose = require("mongoose");
const { stringId, mongoId } = require("../utils/serialization");

const { CATEGORY_VALUES } = require("../config/constants");
function generatedId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function documentIdFilter(id) {
  const clauses = [{ id: String(id) }];
  if (/^[a-f\d]{24}$/i.test(String(id))) {
    clauses.push({ _id: new mongoose.Types.ObjectId(String(id)) });
  }
  return { $or: clauses };
}

function cityDocumentFilter(city, requestedCityId, id, docType) {
  return {
    $and: [
      documentIdFilter(id),
      cityIdFilter(city, requestedCityId),
      { docType: Array.isArray(docType) ? { $in: docType } : docType },
    ],
  };
}

function emit(req, scope, cityId = "", action, eventAliases = []) {
  emitLiveUpdate({
    type: "DATA_UPDATED",
    cityId,
    scope,
    action,
    eventAliases,
  });
}

function cityJson(city) {
  const id = stringId(city).toLocaleLowerCase();
  return {
    id,
    _id: mongoId(city),
    name: city.name || "",
    state: city.state || "",
    latitude: city.latitude ?? 22.7196,
    longitude: city.longitude ?? 75.8577,
    heroImageUrl: city.heroImageUrl ?? null,
    collectionName: `city_${id}`,
  };
}

function homeJson(city, places) {
  const cityId = stringId(city).toLocaleLowerCase();
  const heroSubtitle = (city.heroSubtitle ||
    "Unforgettable journeys in {city},\ncreated for you.")
    .replace(/\{city\}/gi, city.name);
  return {
    cityId,
    cityName: city.name || "",
    heroSubtitle,
    headerImageUrl: city.heroImageUrl ?? null,
    popularPlaces: places.map((place) => placeJson(place, cityId)),
    promoBanner: promoJson(city.promoBanner),
  };
}

function normalizedPromoBanner(value, cityId, existing) {
  if (value === null) return null;
  return {
    id: value.id || existing?.id || `promo_${cityId}`,
    badgeText: "FEATURED",
    title: "",
    subtitle: "",
    ctaLabel: "Plan Trip",
    imageUrl: null,
    targetRoute: "plan_trip",
    ...(existing || {}),
    ...value,
  };
}

async function requireCity(cityId) {
  const city = await City.findOne(cityLookupFilter(cityId)).lean();
  if (!city) throw new ApiError(404, "City not found.");
  return { ...city, id: stringId(city).toLocaleLowerCase() };
}

async function cityDocs(cityId, docType) {
  const context = await getCityContext(cityId);
  const typeFilter = Array.isArray(docType) ? { $in: docType } : docType;
  const docs = await context.collection
    .find(cityScopedFilter(context.city, cityId, { docType: typeFilter }))
    .sort({ sortOrder: 1, name: 1 })
    .toArray();
  return docs.map((doc) => ({ ...doc, cityId: context.cityId }));
}

async function findCityDoc(docType, id, requestedCityId) {
  const cities = requestedCityId
    ? [await requireCity(requestedCityId)]
    : await City.find({}).sort({ id: 1 }).lean();

  for (const city of cities) {
    const cityId = stringId(city).toLocaleLowerCase();
    const context = await getCityContext(cityId);
    const doc = await context.collection.findOne(cityDocumentFilter(city, cityId, id, docType));
    if (doc) return { city: { ...city, id: cityId }, collection: context.collection, doc };
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
    group: input.group,
    serviceMode: input.serviceMode,
    name: input.name ?? "",
    highlightNumber: input.highlightNumber ?? "",
    category: input.category ?? "",
    subtitle: input.subtitle ?? "",
    description: input.description ?? "",
    distanceOrHours: input.distanceOrHours ?? "",
    phone: input.phone ?? input.contactNumber ?? "",
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
    docType: "app_guide",
    cityId,
    appName: input.appName ?? input.name ?? "",
    taskCategory: input.taskCategory ?? input.category ?? "",
    description: input.description ?? "",
    howToUse: input.howToUse ?? "",
    highlightTag: input.highlightTag ?? "",
    iconUrl: input.iconUrl ?? "",
    iconKey: input.iconKey ?? "",
    playStoreUrl: input.playStoreUrl ?? input.storeUrl ?? "",
    packageName: input.packageName ?? "",
    websiteUrl: input.websiteUrl ?? "",
    sortOrder: input.sortOrder ?? 0,
  };
}

async function listCities(_req, res) {
  const cities = await City.find({}).sort({ name: 1 }).lean();
  res.status(200).json(cities.map(cityJson));
}

async function createCity(req, res) {
  const id = req.body.id.trim().toLocaleLowerCase();
  const city = await City.create({
    ...req.body,
    id,
    heroImageUrl: req.body.heroImageUrl ?? null,
    promoBanner: req.body.promoBanner === undefined
      ? null
      : normalizedPromoBanner(req.body.promoBanner, id),
    collectionName: `city_${id}`,
  });
  emit(req, "cities", id);
  res.status(201).json(cityJson(city.toObject()));
}

async function updateCity(req, res) {
  const existing = await requireCity(req.params.cityId);
  const cityId = stringId(existing).toLocaleLowerCase();
  const updates = { ...req.body, collectionName: `city_${cityId}` };
  if (Object.prototype.hasOwnProperty.call(req.body, "promoBanner")) {
    updates.promoBanner = normalizedPromoBanner(req.body.promoBanner, cityId, existing.promoBanner);
  }
  const city = await City.findOneAndUpdate(
    cityLookupFilter(req.params.cityId),
    { $set: updates },
    { new: true, runValidators: true }
  ).lean();
  if (!city) throw new ApiError(404, "City not found.");
  emit(req, "cities", stringId(city).toLocaleLowerCase());
  res.status(200).json(cityJson(city));
}

async function deleteCity(req, res) {
  const city = await requireCity(req.params.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  const context = await getCityContext(cityId);
  await Promise.all([
    context.collection.deleteMany(cityScopedFilter(city, cityId)),
    Category.deleteMany(cityIdFilter(city, cityId)),
    MapCategory.deleteMany(cityIdFilter(city, cityId)),
  ]);
  await City.deleteOne(cityLookupFilter(cityId));
  emit(req, "cities", cityId);
  res.status(204).end();
}

async function getHome(req, res) {
  const city = await requireCity(req.params.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  const context = await getCityContext(cityId);
  const places = await context.collection.find(cityScopedFilter(city, cityId, {
      docType: "place",
      isPopular: true,
    })).sort({ name: 1 }).toArray();
  res.status(200).json(homeJson(city, places));
}

async function updateHome(req, res) {
  const existing = await requireCity(req.params.cityId);
  const cityId = stringId(existing).toLocaleLowerCase();
  const updates = { collectionName: `city_${cityId}` };
  if (req.body.cityName !== undefined) updates.name = req.body.cityName;
  if (req.body.heroSubtitle !== undefined) updates.heroSubtitle = req.body.heroSubtitle;
  if (req.body.headerImageUrl !== undefined) updates.heroImageUrl = req.body.headerImageUrl;
  if (Object.prototype.hasOwnProperty.call(req.body, "promoBanner")) {
    updates.promoBanner = normalizedPromoBanner(
      req.body.promoBanner,
      cityId,
      existing.promoBanner
    );
  }
  const city = await City.findOneAndUpdate(
    cityLookupFilter(cityId),
    { $set: updates },
    { new: true, runValidators: true }
  ).lean();
  if (!city) throw new ApiError(404, "City not found.");
  const context = await getCityContext(cityId);
  const places = await context.collection.find(cityScopedFilter(city, cityId, {
    docType: "place",
    isPopular: true,
  })).sort({ name: 1 }).toArray();
  emit(req, "home", cityId);
  res.status(200).json(homeJson(city, places));
}

async function listCategories(req, res) {
  const filter = {};
  let cities = [];
  if (req.query.cityId) {
    const city = await requireCity(req.query.cityId);
    filter.$and = [cityIdFilter(city, req.query.cityId)];
    cities = [city];
  } else {
    cities = await City.find({}).select("id").lean();
  }
  if (req.query.category) filter.category = req.query.category;
  const docs = await Category.find(filter).sort({ cityId: 1, category: 1 }).lean();
  const canonicalCityId = (value) => {
    const match = cities.find((city) =>
      String(city.id || "").toLocaleLowerCase() === String(value || "").toLocaleLowerCase() ||
      String(city._id || "").toLocaleLowerCase() === String(value || "").toLocaleLowerCase()
    );
    return match ? stringId(match).toLocaleLowerCase() : String(value || "");
  };
  res.status(200).json(docs.map((doc) => categoryJson(doc, canonicalCityId(doc.cityId))));
}

async function createCategory(req, res) {
  const city = await requireCity(req.body.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  const category = await Category.create({
    id: req.body.id || `${cityId}_${req.body.category.toLocaleLowerCase()}`,
    cityId,
    category: req.body.category,
    title: req.body.title,
    subCategories: req.body.subCategories || [],
  });
  emit(req, "categories", cityId);
  res.status(201).json(categoryJson(category));
}

async function updateCategory(req, res) {
  const category = await Category.findOneAndUpdate(
    documentIdFilter(req.params.id),
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();
  if (!category) throw new ApiError(404, "Category not found.");
  const cityId = (await getCityContext(category.cityId)).cityId;
  emit(req, "categories", cityId);
  res.status(200).json(categoryJson(category, cityId));
}

async function deleteCategory(req, res) {
  const category = await Category.findOneAndDelete(documentIdFilter(req.params.id)).lean();
  if (!category) throw new ApiError(404, "Category not found.");
  const cityId = (await getCityContext(category.cityId)).cityId;
  emit(req, "categories", cityId);
  res.status(204).end();
}

function mapCategoryJson(category) {
  return {
    id: stringId(category),
    _id: mongoId(category),
    cityId: category.cityId || "",
    name: category.name || "",
    sortOrder: category.sortOrder ?? 0,
    type: "MAP",
  };
}

async function listMapCategories(req, res) {
  const context = await getCityContext(req.query.cityId);
  const categories = await MapCategory.find(cityIdFilter(context.city, req.query.cityId))
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  res.status(200).json(categories.map((category) =>
    mapCategoryJson({ ...category, cityId: context.cityId })
  ));
}

async function createMapCategory(req, res) {
  const city = await requireCity(req.body.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  const name = req.body.name.trim();
  const category = await MapCategory.create({
    id: req.body.id || generatedId("mapcat"),
    cityId,
    name,
    sortOrder: req.body.sortOrder ?? 0,
  });
  emit(req, "map_categories", cityId);
  res.status(201).json(mapCategoryJson(category));
}

async function updateMapCategory(req, res) {
  const patch = { ...req.body };
  if (patch.name !== undefined) patch.name = patch.name.trim();
  const category = await MapCategory.findOneAndUpdate(
    documentIdFilter(req.params.id),
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
  if (!category) throw new ApiError(404, "Map sub-category not found.");
  const cityId = (await getCityContext(category.cityId)).cityId;
  emit(req, "map_categories", cityId);
  res.status(200).json(mapCategoryJson({ ...category, cityId }));
}

async function deleteMapCategory(req, res) {
  const category = await MapCategory.findOneAndDelete(documentIdFilter(req.params.id)).lean();
  if (!category) throw new ApiError(404, "Map sub-category not found.");
  const cityId = (await getCityContext(category.cityId)).cityId;
  emit(req, "map_categories", cityId, "DELETE");
  res.status(204).end();
}

async function listPlaces(req, res) {
  const cityIds = req.query.cityId
    ? [req.query.cityId]
    : (await City.find({}).select("id").lean()).map(stringId);
  const docs = (await Promise.all(cityIds.map((cityId) => cityDocs(cityId, "place")))).flat();
  res.status(200).json(docs.map(placeJson));
}

async function createPlace(req, res) {
  const city = await requireCity(req.body.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  const doc = normalizePlace(req.body, cityId, req.body.id || generatedId("plc"));
  const collection = await getCityCollection(cityId);
  await collection.insertOne(doc);
  emit(req, "places", cityId, req.method);
  if (doc.isPopular) emit(req, "home", cityId);
  res.status(201).json(placeJson(doc));
}

async function updatePlace(req, res) {
  const found = await findCityDoc("place", req.params.id, req.body.cityId);
  const patch = { ...req.body };
  delete patch.cityId;
  delete patch.id;
  delete patch.docType;
  if (!found.doc.id) patch.id = req.params.id;
  if (patch.category !== undefined) {
    const normalized = String(patch.category).toUpperCase();
    patch.category = CATEGORY_VALUES.includes(normalized) ? normalized : "HERITAGE";
  }
  const result = await found.collection.findOneAndUpdate(
    cityDocumentFilter(found.city, found.city.id, req.params.id, "place"),
    { $set: patch },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) throw new ApiError(404, "Place not found.");
  emit(req, "places", found.city.id, req.method);
  if (found.doc.isPopular || patch.isPopular === true) emit(req, "home", found.city.id);
  res.status(200).json(placeJson(doc, stringId(found.city).toLocaleLowerCase()));
}

async function deletePlace(req, res) {
  const found = await findCityDoc("place", req.params.id, req.query.cityId);
  await found.collection.deleteOne(
    cityDocumentFilter(found.city, found.city.id, req.params.id, "place")
  );
  emit(req, "places", found.city.id, req.method);
  if (found.doc.isPopular) emit(req, "home", found.city.id);
  res.status(204).end();
}

async function listCityContent(req, res, docType, serializer) {
  const cityIds = req.query.cityId
    ? [req.query.cityId]
    : (await City.find({}).select("id").lean()).map(stringId);
  const docs = (await Promise.all(cityIds.map((cityId) => cityDocs(cityId, docType)))).flat();
  res.status(200).json(docs.map(serializer));
}

async function createCityContent(req, res, docType, scope, normalizer, serializer) {
  const city = await requireCity(req.body.cityId);
  const cityId = stringId(city).toLocaleLowerCase();
  let doc = normalizer(req.body, cityId, req.body.id || generatedId(docType === "app_guide" ? "app" : "svc"));
  if (docType === "service") doc = await validateServiceDocument(doc);
  const collection = await getCityCollection(cityId);
  await collection.insertOne(doc);
  emit(req, scope, cityId);
  res.status(201).json(serializer(doc));
}

async function updateCityContent(req, res, docType, scope, normalizer, serializer, lookupDocTypes = docType) {
  const found = await findCityDoc(lookupDocTypes, req.params.id, req.body.cityId);
  const patchInput = { ...req.body };
  delete patchInput.cityId;
  delete patchInput.id;
  delete patchInput.docType;
  const documentId = stringId(found.doc) || req.params.id;
  let normalized = normalizer({ ...found.doc, ...patchInput }, stringId(found.city).toLocaleLowerCase(), documentId);
  if (docType === "service") normalized = await validateServiceDocument(normalized);
  if (found.doc.id) delete normalized.id;
  if (normalized._id) delete normalized._id;
  const result = await found.collection.findOneAndUpdate(
    cityDocumentFilter(found.city, found.city.id, req.params.id, found.doc.docType),
    { $set: normalized },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) throw new ApiError(404, `${docType} not found.`);
  const cityId = stringId(found.city).toLocaleLowerCase();
  emit(req, scope, cityId);
  res.status(200).json(serializer(doc, cityId));
}

async function deleteCityContent(req, res, docType, scope) {
  const found = await findCityDoc(docType, req.params.id, req.query.cityId);
  await found.collection.deleteOne(
    cityDocumentFilter(found.city, found.city.id, req.params.id, docType)
  );
  emit(req, scope, stringId(found.city).toLocaleLowerCase());
  res.status(204).end();
}

const listServices = (req, res) => listCityContent(req, res, "service", serviceJson);
const createService = (req, res) => createCityContent(req, res, "service", "services", normalizeService, serviceJson);
const updateService = (req, res) => updateCityContent(req, res, "service", "services", normalizeService, serviceJson);
const deleteService = (req, res) => deleteCityContent(req, res, "service", "services");

const listApps = (req, res) => listCityContent(req, res, ["app_guide", "app"], appJson);
const createApp = (req, res) => createCityContent(req, res, "app_guide", "app_guides", normalizeApp, appJson);
const updateApp = (req, res) => updateCityContent(
  req, res, "app_guide", "app_guides", normalizeApp, appJson, ["app_guide", "app"]
);
const deleteApp = (req, res) => deleteCityContent(req, res, ["app_guide", "app"], "app_guides");

async function listTips(req, res) {
  const context = req.query.cityId ? await getCityContext(req.query.cityId) : null;
  const filter = context ? cityIdFilter(context.city, req.query.cityId) : {};
  const tips = await Tip.find(filter).sort({ timestamp: -1 }).lean();
  res.status(200).json(tips.map((tip) => ({
    id: stringId(tip),
    _id: mongoId(tip),
    cityId: tip.cityId || "",
    placeId: tip.placeId || "",
    placeName: tip.placeName || "",
    note: tip.note || "",
    rating: tip.rating ?? 0,
    timestamp: tip.timestamp ?? 0,
  })));
}

async function deleteTip(req, res) {
  const tip = await Tip.findOneAndDelete(documentIdFilter(req.params.id)).lean();
  if (!tip) throw new ApiError(404, "Tip not found.");
  emit(req, "tips", tip.cityId || "");
  res.status(204).end();
}

module.exports = {
  listCities, createCity, updateCity, deleteCity,
  getHome, updateHome,
  listCategories, createCategory, updateCategory, deleteCategory,
  listMapCategories, createMapCategory, updateMapCategory, deleteMapCategory,
  listPlaces, createPlace, updatePlace, deletePlace,
  listServices, createService, updateService, deleteService,
  listApps, createApp, updateApp, deleteApp,
  listTips, deleteTip,
};
