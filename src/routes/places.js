const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { listTips, createTip } = require("../controllers/tipController");

const router = express.Router({ mergeParams: false });
const placeParams = validate({
  parse: ({ params }) => ({
    params: z.object({ placeId: z.string().trim().min(1) }).parse(params),
  }),
});

router.get("/:placeId/tips", placeParams, listTips);
router.post(
  "/:placeId/tips",
  placeParams,
  validate({
    parse: ({ body }) => ({
      body: z.object({
        id: z.string().trim().min(1),
        placeName: z.string().trim().min(1),
        note: z.string().trim().min(1).max(2000),
        rating: z.number().min(0).max(5),
        timestamp: z.number().finite().optional(),
        placeId: z.string().trim().optional(),
        cityId: z.string().trim().optional(),
      }).parse(body),
    }),
  }),
  createTip
);

module.exports = router;
