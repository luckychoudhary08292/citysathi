const City = require("../models/City");
const Category = require("../models/Category");
const { getCityCollection } = require("../utils/cityCollection");
const { ApiError } = require("../middleware/error");

function placeJson(place) {
  return {
    id: place.id,
    cityId: place.cityId,
    name: place.name,
    subtitle: place.subtitle,
    category: place.category,
    rating: place.rating,
    reviewCountLabel: place.reviewCountLabel,
    distanceLabel: place.distanceLabel,
    tags: place.tags || [],
    subCategories: place.subCategories || [],
    description: place.description,
    openHours: place.openHours,
    phone: place.phone,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    imageUrl: place.imageUrl,
    isPopular: place.isPopular,
    isTrending: place.isTrending,
  };
}

function serviceJson(service) {
  return {
    id: service.id,
    cityId: service.cityId,
    group: service.group,
    name: service.name,
    subtitle: service.subtitle,
    distanceOrHours: service.distanceOrHours,
    latitude: service.latitude,
    longitude: service.longitude,
    phone: service.phone,
  };
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
      cityId: home.cityId,
      cityName: home.cityName,
      heroSubtitle: home.heroSubtitle,
      headerImageUrl: home.headerImageUrl,
      popularPlaces: popularPlaces.map(placeJson),
      promoBanner: home.promoBanner,
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
        $or: [{ name: regex }, { subtitle: regex }, { tags: regex }, { subCategories: regex }],
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
  ATM: { categories: ["ATM"], groups: [] },
  HOSPITALS: { categories: ["HOSPITAL"], groups: [] },
  PHARMACY: { categories: ["PHARMACY"], groups: ["PHARMACY"] },
  FOOD: { categories: ["FOOD"], groups: [] },
  TRANSPORT: { categories: ["TRANSPORT"], groups: ["TRANSPORT"] },
  EMERGENCY: { categories: ["EMERGENCY"], groups: ["EMERGENCY"] },
  PLACES: { categories: null, groups: [] },
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

    const placeFilter = { docType: "place", cityId };
    const serviceFilter = { docType: "service", cityId };
    if (selected) {
      if (selected.categories) placeFilter.category = { $in: selected.categories };
      if (selected.groups.length) serviceFilter.group = { $in: selected.groups };
      else serviceFilter.group = { $in: [] };
    }

    const [places, services] = await Promise.all([
      collection.find(placeFilter).sort({ name: 1 }).toArray(),
      collection.find(serviceFilter).sort({ name: 1 }).toArray(),
    ]);

    res.status(200).json({
      cityId,
      places: places.map(placeJson),
      services: services.map(serviceJson),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCities, categories, cityHome, explore, mapServices, placeJson, serviceJson };
