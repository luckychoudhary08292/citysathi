const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./src/routes/auth");
const cityRoutes = require("./src/routes/cities");
const cityResourceRoutes = require("./src/routes/cityResources");
const configRoutes = require("./src/routes/config");
const userRoutes = require("./src/routes/user");
const tripRoutes = require("./src/routes/trips");
const placeRoutes = require("./src/routes/places");
const categoryRoutes = require("./src/routes/categories");
const internalRoutes = require("./src/routes/internal");
const adminRoutes = require("./src/routes/admin");
const { placeMutationEvents } = require("./src/middleware/placesEvents");
const { notFound, errorHandler } = require("./src/middleware/error");

const app = express();

function preventApiGetCaching(req, res, next) {
  if (req.method === "GET") {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
  }
  next();
}

app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(preventApiGetCaching);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return true;
  let requested;
  try {
    requested = new URL(origin);
  } catch (_error) {
    return false;
  }
  if (!["http:", "https:"].includes(requested.protocol)) return false;

  return allowedOrigins.some((configuredOrigin) => {
    let configured;
    try {
      configured = new URL(configuredOrigin);
    } catch (_error) {
      return false;
    }
    return ["http:", "https:"].includes(configured.protocol) &&
      configured.host.toLowerCase() === requested.host.toLowerCase();
  });
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed by CORS"));
      }
    },
  })
);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use(placeMutationEvents);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/cities", cityRoutes);
app.use("/api/v1", cityResourceRoutes);
app.use("/api/v1/config", configRoutes);
app.use("/api/v1/map/config", configRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/internal", internalRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/trips", tripRoutes);
app.use("/api/v1/places", placeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
