const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { categories } = require("../controllers/cityController");

const router = express.Router();

router.get(
  "/",
  validate({
    parse: ({ query }) => ({
      query: z
        .object({
          cityId: z.string().trim().min(1).optional(),
          category: z.enum(["HERITAGE", "FOOD", "SHOPPING", "ENTERTAINMENT", "NATURE", "CULTURE"]).optional(),
        })
        .passthrough()
        .parse(query),
    }),
  }),
  categories
);

module.exports = router;
