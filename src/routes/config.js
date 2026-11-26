const express = require("express");
const { mapConfig } = require("../controllers/cityController");

const router = express.Router();

router.get("/", mapConfig);

module.exports = router;
