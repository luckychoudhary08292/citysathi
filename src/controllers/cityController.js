const City = require("../models/City");
const Category = require("../models/Category");
const MapCategory = require("../models/MapCategory");
const {
  getCityContext,
  cityIdFilter,
  cityScopedFilter,
} = require("../utils/cityCollection");
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
    phone: service.phone || service.contactNumber || "",
    contactNumber: service.contactNumber || service.phone || service.number || "",
    address: service.address || "",
    iconKey: service.iconKey || "",
    isUrgent: Boolean(service.isUrgent),
    sortOrder: service.sortOrder || 0,
    latitude: service.latitude || 0,
    longitude: service.longitude || 0,
    actionUrl: service.actionUrl ?? null,
    serviceMode: service.serviceMode || "",
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
    highlightTag: app.highlightTag || "",
    iconUrl: app.iconUrl || "",
    iconKey: app.iconKey || "",
    playStoreUrl: app.playStoreUrl || "",
    packageName: app.packageName || "",
    websiteUrl: app.websiteUrl || "",
    sortOrder: app.sortOrder || 0,
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
  const context = await getCityContext(cityId);
  const typeFilter = Array.isArray(docType) ? { $in: docType } : docType;
  const sort = Array.isArray(docType)
    ? { sortOrder: 1, appName: 1 }
    : { sortOrder: 1, name: 1 };
  return {
    context,
    docs: await context.collection
      .find(cityScopedFilter(context.city, cityId, { docType: typeFilter }))
      .sort(sort)
      .toArray(),
  };
}

function categoryJson(doc, cityId = doc.cityId || "") {
  const subCategories = stringArray(doc.subCategories);
  const id = stringId(doc);
  const name = doc.name || doc.category || "";
  const title = doc.title || name;
  return {
    id,
    _id: mongoId(doc),
    cityId,
    category: doc.category || "",
    name,
    title,
    label: doc.label || title,
    type: doc.type || (doc.category === "MAP" ? "MAP" : "EXPLORE"),
    subCategories,
    items: stringArray(doc.items).length ? stringArray(doc.items) : subCategories,
  };
}

async function listCities(_req, res, next) {
  try {
    const cities = await City.find({}).sort({ name: 1 }).lean();
    res.status(200).json(
      cities.map((city) => ({
        id: stringId(city).toLocaleLowerCase(),
        _id: mongoId(city),
        name: city.name || "",
        state: city.state || "",
        latitude: city.latitude ?? 0,
        longitude: city.longitude ?? 0,
        heroImageUrl: city.heroImageUrl ?? null,
        collectionName: `city_${stringId(city).toLocaleLowerCase()}`,
      }))
    );
  } catch (error) {
    next(error);
  }
}

async function cityHome(req, res, next) {
  try {
    const context = await getCityContext(req.params.cityId);
    const cityId = context.cityId;
    const city = context.city;
    const popularPlaces = await context.collection
      .find(cityScopedFilter(city, req.params.cityId, {
        docType: "place",
        isPopular: true,
      }))
      .sort({ name: 1 })
      .toArray();
    const heroSubtitle = (city.heroSubtitle ||
      "Unforgettable journeys in {city},\ncreated for you.")
      .replace(/\{city\}/gi, city.name);
    res.status(200).json({
      cityId,
      cityName: city.name || "",
      heroSubtitle,
      headerImageUrl: city.heroImageUrl ?? null,
      popularPlaces: popularPlaces.map((place) => placeJson(place, cityId)),
      promoBanner: promoJson(city.promoBanner),
    });
  } catch (error) {
    next(error);
  }
}

async function categories(_req, res, next) {
  try {
    const requestedCityId = _req.query.cityId;
    const context = requestedCityId ? await getCityContext(requestedCityId) : null;
    const cityFilter = context
      ? cityIdFilter(context.city, requestedCityId)
      : null;
    const categoryName = _req.query.category;
    const exploreFilter = {};
    if (cityFilter) exploreFilter.$and = [cityFilter];
    if (categoryName) exploreFilter.category = categoryName;

    const [exploreDocs, mapDocs, cities] = await Promise.all([
      Category.find(exploreFilter).sort({ cityId: 1, category: 1 }).lean(),
      !categoryName || categoryName === "MAP"
        ? MapCategory.find(cityFilter || {}).sort({ sortOrder: 1, name: 1 }).lean()
        : [],
      context ? [context.city].filter(Boolean) : City.find({}).select("id").lean(),
    ]);
    const canonicalCityId = (value) => {
      if (context) return context.cityId;
      const match = cities.find((city) =>
        String(city.id || "").toLocaleLowerCase() === String(value || "").toLocaleLowerCase() ||
        String(city._id || "").toLocaleLowerCase() === String(value || "").toLocaleLowerCase()
      );
      return match ? String(match.id || match._id).toLocaleLowerCase() : String(value || "");
    };
    const results = exploreDocs.map((doc) => categoryJson(doc, canonicalCityId(doc.cityId)));
    results.push(...mapDocs.map((doc) => ({
      id: stringId(doc),
      _id: mongoId(doc),
      cityId: canonicalCityId(doc.cityId),
      category: "MAP",
      name: doc.name || "",
      title: doc.name || "",
      label: doc.name || "",
      type: "MAP",
      subCategories: [],
      items: [],
      sortOrder: doc.sortOrder ?? 0,
    })));
    results.sort((left, right) =>
      left.cityId.localeCompare(right.cityId) ||
      left.category.localeCompare(right.category) ||
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
      left.name.localeCompare(right.name)
    );
    res.status(200).json(results.map(({ sortOrder, ...category }) => category));
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
    const context = await getCityContext(cityId);
    const categoryFilter = { $and: [cityIdFilter(context.city, cityId)] };
    if (category) categoryFilter.category = category;

    const categoryDocs = await Category.find(categoryFilter).select("subCategories").lean();
    const subCategories = [...new Set(categoryDocs.flatMap((doc) => stringArray(doc.subCategories)))]
      .sort((a, b) => a.localeCompare(b));

    const filters = [cityIdFilter(context.city, cityId), { docType: "place" }];
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

    const places = await context.collection
      .find(filters.length === 1 ? filters[0] : { $and: filters })
      .sort({ rating: -1, name: 1 })
      .toArray();

    res.status(200).json({
      cityId: context.cityId,
      category: category || null,
      subCategories,
      places: places.map((place) => placeJson(place, context.cityId)),
    });
  } catch (error) {
    next(error);
  }
}

