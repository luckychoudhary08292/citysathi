const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const adminAuth = require("../middleware/adminAuth");
const { login } = require("../controllers/adminAuthController");
const controller = require("../controllers/adminController");
const {
  CATEGORY_VALUES: PLACE_CATEGORY_VALUES,
  SERVICE_GROUPS,
} = require("../config/constants");

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const nullableUrl = z.union([z.string().url(), z.literal("")]).nullable();
const objectBody = (schema) =>
  validate({ parse: ({ body }) => ({ body: schema.parse(body) }) });
const idParams = validate({
  parse: ({ params }) => ({
    params: z.object({ id: z.string().trim().min(1) }).parse(params),
  }),
});
const cityParams = validate({
  parse: ({ params }) => ({
    params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
  }),
});
const cityListQuery = validate({
  parse: ({ query }) => ({
    query: z.object({ cityId: z.string().trim().min(1).optional() }).passthrough().parse(query),
  }),
});
const adminLoginBody = objectBody(
  z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  })
);
const cityCreateBody = objectBody(z.object({
  id: z.string().trim().regex(/^[a-z0-9_-]{1,80}$/i),
  name: z.string().trim().min(1).max(120),
  state: z.string().trim().optional().default(""),
  latitude: z.number().finite().optional().default(22.7196),
  longitude: z.number().finite().optional().default(75.8577),
  heroImageUrl: nullableUrl.optional().default(null),
  collectionName: z.string().trim().regex(/^city_[a-z0-9_-]+$/i).optional(),
}));
const cityPatchBody = objectBody(z.object({
  name: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  heroImageUrl: nullableUrl.optional(),
  collectionName: z.string().trim().regex(/^city_[a-z0-9_-]+$/i).optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one city field."));
const homeBody = objectBody(z.object({
  cityName: z.string().trim().min(1).optional(),
  heroSubtitle: z.string().optional(),
  headerImageUrl: nullableUrl.optional(),
  promoBanner: z.object({
    id: z.string().trim().min(1).optional(),
    badgeText: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    ctaLabel: z.string().optional(),
    imageUrl: nullableUrl.optional(),
    targetRoute: z.enum(["plan_trip", "explore", "map", "services"]).optional(),
  }).partial().nullable().optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one home field."));
const FIXED_CATEGORIES = ["HERITAGE", "FOOD", "SHOPPING", "ENTERTAINMENT", "NATURE", "CULTURE"];
const placeCategory = z.preprocess(
  (value) => typeof value === "string" ? value.toUpperCase() : value,
  z.enum(PLACE_CATEGORY_VALUES)
);
const placeFields = {
  name: z.string().trim().min(1).max(180),
  subtitle: z.string().optional().default(""),
  category: placeCategory.optional().default("HERITAGE"),
  rating: z.number().min(0).max(5).optional().default(4.5),
  reviewCountLabel: z.string().optional().default("100+ Reviews"),
  distanceLabel: z.string().optional().default("1.2 km"),
  tags: z.array(z.string()).optional().default([]),
  subCategory: z.string().optional().default(""),
  subCategories: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
  openHours: z.string().optional().default("Open Daily"),
  phone: z.string().optional().default(""),
  contactNumber: z.string().optional().default(""),
  address: z.string().optional().default(""),
  latitude: z.number().finite().optional().default(0),
  longitude: z.number().finite().optional().default(0),
  imageUrl: nullableUrl.optional().default(null),
  isPopular: z.boolean().optional().default(true),
  isTrending: z.boolean().optional().default(false),
};
const placeCreateBody = objectBody(z.object({
  id: z.string().trim().min(1).optional(),
  cityId: z.string().trim().min(1),
  ...placeFields,
}));
const placePatchBody = objectBody(z.object({
  ...Object.fromEntries(Object.entries(placeFields).map(([key, schema]) => [key, schema.optional()])),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one place field."));
const categoryFields = {
  cityId: z.string().trim().min(1),
  category: z.enum(FIXED_CATEGORIES),
  name: z.string().trim().optional(),
  title: z.string().trim().min(1).optional().default("Places & Attractions"),
  label: z.string().trim().optional(),
  type: z.string().trim().optional(),
  subCategories: z.array(z.string().trim().min(1)).optional().default([]),
  items: z.array(z.string().trim().min(1)).optional(),
};
const categoryCreateBody = objectBody(z.object({
  id: z.string().trim().min(1).optional(),
  ...categoryFields,
}));
const categoryPatchBody = objectBody(z.object({
  name: z.string().trim().min(1).optional(),
  title: categoryFields.title.optional(),
  label: z.string().trim().optional(),
  type: z.string().trim().optional(),
  subCategories: categoryFields.subCategories.optional(),
  items: categoryFields.items.optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one category field."));

const serviceStringFields = [
  "name", "title", "highlightNumber", "number", "badgeNumber", "category", "group",
  "subtitle", "description", "distanceOrHours", "address", "iconKey", "contactNumber",
];
const serviceFields = Object.fromEntries(serviceStringFields.map((key) => [
  key,
  key === "group"
    ? z.enum(SERVICE_GROUPS).or(z.literal("")).optional().default("")
    : z.string().optional().default(""),
]));
Object.assign(serviceFields, {
  phone: z.string().nullable().optional().default(null),
  isUrgent: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  latitude: z.number().finite().optional().default(0),
  longitude: z.number().finite().optional().default(0),
  actionUrl: nullableUrl.optional().default(null),
});
const serviceCreateBody = objectBody(z.object({
  id: z.string().trim().min(1).optional(),
  cityId: z.string().trim().min(1),
  ...serviceFields,
}));
const servicePatchBody = objectBody(z.object({
  ...Object.fromEntries(Object.entries(serviceFields).map(([key, schema]) => [key, schema.optional()])),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one service field."));

const appStringFields = [
  "appName", "name", "taskCategory", "task", "category", "description", "howToUse",
  "iconKey",
];
const appFields = Object.fromEntries(appStringFields.map((key) => [key, z.string().optional().default("")]));
Object.assign(appFields, {
  highlightTag: z.string().nullable().optional().default(null),
  badge: z.string().nullable().optional().default(null),
  iconUrl: nullableUrl.optional().default(null),
  playStoreUrl: nullableUrl.optional().default(null),
  storeUrl: nullableUrl.optional().default(null),
  packageName: z.string().nullable().optional().default(null),
  websiteUrl: nullableUrl.optional().default(null),
  sortOrder: z.number().int().optional().default(0),
});
const appCreateBody = objectBody(z.object({
  id: z.string().trim().min(1).optional(),
  cityId: z.string().trim().min(1),
  ...appFields,
}));
const appPatchBody = objectBody(z.object({
  ...Object.fromEntries(Object.entries(appFields).map(([key, schema]) => [key, schema.optional()])),
}).refine((body) => Object.keys(body).length > 0, "Provide at least one app field."));
const mapCategoryCreateBody = objectBody(z.object({
  id: z.string().trim().min(1).optional(),
  cityId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional().default(0),
}));
const mapCategoryPatchBody = objectBody(z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.number().int().optional(),
}).refine((body) => Object.keys(body).length > 0, "Provide a name or sortOrder."));
const mapCategoryListQuery = validate({
  parse: ({ query }) => ({
    query: z.object({ cityId: z.string().trim().min(1) }).passthrough().parse(query),
  }),
});

router.post("/auth/login", adminLoginBody, login);
router.use(adminAuth);

router.get("/cities", asyncHandler(controller.listCities));
router.post("/cities", cityCreateBody, asyncHandler(controller.createCity));
router.patch("/cities/:cityId", cityParams, cityPatchBody, asyncHandler(controller.updateCity));
router.put("/cities/:cityId", cityParams, cityPatchBody, asyncHandler(controller.updateCity));
router.delete("/cities/:cityId", cityParams, asyncHandler(controller.deleteCity));

router.get("/cities/:cityId/home", cityParams, asyncHandler(controller.getHome));
router.put("/cities/:cityId/home", cityParams, homeBody, asyncHandler(controller.updateHome));

router.get("/categories", cityListQuery, asyncHandler(controller.listCategories));
router.post("/categories", categoryCreateBody, asyncHandler(controller.createCategory));
router.patch("/categories/:id", idParams, categoryPatchBody, asyncHandler(controller.updateCategory));
router.delete("/categories/:id", idParams, asyncHandler(controller.deleteCategory));

router.get("/map-categories", mapCategoryListQuery, asyncHandler(controller.listMapCategories));
router.post("/map-categories", mapCategoryCreateBody, asyncHandler(controller.createMapCategory));
router.patch("/map-categories/:id", idParams, mapCategoryPatchBody, asyncHandler(controller.updateMapCategory));
router.delete("/map-categories/:id", idParams, asyncHandler(controller.deleteMapCategory));

router.get("/places", cityListQuery, asyncHandler(controller.listPlaces));
router.post("/places", placeCreateBody, asyncHandler(controller.createPlace));
router.patch("/places/:id", idParams, placePatchBody, asyncHandler(controller.updatePlace));
router.delete("/places/:id", idParams, asyncHandler(controller.deletePlace));

router.get("/services", cityListQuery, asyncHandler(controller.listServices));
router.post("/services", serviceCreateBody, asyncHandler(controller.createService));
router.patch("/services/:id", idParams, servicePatchBody, asyncHandler(controller.updateService));
router.delete("/services/:id", idParams, asyncHandler(controller.deleteService));

router.get("/apps", cityListQuery, asyncHandler(controller.listApps));
router.post("/apps", appCreateBody, asyncHandler(controller.createApp));
router.patch("/apps/:id", idParams, appPatchBody, asyncHandler(controller.updateApp));
router.delete("/apps/:id", idParams, asyncHandler(controller.deleteApp));

router.get("/tips", asyncHandler(controller.listTips));
router.delete("/tips/:id", idParams, asyncHandler(controller.deleteTip));

module.exports = router;
