const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { CATEGORY_VALUES } = require("../config/constants");
const {
  listCities, cityHome, explore, mapServices, listServices, listApps,
} = require("../controllers/cityController");

const router = express.Router();

router.get("/", listCities);
router.get(
  "/:cityId/home",
  validate({
    parse: ({ params }) => ({
      params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
    }),
  }),
  cityHome
);
router.get(
  "/:cityId/explore",
  validate({
    parse: ({ params, query }) => ({
      params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
      query: z
        .object({
          category: z.enum(CATEGORY_VALUES).optional(),
          subCategory: z.string().trim().min(1).optional(),
          q: z.string().trim().min(1).optional(),
        })
        .passthrough()
        .parse(query),
    }),
  }),
  explore
);
router.get(
  "/:cityId/map-services",
  validate({
    parse: ({ params, query }) => ({
      params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
      query: z.object({ filter: z.string().trim().min(1).optional() }).passthrough().parse(query),
    }),
  }),
  mapServices
);
router.get(
  "/:cityId/services",
  validate({
    parse: ({ params }) => ({
      params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
    }),
  }),
  listServices
);
router.get(
  "/:cityId/apps",
  validate({
    parse: ({ params }) => ({
      params: z.object({ cityId: z.string().trim().min(1) }).parse(params),
    }),
  }),
  listApps
);

module.exports = router;
