const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { ApiError } = require("../middleware/error");
const { emitLiveUpdate } = require("../services/liveUpdates");

const router = express.Router();

router.post(
  "/notify-change",
  validate({
    parse: ({ body }) => ({
      body: z.object({
        cityId: z.string().trim().optional().default(""),
        scope: z
          .enum([
            "cities", "home", "places", "categories", "subcategories", "explore",
            "services", "apps", "city_apps", "trips", "all",
          ])
          .optional()
          .default("all"),
      }).parse(body),
    }),
  }),
  (req, res, next) => {
    const configuredSecret =
      process.env.INTERNAL_SYNC_SECRET || process.env.INTERNAL_NOTIFY_SECRET;
    if (configuredSecret && req.get("X-Internal-Secret") !== configuredSecret) {
      return next(new ApiError(401, "Invalid internal notification secret"));
    }

    emitLiveUpdate({
      type: "DATA_UPDATED",
      cityId: req.body.cityId,
      scope: req.body.scope,
    });
    res.status(200).json({ ok: true });
  }
);

module.exports = router;
