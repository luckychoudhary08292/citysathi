const City = require("../models/City");
const Category = require("../models/Category");
const MapCategory = require("../models/MapCategory");
const { getCityCollection } = require("../utils/cityCollection");
const { ApiError } = require("../middleware/error");
const { stringId, mongoId, stringArray } = require("../utils/serialization");

function placeJson(place, cityId = place.cityId || "") {
  return {
    id: stringId(place),
    _id: mongoId(place),
    cityId,
    name: place.name || "",
    subtitle: place.subtitle || "",
    category: place.category || "HERITAGE",
    rating: place.rating ?? 4.5,
    reviewCountLabel: place.reviewCountLabel || "100+ Reviews",
    distanceLabel: place.distanceLabel || "1.2 km",
    tags: stringArray(place.tags),
    description: place.description || "",
    openHours: place.openHours || "Open Daily",
    phone: place.phone || "",
    contactNumber: place.contactNumber || place.phone || "",
    address: place.address || "",
    latitude: place.latitude ?? 0,
    longitude: place.longitude ?? 0,
    imageUrl: place.imageUrl ?? null,
    isPopular: place.isPopular ?? true,
    isTrending: place.isTrending ?? false,
    subCategory: place.subCategory || "",
    subCategories: stringArray(place.subCategories),
  };
}

function serviceJson(service, cityId = service.cityId || "") {
  return {
    id: stringId(service),
    _id: mongoId(service),
    cityId,
    name: service.name || "",
    highlightNumber: service.highlightNumber || "",
    category: service.category || "",
    subtitle: service.subtitle || "",
    description: service.description || "",
    distanceOrHours: service.distanceOrHours || "",
    phone: service.phone || service.contactNumber || service.number || null,
    contactNumber: service.contactNumber || service.phone || service.number || "",
    address: service.address || "",
    iconKey: service.iconKey || "",
    isUrgent: Boolean(service.isUrgent),
    sortOrder: service.sortOrder || 0,
    latitude: service.latitude || 0,
    longitude: service.longitude || 0,
    actionUrl: service.actionUrl ?? null,
    title: service.title || "",
    number: service.number || "",
    badgeNumber: service.badgeNumber || "",
    group: service.group || "",
  };
}

function appJson(app, cityId = app.cityId || "") {
  return {
    id: stringId(app),
    _id: mongoId(app),
    cityId,
    appName: app.appName || "",
    taskCategory: app.taskCategory || "",
    description: app.description || "",
    howToUse: app.howToUse || "",
    highlightTag: app.highlightTag ?? null,
    iconUrl: app.iconUrl ?? null,
    iconKey: app.iconKey || "",
    playStoreUrl: app.playStoreUrl ?? null,
    packageName: app.packageName ?? null,
    websiteUrl: app.websiteUrl ?? null,
    sortOrder: app.sortOrder || 0,
    name: app.name || "",
    task: app.task || "",
    category: app.category || "",
    badge: app.badge ?? null,
    storeUrl: app.storeUrl ?? null,
  };
}

function promoJson(promo) {
  if (!promo) return null;
  return {
    id: stringId(promo) || "promo_banner",
    badgeText: promo.badgeText || "FEATURED",
    title: promo.title || "",
    subtitle: promo.subtitle || "",
    ctaLabel: promo.ctaLabel || "Plan Trip",
    imageUrl: promo.imageUrl ?? null,
    targetRoute: promo.targetRoute || "plan_trip",
  };
}

async function cityCollectionDocs(cityId, docType) {
  const collection = await getCityCollection(cityId);
  return collection.find({ cityId, docType }).sort({ sortOrder: 1, name: 1 }).toArray();
}

function categoryJson(doc) {
  const subCategories = stringArray(doc.subCategories);
  const id = stringId(doc);
  const name = doc.name || doc.category || "";
  const title = doc.title || name;
  return {
    id,
    _id: mongoId(doc),
    cityId: doc.cityId || "",
    category: doc.category || "",
    name,
    title,
    label: doc.label || title,
    type: doc.type || "EXPLORE",
    subCategories,
    items: stringArray(doc.items).length ? stringArray(doc.items) : subCategories,
  };
}

async function listCities(_req, res, next) {
  try {
    const cities = await City.find({}).sort({ name: 1 }).lean();
    res.status(200).json(
      cities.map((city) => ({
        id: stringId(city),
        _id: mongoId(city),
        name: city.name || "",
        state: city.state || "",
        latitude: city.latitude ?? 0,
        longitude: city.longitude ?? 0,
        heroImageUrl: city.heroImageUrl ?? null,
        collectionName: city.collectionName || `city_${stringId(city)}`,
      }))
    );
  } catch (error) {
    next(error);
  }
}

async function cityHome(req, res, next) {
  try {
    const collection = await getCityCollection(req.params.cityId);
    const [home, popularPlaces] = await Promise.all([
      collection.findOne({ id: "home_meta", docType: "home_meta" }),
      collection
        .find({ docType: "place", cityId: req.params.cityId, isPopular: true })
        .sort({ rating: -1 })
        .toArray(),
    ]);

    if (!home) throw new ApiError(404, "City home not found");
    res.status(200).json({
      cityId: req.params.cityId,
      cityName: home.cityName || "",
      heroSubtitle: home.heroSubtitle || "",
      headerImageUrl: home.headerImageUrl ?? null,
      popularPlaces: popularPlaces.map((place) => placeJson(place, req.params.cityId)),
      promoBanner: promoJson(home.promoBanner),
    });
  } catch (error) {
    next(error);
  }
}

