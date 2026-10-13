import crypto from "node:crypto";

const COOKIE_BASE_NAME = "sfb_session";
const SESSION_AUDIENCE = "sfood-agent-blueprint";
const DEFAULT_TTL_SECONDS = 28800;

function isProduction() { return process.env.NODE_ENV === "production"; }
export function sessionCookieName() { return isProduction() ? `__Host-${COOKIE_BASE_NAME}` : COOKIE_BASE_NAME; }

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value) throw new Error("APP_SESSION_SECRET_NOT_CONFIGURED");
  return value;
}

export function parseCookies(cookieHeader) {
  const result = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { result[name] = decodeURIComponent(value); } catch { result[name] = value; }
  }
  return result;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; HttpOnly${isProduction() ? "; Secure" : ""}${maxAge === undefined ? "" : `; Max-Age=${maxAge}`}`;
}

function ttl() {
  const value = Number(process.env.APP_SESSION_TTL_SECONDS);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_TTL_SECONDS;
}

export function signSession(identity) {
  if (!identity || typeof identity.issuer !== "string" || typeof identity.subject !== "string") throw new Error("INVALID_SESSION_IDENTITY");
  const issuedAt = Date.now();
  const session = {
    user: { issuer: identity.issuer, subject: identity.subject, ...(typeof identity.email === "string" ? { email: identity.email } : {}) },
    issuedAt,
    expiresAt: issuedAt + ttl() * 1000,
    audience: SESSION_AUDIENCE,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return { value: `${payload}.${signature}`, session };
}

export function verifySession(value) {
  if (typeof value !== "string") return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = value.slice(0, separator);
  const actual = Buffer.from(value.slice(separator + 1));
  let expected;
  try { expected = Buffer.from(crypto.createHmac("sha256", secret()).update(payload).digest("base64url")); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (session?.audience !== SESSION_AUDIENCE || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return null;
    if (typeof session.user?.issuer !== "string" || typeof session.user?.subject !== "string") return null;
    return session;
  } catch { return null; }
}

export function buildSessionCookieHeader(value) { return cookie(sessionCookieName(), value, ttl()); }
export function buildSessionClearCookieHeader() { return cookie(sessionCookieName(), "", 0); }

export function requireSession(req) {
  const raw = parseCookies(req.headers?.cookie)[sessionCookieName()];
  const session = raw ? verifySession(raw) : null;
  return session ? { ok: true, user: session.user } : { ok: false };
}