async function mapServices(req, res, next) {
  try {
    const requestedCityId = req.params.cityId;
    const context = await getCityContext(requestedCityId);
    const { collection, cityId } = context;
    const filterName = req.query.filter?.trim();

    const [allPlaces, allServices, apps, mapCategories] = await Promise.all([
      collection.find(cityScopedFilter(context.city, requestedCityId, { docType: "place" })).sort({ name: 1 }).toArray(),
      collection.find(cityScopedFilter(context.city, requestedCityId, { docType: "service" })).sort({ sortOrder: 1, name: 1 }).toArray(),
      collection.find(cityScopedFilter(context.city, requestedCityId, {
        docType: { $in: ["app_guide", "app"] },
      })).sort({ sortOrder: 1, appName: 1 }).toArray(),
      MapCategory.find(cityIdFilter(context.city, requestedCityId)).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const configuredMapSubCategories = mapCategories
      .map((item) => item.name)
      .filter((name) =>
        typeof name === "string" && name.trim() && name.trim().toLocaleLowerCase() !== "all"
      )
      .map((name) => name.trim());
    const mapSubCategories = configuredMapSubCategories.length
      ? configuredMapSubCategories
      : deriveMapSubCategories(allServices);
    const filterNeedle = filterName && filterName.toUpperCase() === "HOSPITALS"
      ? "HOSPITAL"
      : filterName;
    const matchesMapFilter = (values) => {
      if (!filterNeedle || ["ALL", "PLACES"].includes(filterNeedle.toUpperCase())) return true;
      const normalizedNeedle = filterNeedle.trim().toLocaleLowerCase();
      return values.some((value) =>
        typeof value === "string" && value.toLocaleLowerCase().includes(normalizedNeedle)
      );
    };
    const places = !filterNeedle || ["ALL", "PLACES"].includes(filterNeedle.toUpperCase())
      ? allPlaces
      : allPlaces.filter((place) => matchesMapFilter([
          place.category, place.subCategory, ...stringArray(place.subCategories),
          ...stringArray(place.tags), place.name, place.subtitle,
        ]));
    const services = !filterNeedle || filterNeedle.toUpperCase() === "ALL"
      ? allServices
      : filterNeedle.toUpperCase() === "PLACES"
        ? []
      : allServices.filter((service) => matchesMapFilter([
          service.category, service.subCategory, ...stringArray(service.subCategories),
          ...stringArray(service.tags), service.group, service.name, service.title, service.subtitle,
        ]));
    const cityApps = apps.map((app) => appJson(app, cityId));

    res.status(200).json({
      cityId,
      mapsApiKey: getMapsApiKey(),
      mapSubCategories,
      places: places.map((place) => placeJson(place, cityId)),
      services: services.map((service) => serviceJson(service, cityId)),
      cityApps,
    });
  } catch (error) {
    next(error);
  }
}

function deriveMapSubCategories(services) {
  const names = new Set();
  const seen = new Set();
  const genericNames = new Set([
    "general", "contact", "helpline", "sos", "service", "services", "service name", "all",
  ]);
  for (const service of services) {
    if (service.serviceMode !== "SERVICE_NAME") continue;
    const category = String(service.category || "").trim();
    const name = ["service", "service name"].includes(category.toLocaleLowerCase())
      ? String(service.name || "").trim()
      : category;
    const normalized = name.toLocaleLowerCase();
    if (name && !genericNames.has(normalized) && !seen.has(normalized)) {
      names.add(name);
      seen.add(normalized);
    }
  }
  return [...names];
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
    const { context, docs } = await cityCollectionDocs(cityId, "service");
    res.status(200).json(docs.map((doc) => serviceJson(doc, context.cityId)));
  } catch (error) {
    next(error);
  }
}

async function listApps(req, res, next) {
  try {
    const cityId = req.params.cityId || req.query.cityId;
    const { context, docs } = await cityCollectionDocs(cityId, ["app_guide", "app"]);
    res.status(200).json(docs.map((doc) => appJson(doc, context.cityId)));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCities, categories, cityHome, explore, mapServices, listServices, listApps, mapConfig,
  placeJson, serviceJson, appJson, promoJson, categoryJson,
};