async function categories(_req, res, next) {
  try {
    const filter = {};
    if (_req.query.cityId) filter.cityId = _req.query.cityId;
    if (_req.query.category) filter.category = _req.query.category;
    const docs = await Category.find(filter).sort({ cityId: 1, category: 1 }).lean();
    res.status(200).json(
      docs.map((doc) => ({
        ...categoryJson(doc),
      }))
    );
  } catch (error) {
    next(error);
  }
}

function escapedRegex(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

async function explore(req, res, next) {
  try {
    const { cityId } = req.params;
    const { category, subCategory, q } = req.query;
    const collection = await getCityCollection(cityId);
    const categoryFilter = { cityId };
    if (category) categoryFilter.category = category;

    const categoryDocs = await Category.find(categoryFilter).select("subCategories").lean();
    const subCategories = [...new Set(categoryDocs.flatMap((doc) => doc.subCategories || []))]
      .sort((a, b) => a.localeCompare(b));

    const filters = [{ docType: "place", cityId }];
    if (category) filters.push({ category });
    if (subCategory) {
      const regex = escapedRegex(subCategory);
      filters.push({
        $or: [
          { subCategory: regex },
          { subCategories: regex },
          { tags: regex },
        ],
      });
    }
    if (q) {
      const regex = escapedRegex(q);
      filters.push({
        $or: [
          { name: regex },
          { subtitle: regex },
          { description: regex },
          { tags: regex },
          { subCategories: regex },
        ],
      });
    }

    const places = await collection
      .find(filters.length === 1 ? filters[0] : { $and: filters })
      .sort({ rating: -1, name: 1 })
      .toArray();

    res.status(200).json({
      cityId,
      category: category || null,
      subCategories,
      places: places.map((place) => placeJson(place, cityId)),
    });
  } catch (error) {
    next(error);
  }
}

async function mapServices(req, res, next) {
  try {
    const { cityId } = req.params;
    const collection = await getCityCollection(cityId);
    const filterName = req.query.filter?.trim();

    const [allPlaces, allServices, apps, mapCategories] = await Promise.all([
      collection.find({ docType: "place", cityId }).sort({ name: 1 }).toArray(),
      collection.find({ docType: "service", cityId }).sort({ sortOrder: 1, name: 1 }).toArray(),
      collection.find({ docType: "app", cityId }).sort({ sortOrder: 1, appName: 1 }).toArray(),
      MapCategory.find({ cityId }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const configuredMapSubCategories = mapCategories
      .map((item) => item.name)
      .filter((name) => typeof name === "string" && name.trim())
      .map((name) => name.trim());
    const mapSubCategories = configuredMapSubCategories.length
      ? configuredMapSubCategories
      : deriveMapSubCategories(allServices);
    const filterNeedle = filterName && filterName.toUpperCase() === "HOSPITALS"
      ? "HOSPITAL"
      : filterName;
    const matchesMapFilter = (values) => {
      if (!filterNeedle || filterNeedle.toUpperCase() === "PLACES") return true;
      const normalizedNeedle = filterNeedle.trim().toLocaleLowerCase();
      return values.some((value) =>
        typeof value === "string" && value.toLocaleLowerCase().includes(normalizedNeedle)
      );
    };
    const places = !filterNeedle || filterNeedle.toUpperCase() === "PLACES"
      ? allPlaces
      : allPlaces.filter((place) => matchesMapFilter([
          place.category, place.subCategory, ...stringArray(place.subCategories),
          ...stringArray(place.tags), place.name, place.subtitle,
        ]));
    const services = !filterNeedle || filterNeedle.toUpperCase() === "PLACES"
      ? (filterNeedle?.toUpperCase() === "PLACES" ? [] : allServices)
      : allServices.filter((service) => matchesMapFilter([
          service.category, service.group, service.name, service.title, service.subtitle,
        ]));
    const cityApps = apps.map((app) => appJson(app, cityId));

    res.status(200).json({
      cityId,
      mapsApiKey: getMapsApiKey(),
      mapSubCategories,
      places: places.map((place) => placeJson(place, cityId)),
      services: services.map((service) => serviceJson(service, cityId)),
      cityApps,
      apps: cityApps,
    });
  } catch (error) {
    next(error);
  }
}

function deriveMapSubCategories(services) {
  const names = new Map();
  for (const service of services) {
    for (const value of [service.category, service.group, service.name, service.title]) {
      if (typeof value !== "string" || !value.trim()) continue;
      const name = value.trim();
      if (!names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

function getMapsApiKey() {
  return process.env.MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
}

async function mapConfig(_req, res) {
  res.status(200).json({ mapsApiKey: getMapsApiKey(), defaultZoom: 13.5 });
}

async function listServices(req, res, next) {
  try {
    const cityId = req.params.cityId || req.query.cityId;
    const docs = await cityCollectionDocs(cityId, "service");
    res.status(200).json(docs.map((doc) => serviceJson(doc, cityId)));
  } catch (error) {
    next(error);
  }
}

async function listApps(req, res, next) {
  try {
    const cityId = req.params.cityId || req.query.cityId;
    const docs = await cityCollectionDocs(cityId, "app");
    res.status(200).json(docs.map((doc) => appJson(doc, cityId)));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCities, categories, cityHome, explore, mapServices, listServices, listApps, mapConfig,
  placeJson, serviceJson, appJson, promoJson, categoryJson,
};
