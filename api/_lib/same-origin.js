const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0]?.split(",")[0]?.trim();
  return typeof value === "string" ? value.split(",")[0].trim() : undefined;
}

function parseOrigin(value) {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginMutation(req) {
  if (!UNSAFE_METHODS.has(String(req.method || "").toUpperCase())) return true;

  const headers = req.headers || {};
  if (firstHeaderValue(headers["sec-fetch-site"]) === "cross-site") return false;

  const originHeader = firstHeaderValue(headers.origin);
  let sourceOrigin;
  if (originHeader !== undefined) {
    sourceOrigin = parseOrigin(originHeader);
  } else {
    const referer = firstHeaderValue(headers.referer);
    sourceOrigin = parseOrigin(referer);
  }
  if (!sourceOrigin) return false;

  const host = firstHeaderValue(headers["x-forwarded-host"]) || firstHeaderValue(headers.host);
  const protocol = firstHeaderValue(headers["x-forwarded-proto"]) || req.protocol || (req.socket?.encrypted ? "https" : "http");
  if (!host || typeof protocol !== "string" || !/^[a-z][a-z0-9+.-]*$/i.test(protocol)) return false;

  try {
    return sourceOrigin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}
