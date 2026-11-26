const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { categories } = require("../controllers/cityController");
const { CATEGORY_VALUES } = require("../config/constants");

const router = express.Router();

router.get(
  "/",
  validate({
    parse: ({ query }) => ({
      query: z
        .object({
          cityId: z.string().trim().min(1).optional(),
          category: z.enum([...CATEGORY_VALUES, "MAP"]).optional(),
        })
        .passthrough()
        .parse(query),
    }),
  }),
  categories
);

module.exports = router;
