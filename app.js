const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./src/routes/auth");
const cityRoutes = require("./src/routes/cities");
const userRoutes = require("./src/routes/user");
const tripRoutes = require("./src/routes/trips");
const placeRoutes = require("./src/routes/places");
const categoryRoutes = require("./src/routes/categories");
const internalRoutes = require("./src/routes/internal");
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

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin is not allowed by CORS"));
      }
    },
  })
);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.use("/api/v1", preventApiGetCaching);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/cities", cityRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/internal", internalRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/trips", tripRoutes);
app.use("/api/v1/places", placeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
