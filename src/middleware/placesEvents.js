function emitPlacesUpdated(req, cityId = "") {
  const io = req.app.get("io");
  if (!io) return;

  const payload = {
    type: "DATA_UPDATED",
    cityId: String(cityId || "").trim().toLocaleLowerCase(),
    scope: "places",
    action: req.method,
    timestamp: Date.now(),
  };

  for (const eventName of ["places-updated", "data-updated", "data_updated"]) {
    io.emit(eventName, payload);
    if (payload.cityId) {
      io.to(`city:${payload.cityId}`).emit(eventName, payload);
    }
  }
}

function isPlaceMutationPath(path) {
  return (
    /^\/api\/v1\/places(?:\/[^/]+)?\/?$/.test(path) ||
    /^\/api\/v1\/cities\/[^/]+\/places(?:\/[^/]+)?\/?$/.test(path)
  );
}

function placeMutationEvents(req, res, next) {
  if (!["POST", "PUT", "DELETE"].includes(req.method) || !isPlaceMutationPath(req.path)) {
    return next();
  }

  let responseCityId = "";
  const originalJson = res.json;
  res.json = function jsonWithPlaceCityId(body) {
    if (body && typeof body.cityId === "string") {
      responseCityId = body.cityId;
    } else if (body && body.place && typeof body.place.cityId === "string") {
      responseCityId = body.place.cityId;
    }
    return originalJson.call(this, body);
  };

  res.once("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const cityPathMatch = req.path.match(/^\/api\/v1\/cities\/([^/]+)\/places(?:\/|$)/);
    const cityId =
      res.locals.affectedPlace?.cityId ||
      res.locals.place?.cityId ||
      responseCityId ||
      req.params.cityId ||
      (cityPathMatch && decodeURIComponent(cityPathMatch[1])) ||
      (req.body && req.body.cityId) ||
      "";

    emitPlacesUpdated(req, cityId);
  });

  next();
}

module.exports = { emitPlacesUpdated, placeMutationEvents };
