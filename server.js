require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const { seedDatabaseIfEmpty } = require("./src/seed/seed");

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
  await seedDatabaseIfEmpty();

  const server = app.listen(port, () => {
    console.log(`City Companion API listening on port ${port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
