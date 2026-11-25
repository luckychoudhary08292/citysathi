const City = require("../models/City");
const Category = require("../models/Category");
const { getCityCollection } = require("../utils/cityCollection");
const { ApiError } = require("../middleware/error");

function placeJson(place) {
  return {
    id: place.id,
    cityId: place.cityId || "",
    name: place.name,
    subtitle: place.subtitle || "",
    category: place.category || "HERITAGE",
    rating: place.rating ?? 4.5,
    reviewCountLabel: place.reviewCountLabel || "100+ Reviews",
    distanceLabel: place.distanceLabel || "1.2 km",
    tags: place.tags || [],
    subCategories: place.subCategories || [],
    description: place.description || "",
    openHours: place.openHours || "Open Daily",
    phone: place.phone || "",
    address: place.address || "",
    latitude: place.latitude ?? 0,
    longitude: place.longitude ?? 0,
    imageUrl: place.imageUrl ?? null,
    isPopular: place.isPopular ?? true,
    isTrending: place.isTrending ?? false,
  };
}

function serviceJson(service) {
  return {
    id: service.id || "",
    cityId: service.cityId || "",
    name: service.name || "",
    title: service.title || "",
    highlightNumber: service.highlightNumber || "",
    number: service.number || "",
    badgeNumber: service.badgeNumber || "",
    category: service.category || "",
    group: service.group || "",
    subtitle: service.subtitle || "",
    description: service.description || "",
    distanceOrHours: service.distanceOrHours || "",
    phone: service.phone ?? null,
    address: service.address || "",
    iconKey: service.iconKey || "",
    isUrgent: Boolean(service.isUrgent),
    sortOrder: service.sortOrder || 0,
    latitude: service.latitude || 0,
    longitude: service.longitude || 0,
    actionUrl: service.actionUrl ?? null,
  };
}

function appJson(app) {
  return {
    id: app.id || "",
    cityId: app.cityId || "",
    appName: app.appName || "",
    name: app.name || "",
    taskCategory: app.taskCategory || "",
    task: app.task || "",
    category: app.category || "",
    description: app.description || "",
    howToUse: app.howToUse || "",
    highlightTag: app.highlightTag ?? null,
    badge: app.badge ?? null,
    iconUrl: app.iconUrl ?? null,
    iconKey: app.iconKey || "",
    playStoreUrl: app.playStoreUrl ?? null,
    storeUrl: app.storeUrl ?? null,
    packageName: app.packageName ?? null,
    websiteUrl: app.websiteUrl ?? null,
    sortOrder: app.sortOrder || 0,
  };
}

function promoJson(promo) {
  if (!promo) return null;
  return {
    id: promo.id || "promo_banner",
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

async function listCities(_req, res, next) {
  try {
    const cities = await City.find({}).sort({ name: 1 }).lean();
    res.status(200).json(
      cities.map((city) => ({
        id: city.id,
        name: city.name,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        heroImageUrl: city.heroImageUrl,
        collectionName: city.collectionName || `city_${city.id}`,
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
      cityId: home.cityId || req.params.cityId,
      cityName: home.cityName || "",
      heroSubtitle: home.heroSubtitle || "",
      headerImageUrl: home.headerImageUrl ?? null,
      popularPlaces: popularPlaces.map(placeJson),
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
        id: doc.id,
        cityId: doc.cityId,
        category: doc.category,
        title: doc.title,
        subCategories: doc.subCategories,
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
      filters.push({ $or: [{ subCategories: regex }, { tags: regex }] });
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
      places: places.map(placeJson),
    });
  } catch (error) {
    next(error);
  }
}

const mapFilters = {
  ATM: { categories: ["ATM"] },
  HOSPITALS: { categories: ["HOSPITAL"] },
  PHARMACY: { categories: ["PHARMACY"] },
  FOOD: { categories: ["FOOD"] },
  TRANSPORT: { categories: ["TRANSPORT"] },
  EMERGENCY: { categories: ["EMERGENCY"] },
  PLACES: { categories: null },
};

async function mapServices(req, res, next) {
  try {
    const { cityId } = req.params;
    const collection = await getCityCollection(cityId);
    const filterName = req.query.filter?.toUpperCase();
    const selected = filterName ? mapFilters[filterName] : null;
    if (filterName && !selected) {
      throw new ApiError(
        400,
        "filter must be ATM, HOSPITALS, PHARMACY, FOOD, TRANSPORT, EMERGENCY, or PLACES"
      );
    }

    const [allPlaces, allServices, apps] = await Promise.all([
      collection.find({ docType: "place", cityId }).sort({ name: 1 }).toArray(),
      collection.find({ docType: "service", cityId }).sort({ sortOrder: 1, name: 1 }).toArray(),
      collection.find({ docType: "app", cityId }).sort({ sortOrder: 1, appName: 1 }).toArray(),
    ]);

    const places = selected && selected.categories
      ? allPlaces.filter((place) => selected.categories.includes(place.category))
      : selected && filterName !== "PLACES" ? [] : allPlaces;
    const serviceNeedle = filterName === "HOSPITALS" ? "HOSPITAL" : filterName;
    const services = selected
      ? allServices.filter((service) => {
          if (!serviceNeedle || serviceNeedle === "PLACES") return false;
          const values = [service.group, service.category, service.name, service.title]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();
          return values.includes(serviceNeedle);
        })
      : allServices;
    const cityApps = apps.map(appJson);

    res.status(200).json({
      cityId,
      places: places.map(placeJson),
      services: services.map(serviceJson),
      cityApps,
      apps: cityApps,
    });
  } catch (error) {
    next(error);
  }
}

async function listServices(req, res, next) {
  try {
    const docs = await cityCollectionDocs(req.params.cityId || req.query.cityId, "service");
    res.status(200).json(docs.map(serviceJson));
  } catch (error) {
    next(error);
  }
}

async function listApps(req, res, next) {
  try {
    const docs = await cityCollectionDocs(req.params.cityId || req.query.cityId, "app");
    res.status(200).json(docs.map(appJson));
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCities, categories, cityHome, explore, mapServices, listServices, listApps,
  placeJson, serviceJson, appJson, promoJson,
};
