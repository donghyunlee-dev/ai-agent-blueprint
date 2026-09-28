import crypto from "node:crypto";

const SESSION_COOKIE_BASE_NAME = "sfb_session";
const RETURN_TO_COOKIE_NAME = "sfb_return_to";
const SESSION_AUDIENCE = "sfood-agent-blueprint";
const RETURN_TO_MAX_AGE_SECONDS = 300;
const DEFAULT_SESSION_TTL_SECONDS = 28800;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieName() {
  return isProduction() ? `__Host-${SESSION_COOKIE_BASE_NAME}` : SESSION_COOKIE_BASE_NAME;
}

export function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

export function buildCookieHeader(name, value, options = {}) {
  const { maxAge, httpOnly = true, sameSite = "Lax", path = "/", secure = isProduction() } = options;
  const segments = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) segments.push("HttpOnly");
  if (secure) segments.push("Secure");
  if (typeof maxAge === "number") segments.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return segments.join("; ");
}

export function buildClearCookieHeader(name, options = {}) {
  return buildCookieHeader(name, "", { ...options, maxAge: 0 });
}

// returnTo must be a same-origin internal path. Reject protocol-relative
// ("//host"), absolute URLs, backslash tricks, and control characters.
export function validateReturnTo(returnTo) {
  const DEFAULT_RETURN_TO = "/";
  if (typeof returnTo !== "string" || returnTo.length === 0) return DEFAULT_RETURN_TO;
  if (!returnTo.startsWith("/")) return DEFAULT_RETURN_TO;
  if (returnTo.startsWith("//")) return DEFAULT_RETURN_TO;
  if (returnTo.includes("\\")) return DEFAULT_RETURN_TO;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(returnTo)) return DEFAULT_RETURN_TO;
  return returnTo;
}

export function buildReturnToCookieHeader(returnTo) {
  return buildCookieHeader(RETURN_TO_COOKIE_NAME, returnTo, { maxAge: RETURN_TO_MAX_AGE_SECONDS });
}

export function buildReturnToClearCookieHeader() {
  return buildClearCookieHeader(RETURN_TO_COOKIE_NAME);
}

export function readReturnToCookie(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return validateReturnTo(cookies[RETURN_TO_COOKIE_NAME]);
}

function getSessionSecret() {
  const secret = process.env.AX_SESSION_SECRET;
  if (!secret) throw new Error("AX_SESSION_SECRET_NOT_CONFIGURED");
  return secret;
}

function getSessionTtlSeconds() {
  const raw = Number(process.env.AX_SESSION_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_TTL_SECONDS;
}

// Signs {user, issuedAt, expiresAt, audience} as base64url(payload).base64url(hmac-sha256).
export function signSession(user) {
  const now = Date.now();
  const session = {
    user: { email: user.email, clientId: user.clientId },
    issuedAt: now,
    expiresAt: now + getSessionTtlSeconds() * 1000,
    audience: SESSION_AUDIENCE,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return { value: `${payload}.${signature}`, session };
}

export function verifySession(cookieValue) {
  if (typeof cookieValue !== "string" || !cookieValue.includes(".")) return null;
  const separatorIndex = cookieValue.lastIndexOf(".");
  const payload = cookieValue.slice(0, separatorIndex);
  const signature = cookieValue.slice(separatorIndex + 1);
  if (!payload || !signature) return null;

  let expectedSignature;
  try {
    expectedSignature = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  } catch {
    return null;
  }
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!session || session.audience !== SESSION_AUDIENCE) return null;
  if (typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return null;
  if (!session.user || typeof session.user.email !== "string" || typeof session.user.clientId !== "string") return null;
  return session;
}

export function buildSessionCookieHeader(cookieValue) {
  return buildCookieHeader(sessionCookieName(), cookieValue, { maxAge: getSessionTtlSeconds() });
}

export function buildSessionClearCookieHeader() {
  return buildClearCookieHeader(sessionCookieName());
}

export function requireSession(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const raw = cookies[sessionCookieName()];
  const session = raw ? verifySession(raw) : null;
  if (!session) return { ok: false };
  return { ok: true, user: session.user };
}
