const express = require("express");
const { z } = require("zod");
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const controller = require("../controllers/userController");

const router = express.Router();
router.use(auth);

const placeBody = z.object({ placeId: z.string().trim().min(1) });
const planBody = z.object({
  title: z.string().trim().min(1).max(150),
  date: z.string().trim().max(30).optional().default(""),
  placeIds: z.array(z.string().trim().min(1)).optional().default([]),
  notes: z.string().trim().max(2000).optional().default(""),
  status: z.enum(["PLANNED", "ONGOING", "COMPLETED"]).optional().default("PLANNED"),
});
const planPatch = planBody.partial();
const planParams = z.object({ planId: z.string().trim().min(1) });
const contributionBody = z.object({
  placeId: z.string().trim().optional().default(""),
  type: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional().default(""),
  imageUrl: z.string().url().optional().or(z.literal("")).optional().default(""),
});

const body = (schema) =>
  validate({ parse: ({ body: value }) => ({ body: schema.parse(value) }) });
const params = (schema) =>
  validate({ parse: ({ params: value }) => ({ params: schema.parse(value) }) });

router.get("/activity", controller.activity);

router.post("/saved", body(placeBody), controller.addSaved);
router.delete("/saved/:placeId", params(z.object({ placeId: z.string().trim().min(1) })), controller.removeSaved);

router.post("/visited", body(placeBody), controller.addVisited);
router.delete("/visited/:placeId", params(z.object({ placeId: z.string().trim().min(1) })), controller.removeVisited);

router.post("/plans", body(planBody), controller.createPlan);
router.patch("/plans/:planId", params(planParams), body(planPatch), controller.updatePlan);
router.delete("/plans/:planId", params(planParams), controller.deletePlan);

router.post("/contributions", body(contributionBody), controller.addContribution);
router.patch(
  "/preferences",
  body(
    z.object({
      selectedCityId: z.string().trim().min(1).optional(),
      notificationsEnabled: z.boolean().optional(),
    }).refine((value) => value.selectedCityId !== undefined || value.notificationsEnabled !== undefined, {
      message: "At least one preference must be provided",
    })
  ),
  controller.updatePreferences
);

module.exports = router;
