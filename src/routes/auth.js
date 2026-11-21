const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const auth = require("../middleware/auth");
const { register, login, me } = require("../controllers/authController");

const router = express.Router();

router.post(
  "/register",
  validate({
    parse: ({ body }) => ({
      body: z
        .object({
          fullName: z.string().trim().min(2).max(100),
          email: z.string().trim().email().toLowerCase(),
          password: z.string().min(8).max(72),
          selectedCityId: z.string().trim().min(1),
        })
        .parse(body),
    }),
  }),
  register
);

router.post(
  "/login",
  validate({
    parse: ({ body }) => ({
      body: z
        .object({
          email: z.string().trim().email().toLowerCase(),
          password: z.string().min(1).max(72),
        })
        .parse(body),
    }),
  }),
  login
);

router.get("/me", auth, me);

module.exports = router;
