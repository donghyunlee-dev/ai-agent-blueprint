import { test, before } from "node:test";
import assert from "node:assert/strict";
import sessionHandler from "../../api/auth/session.js";
import logoutHandler from "../../api/auth/logout.js";
import { signSession, buildSessionCookieHeader, sessionCookieName } from "../../api/_lib/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.AX_SESSION_SECRET = "test-session-secret";
  process.env.AX_SESSION_TTL_SECONDS = "28800";
});

test("GET /api/auth/session returns 401 when there is no session cookie", async () => {
  const req = createMockReq({ url: "/api/auth/session" });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(JSON.parse(res.body), { authenticated: false });
});

test("GET /api/auth/session returns 401 for a tampered session cookie", async () => {
  const { value } = signSession({ email: "user@s-food.com", clientId: "client-1" });
  const req = createMockReq({
    url: "/api/auth/session",
    cookie: `${sessionCookieName()}=${encodeURIComponent(value)}x`,
  });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 401);
});

test("GET /api/auth/session returns 200 and the user for a valid session cookie", async () => {
  const { value } = signSession({ email: "user@s-food.com", clientId: "client-1" });
  const cookieHeader = buildSessionCookieHeader(value).split(";")[0];
  const req = createMockReq({ url: "/api/auth/session", cookie: cookieHeader });
  const res = createMockRes();
  await sessionHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), {
    authenticated: true,
    user: { email: "user@s-food.com", clientId: "client-1" },
  });
});

test("POST /api/auth/logout clears the session cookie and returns 204", async () => {
  const req = createMockReq({ method: "POST", url: "/api/auth/logout" });
  const res = createMockRes();
  await logoutHandler(req, res);
  assert.equal(res.statusCode, 204);
  assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.match(res.headers["Set-Cookie"], /SameSite=Lax/);
  assert.match(res.headers["Set-Cookie"], /Path=\//);
});

test("POST /api/auth/logout in production clears the __Host- cookie with Secure", async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const req = createMockReq({ method: "POST", url: "/api/auth/logout" });
    const res = createMockRes();
    await logoutHandler(req, res);
    assert.equal(res.statusCode, 204);
    assert.match(res.headers["Set-Cookie"], /^__Host-sfb_session=/);
    assert.match(res.headers["Set-Cookie"], /Secure/);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});

test("POST /api/auth/logout is idempotent when called twice", async () => {
  const req1 = createMockReq({ method: "POST", url: "/api/auth/logout" });
  const res1 = createMockRes();
  await logoutHandler(req1, res1);
  assert.equal(res1.statusCode, 204);

  const req2 = createMockReq({ method: "POST", url: "/api/auth/logout" });
  const res2 = createMockRes();
  await logoutHandler(req2, res2);
  assert.equal(res2.statusCode, 204);
});
