const City = require("../models/City");
const Place = require("../models/Place");
const PromoBanner = require("../models/PromoBanner");
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

async function listCities(_req, res) {
  const cities = await City.find({}).sort({ name: 1 });
  res.status(200).json(
    cities.map((city) => ({
      id: city.id,
      name: city.name,
      state: city.state,
      latitude: city.latitude,
      longitude: city.longitude,
      heroImageUrl: city.heroImageUrl,
    }))
  );
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

    if (subCategory) {
      const escaped = subCategory.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ subCategories: regex }, { tags: regex }];
    }
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$and = [
        {
          $or: [
            { name: regex },
            { subtitle: regex },
            { description: regex },
            { tags: regex },
            { subCategories: regex },
          ],
        },
      ];
    }

    const places = await Place.find(filter).sort({ rating: -1, name: 1 });
    const subCategoryFilter = { cityId: city.id };
    if (category) subCategoryFilter.category = category;
    const categoryPlaces = await Place.find(subCategoryFilter).select("subCategories");
    const subCategories = [
      ...new Set(categoryPlaces.flatMap((place) => place.subCategories || [])),
    ].sort((a, b) => a.localeCompare(b));

    res.status(200).json({
      cityId: city.id,
      category: category || "",
      subCategories,
      places: places.map(placeJson),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCities, cityHome, explore };
