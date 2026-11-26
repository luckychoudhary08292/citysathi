const { Server } = require("socket.io");

let io;
const recentEmits = new Map();
const DEBOUNCE_MS = 150;
const CITY_SCOPED_SCOPES = new Set([
  "home", "places", "categories", "subcategories", "explore",
  "services", "apps", "city_apps", "trips",
]);
const VALID_SCOPES = new Set([
  "cities", "home", "categories", "subcategories", "explore", "places",
  "services", "apps", "city_apps", "trips", "all",
]);
const SCOPE_EVENTS = {
  cities: ["cities-updated"],
  home: ["home-updated"],
  categories: ["categories-updated"],
  subcategories: ["categories-updated"],
  explore: ["categories-updated"],
  places: ["places-updated"],
  services: ["services-updated"],
  apps: ["apps-updated"],
  city_apps: ["apps-updated"],
  trips: ["trips-updated"],
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

  const key = `${cityId}\u0000${scope}`;
  const now = Date.now();
  const previous = recentEmits.get(key);
  if (previous && now - previous < DEBOUNCE_MS) return;
  recentEmits.set(key, now);

  const payload = { type, cityId, scope };
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
  if (cityId && cityId !== "all" && CITY_SCOPED_SCOPES.has(scope)) {
    const room = `city:${cityId}`;
    emit(io.to(room).to("city:none"));
  } else {
    emit(io);
  }
}

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket) => {
    const initialCityId = socket.handshake.query.cityId;
    if (typeof initialCityId === "string" && initialCityId.trim()) {
      const cityId = initialCityId.trim();
      socket.data.cityId = cityId;
      socket.join(`city:${cityId}`);
    } else {
      socket.join("city:none");
    }

    socket.on("join_city", (payload = {}) => {
      const { cityId } = payload;
      if (typeof cityId !== "string" || !cityId.trim()) return;

      for (const room of socket.rooms) {
        if (room.startsWith("city:")) socket.leave(room);
      }
      socket.data.cityId = cityId.trim();
      socket.join(`city:${socket.data.cityId}`);
    });

    socket.on("leave_city", (payload = {}) => {
      const { cityId } = payload;
      if (typeof cityId === "string" && cityId.trim()) {
        const normalizedCityId = cityId.trim();
        socket.leave(`city:${normalizedCityId}`);
        if (socket.data.cityId === normalizedCityId) {
          delete socket.data.cityId;
          socket.join("city:none");
        }
      }
    });
  });

  return io;
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
          docType === "app" ? "apps" :
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
      emitLiveUpdate({ cityId: "", scope: "cities" });
    } else if (collection === "categories") {
      emitLiveUpdate({ cityId: change.fullDocument?.cityId || "", scope: "categories" });
    } else if (collection === "trips") {
      emitLiveUpdate({ cityId: change.fullDocument?.cityId || "", scope: "trips" });
    } else if (collection === "map_categories") {
      emitLiveUpdate({
        cityId: change.fullDocument?.cityId || "",
        scope: "categories",
        eventAliases: ["map-categories-updated"],
      });
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
  recentEmits.clear();
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
