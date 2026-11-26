const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const mongoose = require("mongoose");
const { io: connectSocket } = require("socket.io-client");

const previousCorsOrigin = process.env.CORS_ORIGIN;
process.env.CORS_ORIGIN = "*";
const app = require("../app");
if (previousCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
else process.env.CORS_ORIGIN = previousCorsOrigin;
const City = require("../src/models/City");
const MapCategory = require("../src/models/MapCategory");
const TripPlan = require("../src/models/TripPlan");
const { validateServiceDocument } = require("../src/models/Service");
const { cityLookupFilter } = require("../src/utils/cityCollection");
const {
  initSocketServer,
  emitLiveUpdate,
  closeSocketServer,
} = require("../src/services/liveUpdates");

async function withHttpServer(callback) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("custom trip string IDs support PATCH and DELETE without ObjectId casting", async () => {
  const originalFindOne = TripPlan.findOne;
  const originalFindOneAndUpdate = TripPlan.findOneAndUpdate;
  const originalFindOneAndDelete = TripPlan.findOneAndDelete;
  const originalCityFindOne = City.findOne;
  const seenFilters = [];
  let upsertPlaceIds;
  TripPlan.findOne = () => ({ select: async () => null });
  TripPlan.findOneAndUpdate = async (filter, update, options) => {
    seenFilters.push(filter);
    if (options.upsert) upsertPlaceIds = update.$set.placeIds;
    return {
      id: filter.id || "plan_test123",
      userId: "test-user",
      deviceId: "",
      title: update.$set.title || "Trip",
      cityId: "indore",
      duration: "2 days",
      placeIds: [],
      completedPlaceIds: [],
      startDateMillis: 1000,
      status: "UPCOMING",
    };
  };
  TripPlan.findOneAndDelete = async (filter) => {
    seenFilters.push(filter);
    return { id: "plan_test123", cityId: "indore" };
  };
  City.findOne = () => ({ lean: async () => ({ id: "indore" }) });

  try {
    await withHttpServer(async (baseUrl) => {
      const creation = await fetch(`${baseUrl}/api/v1/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-User-Id": "test-user" },
        body: JSON.stringify({
          id: "plan_empty",
          title: "Empty plan",
          cityId: "Indore",
          duration: "1 day",
          startDateMillis: 1000,
        }),
      });
      assert.equal(creation.status, 200);
      assert.deepEqual(upsertPlaceIds, []);

      const patch = await fetch(`${baseUrl}/api/v1/trips/plan_test123`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-User-Id": "test-user" },
        body: JSON.stringify({ title: "Updated" }),
      });
      assert.equal(patch.status, 200);
      assert.equal((await patch.json()).id, "plan_test123");

      const deletion = await fetch(`${baseUrl}/api/v1/trips/plan_test123`, {
        method: "DELETE",
        headers: { "X-User-Id": "test-user" },
      });
      assert.equal(deletion.status, 204);
    });
  } finally {
    TripPlan.findOne = originalFindOne;
    TripPlan.findOneAndUpdate = originalFindOneAndUpdate;
    TripPlan.findOneAndDelete = originalFindOneAndDelete;
    City.findOne = originalCityFindOne;
  }

  assert.equal(seenFilters.length, 3);
  for (const filter of seenFilters.slice(1)) {
    const idFilter = filter.$and[0].$or;
    assert.deepEqual(idFilter, [{ id: "plan_test123" }]);
  }
});

test("Service accepts an empty highlight number and missing phone", async () => {
  const service = await validateServiceDocument({
    id: "svc_hospital",
    cityId: "indore",
    group: "EMERGENCY",
    serviceMode: "SERVICE_NAME",
    name: "Hospital",
    category: "Hospital",
    iconKey: "hospital",
    highlightNumber: "",
  });
  assert.equal(service.highlightNumber, "");
  assert.equal(service.phone, "");
});

test("city lookup matches city slugs without case sensitivity", () => {
  const filter = cityLookupFilter("Indore");
  assert.equal(filter.$or[0].id.test("indore"), true);
  assert.equal(filter.$or[0].id.test("INDORE"), true);
});

test("city home reads hero, promo, and places from the Admin collections", async () => {
  const originalCityFindOne = City.findOne;
  const originalDb = mongoose.connection.db;
  const city = {
    id: "indore",
    _id: new mongoose.Types.ObjectId(),
    name: "Indore",
    heroImageUrl: "https://images.example/indore.jpg",
    heroSubtitle: "Discover {city}",
    promoBanner: {
      id: "promo_indore_1",
      badgeText: "FEATURED",
      title: "Weekend Pass",
      subtitle: "Local trails",
      ctaLabel: "Plan Trip",
      imageUrl: "https://images.example/promo.jpg",
      targetRoute: "explore",
    },
  };
  const place = {
    id: "rajwada_palace",
    docType: "place",
    cityId: "Indore",
    name: "Rajwada Palace",
    category: "HERITAGE",
    isPopular: true,
  };
  let queriedCollection;
  mongoose.connection.db = {
    collection(name) {
      queriedCollection = name;
      return {
        find(filter) {
          assert.ok(filter.$and[0].$or.some((clause) =>
            clause.cityId instanceof RegExp && clause.cityId.test("indore")
          ));
          return {
            sort() { return this; },
            async toArray() { return [place]; },
          };
        },
      };
    },
  };
  City.findOne = () => ({ lean: async () => city });

  try {
    await withHttpServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/cities/Indore/home`);
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(queriedCollection, "city_indore");
      assert.equal(result.cityId, "indore");
      assert.equal(result.heroSubtitle, "Discover Indore");
      assert.equal(result.headerImageUrl, city.heroImageUrl);
      assert.equal(result.popularPlaces[0].id, place.id);
      assert.deepEqual(result.popularPlaces[0].tags, []);
      assert.deepEqual(result.popularPlaces[0].subCategories, []);
      assert.deepEqual(result.promoBanner, city.promoBanner);
    });
  } finally {
    City.findOne = originalCityFindOne;
    mongoose.connection.db = originalDb;
  }
});

test("map API filters case-insensitively and derives map chips from services", async () => {
  const originalCityFindOne = City.findOne;
  const originalMapCategoryFind = MapCategory.find;
  const originalDb = mongoose.connection.db;
  const previousMapsKey = process.env.MAPS_API_KEY;
  const city = {
    id: "indore",
    _id: new mongoose.Types.ObjectId(),
    collectionName: "city_indore",
  };
  const documents = [
    {
      id: "plc_hospital",
      docType: "place",
      cityId: "Indore",
      name: "Central Hospital",
      category: "HOSPITAL",
      tags: [],
      subCategories: [],
    },
    {
      id: "svc_hospital",
      docType: "service",
      cityId: "indore",
      group: "EMERGENCY",
      serviceMode: "SERVICE_NAME",
      iconKey: "hospital",
      name: "City Hospital",
      category: "Service Name",
      highlightNumber: "",
      phone: null,
      contactNumber: "555-0100",
    },
    {
      id: "svc_contact",
      docType: "service",
      cityId: "indore",
      group: "EMERGENCY",
      serviceMode: "CONTACT",
      iconKey: "phone",
      name: "Police",
      category: "Emergency",
    },
    {
      id: "svc_generic",
      docType: "service",
      cityId: "indore",
      serviceMode: "SERVICE_NAME",
      name: "General Help",
      category: "General",
    },
    {
      id: "guide_metro",
      docType: "app_guide",
      cityId: "indore",
      appName: "Indore Metro",
      taskCategory: "Metro & Bus",
      sortOrder: 1,
    },
  ];
  let cityLookup;
  const collection = {
    find(filter) {
      const type = filter.$and.find((part) => part.docType)?.docType;
      return {
        sort() { return this; },
        async toArray() {
          return documents.filter((doc) =>
            type && typeof type === "object" && Array.isArray(type.$in)
              ? type.$in.includes(doc.docType)
              : doc.docType === type
          );
        },
      };
    },
  };
  mongoose.connection.db = { collection: () => collection };
  City.findOne = (filter) => {
    cityLookup = filter;
    return { lean: async () => city };
  };
  MapCategory.find = () => ({
    sort() { return this; },
    lean: async () => [],
  });
  process.env.MAPS_API_KEY = "test-map-key";

  try {
    await withHttpServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/api/v1/cities/Indore/map?filter=hOsPiTaL`
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      const result = await response.json();
      assert.deepEqual(result.mapSubCategories, ["City Hospital"]);
      assert.deepEqual(result.places.map((place) => place.id), ["plc_hospital"]);
      assert.deepEqual(result.services.map((service) => service.id), ["svc_hospital"]);
      assert.equal(result.services[0].phone, "555-0100");
      assert.deepEqual(result.cityApps.map((guide) => guide.appName), ["Indore Metro"]);
      assert.equal(result.cityId, "indore");
      assert.equal(result.mapsApiKey, "test-map-key");
      assert.equal(cityLookup.$or[0].id.test("indore"), true);

      const aliasResponse = await fetch(
        `${baseUrl}/api/v1/cities/Indore/map-services?filter=HOSPITAL`
      );
      assert.equal(aliasResponse.status, 200);
      const aliasResult = await aliasResponse.json();
      assert.deepEqual(Object.keys(aliasResult).sort(), [
        "cityApps", "cityId", "mapSubCategories", "mapsApiKey", "places", "services",
      ]);
    });
  } finally {
    City.findOne = originalCityFindOne;
    MapCategory.find = originalMapCategoryFind;
    mongoose.connection.db = originalDb;
    if (previousMapsKey === undefined) delete process.env.MAPS_API_KEY;
    else process.env.MAPS_API_KEY = previousMapsKey;
  }
});

test("CORS preflight allows Android headers and API config is uncached", async () => {
  const previousMapsKey = process.env.MAPS_API_KEY;
  const previousGoogleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  await withHttpServer(async (baseUrl) => {
    const preflight = await fetch(`${baseUrl}/api/v1/trips`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://admin.example.com",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type, Authorization, X-User-Id, X-Device-Id, Cache-Control, Pragma",
      },
    });
    assert.equal(preflight.status, 204);
    const allowed = preflight.headers.get("access-control-allow-headers").toLowerCase();
    for (const header of [
      "content-type", "authorization", "x-user-id", "x-device-id", "cache-control", "pragma",
      "x-internal-secret",
    ]) {
      assert.ok(allowed.includes(header), `missing CORS header ${header}`);
    }

    const config = await fetch(`${baseUrl}/api/v1/map/config`);
    assert.equal(config.status, 200);
    assert.match(config.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await config.json(), { mapsApiKey: "", defaultZoom: 13.5 });

    const configAlias = await fetch(`${baseUrl}/api/v1/config`);
    assert.deepEqual(await configAlias.json(), { mapsApiKey: "", defaultZoom: 13.5 });
    const health = await fetch(`${baseUrl}/api/v1/health`);
    const healthBody = await health.json();
    assert.deepEqual(Object.keys(healthBody).sort(), ["dbConnected", "hasMapsApiKey", "ok"]);
    assert.equal(typeof healthBody.dbConnected, "boolean");
    assert.equal(typeof healthBody.hasMapsApiKey, "boolean");
  });
  if (previousMapsKey === undefined) delete process.env.MAPS_API_KEY;
  else process.env.MAPS_API_KEY = previousMapsKey;
  if (previousGoogleMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = previousGoogleMapsKey;
});

test("Socket.IO joins normalized/raw city rooms and emits live update events", async () => {
  const previousInternalSecret = process.env.INTERNAL_SYNC_SECRET;
  process.env.INTERNAL_SYNC_SECRET = "test-internal-secret";
  const server = http.createServer(app);
  const io = initSocketServer(server);
  app.set("io", io);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const client = connectSocket(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
  });

  try {
    await new Promise((resolve, reject) => {
      client.once("connect", resolve);
      client.once("connect_error", reject);
    });
    client.emit("join_city", "Indore");
    const socket = [...io.sockets.sockets.values()][0];
    for (let attempt = 0; attempt < 30 && !socket.rooms.has("city:indore"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(socket.rooms.has("city:indore"));
    assert.ok(socket.rooms.has("city:Indore"));

    const specificUpdate = new Promise((resolve) => client.once("places-updated", resolve));
    const update = new Promise((resolve) => client.once("data-updated", resolve));
    emitLiveUpdate({ cityId: "Indore", scope: "places" });
    const [payload, specificPayload] = await Promise.all([update, specificUpdate]);
    assert.equal(payload.type, "DATA_UPDATED");
    assert.equal(payload.cityId, "indore");
    assert.equal(payload.scope, "places");
    assert.ok(Number.isFinite(payload.timestamp));
    assert.equal(specificPayload.cityId, "indore");

    client.emit("join_city", { cityId: "Bhopal" });
    for (let attempt = 0; attempt < 30 && !socket.rooms.has("city:bhopal"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(socket.rooms.has("city:bhopal"));
    assert.ok(socket.rooms.has("city:Bhopal"));
    const rejectedWebhook = await fetch(`http://127.0.0.1:${port}/api/v1/internal/notify-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": "wrong-secret" },
      body: JSON.stringify({ cityId: "Bhopal", scope: "map_categories" }),
    });
    assert.equal(rejectedWebhook.status, 401);

    const mapUpdate = new Promise((resolve) => client.once("map-categories-updated", resolve));
    const webhookUpdate = new Promise((resolve) => client.once("data_updated", resolve));
    const webhook = await fetch(`http://127.0.0.1:${port}/api/v1/internal/notify-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Secret": "test-internal-secret" },
      body: JSON.stringify({ cityId: "Bhopal", scope: "map_categories" }),
    });
    assert.equal(webhook.status, 200);
    const [mapPayload, webhookPayload] = await Promise.all([mapUpdate, webhookUpdate]);
    assert.equal(mapPayload.cityId, "bhopal");
    assert.equal(mapPayload.scope, "map_categories");
    assert.equal(webhookPayload.type, "DATA_UPDATED");
    assert.ok(Number.isFinite(webhookPayload.timestamp));

    client.emit("leave_city", "bhopal");
    for (let attempt = 0; attempt < 30 && socket.rooms.has("city:bhopal"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(!socket.rooms.has("city:bhopal"));
    assert.ok(!socket.rooms.has("city:Bhopal"));
  } finally {
    client.close();
    await closeSocketServer();
    if (previousInternalSecret === undefined) delete process.env.INTERNAL_SYNC_SECRET;
    else process.env.INTERNAL_SYNC_SECRET = previousInternalSecret;
  }
});
