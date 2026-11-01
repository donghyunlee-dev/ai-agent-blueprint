import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import sessionHandler from "../../api/auth/session.js";
import { signSession, buildSessionCookieHeader, sessionCookieName } from "../../api/_lib/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.APP_SESSION_SECRET = "test-session-secret-with-sufficient-length";
  process.env.APP_SESSION_TTL_SECONDS = "28800";
});

test("GET /api/auth/session returns 401 when there is no session cookie", async () => {
  const req = createMockReq({ url: "/api/auth/session" });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), { error: "AUTH_REQUIRED" });
});

test("GET /api/auth/session reports a missing signing secret as unavailable", async () => {
  const secret = process.env.APP_SESSION_SECRET;
  delete process.env.APP_SESSION_SECRET;
  try {
    const req = createMockReq({ url: "/api/auth/session" });
    const res = createMockRes();
    await sessionHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(JSON.parse(res.body), { error: "AUTH_UNAVAILABLE" });
  } finally {
    process.env.APP_SESSION_SECRET = secret;
  }
});

test("GET /api/auth/session returns 401 for a tampered session cookie", async () => {
  const { value } = signSession({ issuer: "https://accounts.google.com", subject: "subject-1", email: "user@example.com" });
  const req = createMockReq({
    url: "/api/auth/session",
    cookie: `${sessionCookieName()}=${encodeURIComponent(value)}x`,
  });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 401);
});

test("GET /api/auth/session returns 401 for a correctly signed legacy-audience session cookie", async () => {
  const payload = Buffer.from(JSON.stringify({
    user: { issuer: "https://accounts.google.com", subject: "subject-1", email: "user@example.com" },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
    audience: "sfood-agent-blueprint",
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.APP_SESSION_SECRET).update(payload).digest("base64url");
  const value = `${payload}.${signature}`;
  const req = createMockReq({
    url: "/api/auth/session",
    cookie: `${sessionCookieName()}=${encodeURIComponent(value)}`,
  });
  const res = createMockRes();

  await sessionHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), { error: "AUTH_REQUIRED" });
});

test("GET /api/auth/session returns 200 and the user for a valid session cookie", async () => {
  const { value } = signSession({ issuer: "https://accounts.google.com", subject: "subject-1", email: "user@example.com" });
  const cookieHeader = buildSessionCookieHeader(value).split(";")[0];
  const req = createMockReq({ url: "/api/auth/session", cookie: cookieHeader });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    authenticated: true,
    user: { issuer: "https://accounts.google.com", subject: "subject-1", email: "user@example.com" },
  });
});

test("POST /api/auth/session clears the session cookie and returns 204", async () => {
  const req = createMockReq({ method: "POST", url: "/api/auth/session", headers: { host: "app.example", origin: "http://app.example" } });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 204);
  assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.match(res.headers["Set-Cookie"], /SameSite=Lax/);
  assert.match(res.headers["Set-Cookie"], /Path=\//);
});

test("POST /api/auth/session rejects cross-origin and originless requests without clearing a valid session cookie", async () => {
  const { value } = signSession({ issuer: "https://accounts.google.com", subject: "logout-csrf-user" });
  const cookie = `${sessionCookieName()}=${encodeURIComponent(value)}`;

  for (const headers of [
    { host: "app.example", "x-forwarded-proto": "https", origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    { host: "app.example", "x-forwarded-proto": "https" },
  ]) {
    const req = createMockReq({ method: "POST", url: "/api/auth/session", cookie, headers });
    const res = createMockRes();
    await sessionHandler(req, res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(JSON.parse(res.body), { error: "CSRF_REJECTED" });
    assert.equal(res.headers["Set-Cookie"], undefined);
  }
});

test("POST /api/auth/session accepts same-origin requests and clears the session cookie", async () => {
  const { value } = signSession({ issuer: "https://accounts.google.com", subject: "logout-same-origin-user" });
  const req = createMockReq({
    method: "POST",
    url: "/api/auth/session",
    cookie: `${sessionCookieName()}=${encodeURIComponent(value)}`,
    headers: { host: "app.example", "x-forwarded-proto": "https", origin: "https://app.example", "sec-fetch-site": "same-origin" },
  });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 204);
  assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
});

test("POST /api/auth/session in production clears the __Host- cookie with Secure", async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const req = createMockReq({ method: "POST", url: "/api/auth/session", headers: { host: "app.example", "x-forwarded-proto": "https", origin: "https://app.example" } });
    const res = createMockRes();
    await sessionHandler(req, res);
    assert.equal(res.statusCode, 204);
    assert.match(res.headers["Set-Cookie"], /^__Host-sfb_session=/);
    assert.match(res.headers["Set-Cookie"], /Secure/);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test("POST /api/auth/session is idempotent when called twice", async () => {
  const req1 = createMockReq({ method: "POST", url: "/api/auth/session", headers: { host: "app.example", origin: "http://app.example" } });
  const res1 = createMockRes();
  await sessionHandler(req1, res1);
  assert.equal(res1.statusCode, 204);

  const req2 = createMockReq({ method: "POST", url: "/api/auth/session", headers: { host: "app.example", origin: "http://app.example" } });
  const res2 = createMockRes();
  await sessionHandler(req2, res2);
  assert.equal(res2.statusCode, 204);
});

test("unsupported /api/auth/session methods return 405", async () => {
  const res = createMockRes();
  await sessionHandler(createMockReq({ method: "DELETE", url: "/api/auth/session" }), res);
  assert.equal(res.statusCode, 405);
});
