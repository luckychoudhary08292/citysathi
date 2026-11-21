const City = require("../models/City");
const Place = require("../models/Place");
const PromoBanner = require("../models/PromoBanner");
const CityService = require("../models/CityService");
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
    tags: place.tags,
    subCategories: place.subCategories,
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
    const cities = await City.find({}).sort({ name: 1 });
    res.status(200).json(
      cities.map((city) => ({
        id: city.id,
        name: city.name,
        state: city.state,
        latitude: city.latitude,
        longitude: city.longitude,
        heroImageUrl: city.heroImageUrl,
        collectionName: city.collectionName || `${city.id}_places`,
      }))
    );
  } catch (error) {
    next(error);
  }
}

async function cityHome(req, res, next) {
  try {
    const city = await City.findOne({ id: req.params.cityId });
    if (!city) throw new ApiError(404, "City not found");

    const [popularPlaces, promo] = await Promise.all([
      Place.find({ cityId: city.id, isPopular: true }).sort({ rating: -1 }),
      PromoBanner.findOne({ cityId: city.id }),
    ]);

    res.status(200).json({
      cityId: city.id,
      cityName: city.name,
      heroSubtitle: `Unforgettable journeys in ${city.name},\ncreated for you.`,
      headerImageUrl: city.heroImageUrl,
      popularPlaces: popularPlaces.map(placeJson),
      promoBanner: promo
        ? {
            id: promo.id,
            badgeText: promo.badgeText,
            title: promo.title,
            subtitle: promo.subtitle,
            ctaLabel: promo.ctaLabel,
            imageUrl: promo.imageUrl,
            targetRoute: promo.targetRoute,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

async function explore(req, res, next) {
  try {
    const city = await City.findOne({ id: req.params.cityId });
    if (!city) throw new ApiError(404, "City not found");

    const { category, subCategory, q } = req.query;
    const filter = { cityId: city.id };
    if (category) filter.category = category;

    const andFilters = [];
    if (subCategory) {
      const escaped = subCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      andFilters.push({ $or: [{ subCategories: regex }, { tags: regex }] });
    }
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      andFilters.push({
        $or: [{ name: regex }, { subtitle: regex }, { tags: regex }, { subCategories: regex }],
      });
    }
    if (andFilters.length) filter.$and = andFilters;

    const places = await Place.find(filter).sort({ rating: -1, name: 1 });
    const subCategoryFilter = { cityId: city.id };
    if (category) subCategoryFilter.category = category;
    const categoryPlaces = await Place.find(subCategoryFilter).select("subCategories");
    const subCategories = [
      ...new Set(categoryPlaces.flatMap((place) => place.subCategories || [])),
    ].sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      cityId: city.id,
      category: category || null,
      subCategories,
      places: places.map(placeJson),
    });
  } catch (error) {
    next(error);
  }
}

const mapFilters = {
  ATM: { placeCategories: ["ATM"], serviceGroups: [] },
  HOSPITALS: { placeCategories: ["HOSPITAL"], serviceGroups: [] },
  PHARMACY: { placeCategories: ["PHARMACY"], serviceGroups: ["PHARMACY"] },
  FOOD: { placeCategories: ["FOOD"], serviceGroups: [] },
  TRANSPORT: { placeCategories: ["TRANSPORT"], serviceGroups: ["TRANSPORT"] },
  EMERGENCY: { placeCategories: ["EMERGENCY"], serviceGroups: ["EMERGENCY"] },
  PLACES: { placeCategories: null, serviceGroups: [] },
};

async function mapServices(req, res, next) {
  try {
    const city = await City.findOne({ id: req.params.cityId });
    if (!city) throw new ApiError(404, "City not found");

    const filterName = req.query.filter;
    const selected = filterName ? mapFilters[filterName.toUpperCase()] : null;
    if (filterName && !selected) {
      throw new ApiError(400, "filter must be ATM, HOSPITALS, PHARMACY, FOOD, TRANSPORT, EMERGENCY, or PLACES");
    }

    const placeQuery = { cityId: city.id };
    const serviceQuery = { cityId: city.id };
    if (selected) {
      if (selected.placeCategories) placeQuery.category = { $in: selected.placeCategories };
      else if (filterName.toUpperCase() !== "PLACES") placeQuery.category = { $in: [] };
      if (selected.serviceGroups.length) serviceQuery.group = { $in: selected.serviceGroups };
      else serviceQuery.group = { $in: [] };
    }

    const [places, services] = await Promise.all([
      Place.find(placeQuery).sort({ name: 1 }),
      CityService.find(serviceQuery).sort({ name: 1 }),
    ]);

    res.status(200).json({
      cityId: city.id,
      places: places.map(placeJson),
      services: services.map(serviceJson),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCities, cityHome, explore, mapServices, placeJson, serviceJson };
