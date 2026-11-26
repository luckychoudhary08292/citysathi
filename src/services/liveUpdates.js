const { Server } = require("socket.io");

let io;
const CITY_SCOPED_SCOPES = new Set([
  "cities", "home", "places", "categories", "subcategories", "explore",
  "map_categories", "services", "apps", "app_guides", "city_apps", "trips", "tips",
]);
const VALID_SCOPES = new Set([
  "cities", "home", "categories", "subcategories", "explore", "places",
  "map_categories", "services", "apps", "app_guides", "city_apps",
  "trips", "tips", "all",
]);
const SCOPE_EVENTS = {
  cities: ["cities-updated"],
  home: ["home-updated"],
  categories: ["categories-updated"],
  map_categories: ["categories-updated", "map-categories-updated"],
  subcategories: ["categories-updated"],
  explore: ["categories-updated"],
  places: ["places-updated"],
  services: ["services-updated"],
  apps: ["apps-updated"],
  app_guides: ["apps-updated", "app-guides-updated"],
  city_apps: ["apps-updated"],
  trips: ["trips-updated"],
  tips: ["tips-updated"],
};

function emitLiveUpdate({
  type = "DATA_UPDATED",
  cityId = "",
  scope = "all",
  action,
  eventAliases = [],
} = {}) {
  if (!io) return;
  if (!VALID_SCOPES.has(scope)) scope = "all";
  const now = Date.now();
  const normalizedCityId = cityId == null ? "" : String(cityId).trim().toLocaleLowerCase();

  const payload = { type, cityId: normalizedCityId, scope };
  if (["POST", "PUT", "DELETE"].includes(action)) payload.action = action;
  payload.timestamp = now;
  const eventNames = [...new Set([
    ...(SCOPE_EVENTS[scope] || []),
    ...eventAliases.filter((eventName) => typeof eventName === "string"),
    "data-updated",
    "data_updated",
  ])];
  const emit = (operator) => {
    for (const eventName of eventNames) operator.emit(eventName, payload);
  };
  emit(io);
  if (normalizedCityId && normalizedCityId !== "all" && CITY_SCOPED_SCOPES.has(scope)) {
    emit(io.to(`city:${normalizedCityId}`));
  }
}

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      allowedHeaders: [
        "Content-Type", "Authorization", "X-User-Id", "X-Device-Id",
        "Cache-Control", "Pragma", "X-Internal-Secret",
      ],
    },
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket) => {
    const initialCityId = socket.handshake.query.cityId;
    if (typeof initialCityId === "string" && initialCityId.trim()) {
      joinCity(socket, initialCityId);
    } else {
      socket.join("city:none");
    }

    socket.on("join_city", (payload = {}) => joinCity(socket, payload));

    socket.on("leave_city", (payload = {}) => {
      const cityId = cityIdFromPayload(payload);
      if (!cityId) return;
      const normalizedCityId = cityId.toLocaleLowerCase();
      for (const room of socket.rooms) {
        if (room !== "city:none" && room.startsWith("city:") &&
            room.slice("city:".length).toLocaleLowerCase() === normalizedCityId) {
          socket.leave(room);
        }
      }
      if (socket.data.cityId?.toLocaleLowerCase() === normalizedCityId) {
        delete socket.data.cityId;
        socket.join("city:none");
      }
    });
  });

  return io;
}

function cityIdFromPayload(payload) {
  const value = typeof payload === "string" ? payload : payload?.cityId;
  return typeof value === "string" ? value.trim() : "";
}

function joinCity(socket, payload) {
  const cityId = cityIdFromPayload(payload);
  if (!cityId) return;
  for (const room of socket.rooms) {
    if (room.startsWith("city:")) socket.leave(room);
  }
  const normalizedCityId = cityId.toLocaleLowerCase();
  socket.data.cityId = cityId;
  socket.join(`city:${normalizedCityId}`);
  if (cityId !== normalizedCityId) socket.join(`city:${cityId}`);
}

function inferCityCollectionUpdate(change) {
  const collectionName = change.ns && change.ns.coll;
  if (!collectionName || !collectionName.startsWith("city_")) return null;

  const cityId = change.fullDocument?.cityId || collectionName.slice("city_".length);
  const docType =
    change.fullDocument?.docType ||
    change.fullDocumentBeforeChange?.docType;
  const scope =
    docType === "home_meta" ? "home" :
      docType === "service" ? "services" :
          docType === "app_guide" || docType === "app" ? "app_guides" :
            docType === "place" ? "places" : "all";

  return { cityId, scope };
}

function startChangeStreamWatcher(db) {
  let stream = null;
  let retryTimer = null;
  let stableTimer = null;
  let retryDelay = 500;
  let stopped = false;

  const scheduleRestart = (error) => {
    if (stopped || retryTimer) return;
    if (error) {
      console.warn(
        "MongoDB change stream unavailable; retrying with backoff and webhook fallback:",
        error.message
      );
    }

    retryTimer = setTimeout(() => {
      retryTimer = null;
      openStream();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  };

  const onChange = (change) => {
    const operation = change.operationType;
    if (!["insert", "update", "replace", "delete"].includes(operation)) return;

    const collection = change.ns?.coll;
    if (collection === "cities") {
      const cityId = change.fullDocument?.id || "";
      emitLiveUpdate({ cityId, scope: "cities" });
      const changedFields = Object.keys(change.updateDescription?.updatedFields || {});
      if (change.operationType === "insert" ||
          changedFields.some((field) => /^(heroSubtitle|heroImageUrl|promoBanner)(\.|$)/.test(field))) {
        emitLiveUpdate({ cityId, scope: "home" });
      }
    } else if (collection === "categories") {
      emitLiveUpdate({ cityId: change.fullDocument?.cityId || "", scope: "categories" });
    } else if (collection === "trips") {
      emitLiveUpdate({ cityId: change.fullDocument?.cityId || "", scope: "trips" });
    } else if (collection === "map_categories") {
      emitLiveUpdate({
        cityId: change.fullDocument?.cityId || "",
        scope: "map_categories",
      });
    } else if (collection === "tips") {
      emitLiveUpdate({ cityId: change.fullDocument?.cityId || "", scope: "tips" });
    } else {
      const update = inferCityCollectionUpdate(change);
      if (update) emitLiveUpdate(update);
    }
  };

  const openStream = () => {
    if (stopped) return;
    try {
      const nextStream = db.watch([], { fullDocument: "updateLookup" });
      stream = nextStream;
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        stableTimer = null;
        retryDelay = 500;
      }, 30000);
      nextStream.on("change", onChange);
      nextStream.on("error", (error) => {
        if (stream !== nextStream) return;
        stream = null;
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = null;
        scheduleRestart(error);
      });
      nextStream.on("close", () => {
        if (stream !== nextStream) return;
        stream = null;
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = null;
        scheduleRestart(new Error("change stream closed"));
      });
    } catch (error) {
      stream = null;
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = null;
      scheduleRestart(error);
    }
  };

  openStream();

  return {
    async close() {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (stableTimer) clearTimeout(stableTimer);
      retryTimer = null;
      stableTimer = null;
      const current = stream;
      stream = null;
      if (current) await current.close();
    },
  };
}

function closeSocketServer() {
  const current = io;
  io = undefined;
  return new Promise((resolve) => {
    if (!current) return resolve();
    current.close(() => resolve());
  });
}

module.exports = {
  initSocketServer,
  emitLiveUpdate,
  startChangeStreamWatcher,
  closeSocketServer,
};
