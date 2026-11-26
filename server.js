require("dotenv").config();

const mongoose = require("mongoose");
const http = require("http");
const app = require("./app");
const {
  initSocketServer,
  startChangeStreamWatcher,
  closeSocketServer,
} = require("./src/services/liveUpdates");

const port = Number(process.env.PORT) || 5000;

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

  const dbName = process.env.MONGODB_DB_NAME || "citysathi";
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  console.log("MongoDB connected");

  const httpServer = http.createServer(app);
  const io = initSocketServer(httpServer);
  app.set("io", io);
  const changeStream = startChangeStreamWatcher(mongoose.connection.db);

  httpServer.listen(port, () => {
    console.log(`City Companion API listening on port ${port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    if (changeStream) {
      await changeStream.close().catch((error) => {
        console.error("Failed to close MongoDB change stream:", error.message);
      });
    }
    await closeSocketServer();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
