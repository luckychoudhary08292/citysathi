class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

function errorHandler(error, _req, res, _next) {
  if (error.name === "ZodError") {
    const issues = error.issues || error.errors || [];
    const message = issues.length
      ? issues.map((item) => item.message).join(" ")
      : "Validation failed";
    return res.status(400).json({ message });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "An account with this username or email already exists." });
  }
  if (error.message === "Origin is not allowed by CORS") {
    return res.status(403).json({ message: error.message });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must contain valid JSON." });
  }
  if (!error.statusCode || error.statusCode >= 500) console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Internal server error",
  });
}

module.exports = { ApiError, notFound, errorHandler };
