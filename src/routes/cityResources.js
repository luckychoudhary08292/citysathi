const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const { listServices, listApps } = require("../controllers/cityController");

const router = express.Router();
const cityQuery = validate({
  parse: ({ query }) => ({
    query: z.object({ cityId: z.string().trim().min(1) }).passthrough().parse(query),
  }),
});

router.get("/services", cityQuery, listServices);
router.get("/apps", cityQuery, listApps);

module.exports = router;
