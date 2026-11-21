class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: "Route not found" });
}

function errorHandler(error, _req, res, _next) {
  if (error.name === "ZodError") {
    return res.status(400).json({
      error: "Validation failed",
      details: error.errors.map((item) => ({ field: item.path.join("."), message: item.message })),
    });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: "Duplicate value" });
  }
  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ error: error.message });
  }
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : "Internal server error",
  });
}

module.exports = { ApiError, notFound, errorHandler };
