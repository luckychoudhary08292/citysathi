function stringId(document) {
  const value = document && (document.id ?? document._id);
  return value == null ? "" : String(value);
}

function mongoId(document) {
  return document && document._id != null ? String(document._id) : "";
}

function stringArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = { stringId, mongoId, stringArray };
