const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const optionalAccountAuth = require("../middleware/optionalAccountAuth");
const { listTrips, upsertTrip, patchTrip, deleteTrip } = require("../controllers/tripController");

const router = express.Router();
router.use(optionalAccountAuth);
const tripFields = {
  title: z.string().trim().min(1).max(150),
  cityId: z.string().trim().min(1),
  duration: z.string().trim().min(1).max(100),
  placeIds: z.array(z.string().trim().min(1)),
  startDateMillis: z.number().finite(),
  completedPlaceIds: z.array(z.string().trim().min(1)),
  status: z.enum(["UPCOMING", "ONGOING", "COMPLETED"]),
};
const params = validate({
  parse: ({ params: value }) => ({
    params: z.object({ tripId: z.string().trim().min(1) }).parse(value),
  }),
});

router.get("/", listTrips);
router.post(
  "/",
  validate({
    parse: ({ body }) => ({
      body: z.object({
        id: z.string().trim().min(1),
        userId: z.string().trim().min(1).optional(),
        deviceId: z.string().trim().optional(),
        title: tripFields.title,
        cityId: tripFields.cityId,
        duration: tripFields.duration,
        placeIds: tripFields.placeIds.optional().default([]),
        startDateMillis: tripFields.startDateMillis,
        completedPlaceIds: tripFields.completedPlaceIds.optional().default([]),
        status: tripFields.status.optional().default("UPCOMING"),
        createdAt: z.number().finite().optional(),
      }).parse(body),
    }),
  }),
  upsertTrip
);
router.patch(
  "/:tripId",
  params,
  validate({
    parse: ({ body }) => ({
      body: z.object(tripFields).partial().refine((value) => Object.keys(value).length > 0, {
        message: "At least one trip field must be provided",
      }).parse(body),
    }),
  }),
  patchTrip
);
router.delete("/:tripId", params, deleteTrip);

module.exports = router;
