const express = require("express");
const { z } = require("zod");
const validate = require("../middleware/validate");
const auth = require("../middleware/auth");
const { register, login, me } = require("../controllers/authController");
const {
  signup,
  signin,
  forgotPassword,
} = require("../controllers/accountAuthController");

const router = express.Router();

router.post(
  "/signup",
  validate({
    parse: ({ body }) => ({
      body: z.object({
        username: z.string().trim().min(2, "Username must be at least 2 characters."),
        email: z.string().trim().email("Please provide a valid email address."),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters.")
          .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
            message: "Password must be no more than 72 bytes.",
          }),
      }).parse(body),
    }),
  }),
  signup
);

router.post(
  "/signin",
  validate({
    parse: ({ body }) => ({
      body: z.object({
        identifier: z.string().trim().min(1, "Username or email is required."),
        password: z.string().min(1, "Password is required."),
      }).parse(body),
    }),
  }),
  signin
);

router.post(
  "/forgot-password",
  validate({
    parse: ({ body }) => ({
      body: z.object({
        email: z.string().trim().email("Please provide a valid email address."),
      }).parse(body),
    }),
  }),
  forgotPassword
);

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
