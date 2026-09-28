import { test, before } from "node:test";
import assert from "node:assert/strict";
import handler from "../../api/auth/callback.js";
import { buildReturnToCookieHeader } from "../../api/_lib/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";
import {
  validFixture,
  tokenNotFound,
  tokenClientMismatch,
  tokenExpired,
  tokenAlreadyUsed,
  invalidClient,
  clientDisabled,
  invalidSecret,
} from "../fixtures/ax-auth.js";

before(() => {
  process.env.AX_SESSION_SECRET = "test-session-secret";
  process.env.AX_SESSION_TTL_SECONDS = "28800";
  process.env.AX_AUTH_CLIENT_ID = "client-1";
});

test("valid login_token issues a session cookie and redirects to the stored returnTo", async () => {
  const req = createMockReq({
    url: "/api/auth/callback?login_token=T",
    cookie: buildReturnToCookieHeader("/blueprints/p-1").split(";")[0],
  });
  const res = createMockRes();
  let calledWith;
  await handler(req, res, {
    verifyLoginToken: async (token) => {
      calledWith = token;
      return validFixture({ clientId: "client-1" });
    },
  });
  assert.equal(calledWith, "T");
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/blueprints/p-1");
  assert.ok(res.headers["Set-Cookie"], "session cookie must be issued");
});

test("valid login_token without a stored returnTo redirects to /", async () => {
  const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res = createMockRes();
  await handler(req, res, { verifyLoginToken: async () => validFixture({ clientId: "client-1" }) });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/");
});

const invalidReasonCases = [
  ["TOKEN_NOT_FOUND", tokenNotFound],
  ["TOKEN_CLIENT_MISMATCH", tokenClientMismatch],
  ["TOKEN_EXPIRED", tokenExpired],
  ["TOKEN_ALREADY_USED", tokenAlreadyUsed],
];

for (const [reason, fixture] of invalidReasonCases) {
  test(`AX reason ${reason} maps to AUTH_TOKEN_INVALID and issues no session`, async () => {
    const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
    const res = createMockRes();
    await handler(req, res, { verifyLoginToken: async () => fixture() });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login?error=AUTH_TOKEN_INVALID");
    assert.equal(res.headers["Set-Cookie"], undefined);
  });
}

const unavailableReasonCases = [
  ["INVALID_CLIENT", invalidClient],
  ["CLIENT_DISABLED", clientDisabled],
  ["INVALID_SECRET", invalidSecret],
];

for (const [reason, fixture] of unavailableReasonCases) {
  test(`AX reason ${reason} maps to AUTH_UNAVAILABLE and issues no session`, async () => {
    const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
    const res = createMockRes();
    await handler(req, res, { verifyLoginToken: async () => fixture() });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login?error=AUTH_UNAVAILABLE");
    assert.equal(res.headers["Set-Cookie"], undefined);
  });
}

test("a token reused twice is rejected both times without ever issuing a session", async () => {
  const req1 = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res1 = createMockRes();
  await handler(req1, res1, { verifyLoginToken: async () => validFixture({ clientId: "client-1" }) });
  assert.equal(res1.statusCode, 302);
  assert.ok(res1.headers["Set-Cookie"]);

  const req2 = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res2 = createMockRes();
  await handler(req2, res2, { verifyLoginToken: async () => tokenAlreadyUsed() });
  assert.equal(res2.statusCode, 302);
  assert.equal(res2.headers.Location, "/login?error=AUTH_TOKEN_INVALID");
  assert.equal(res2.headers["Set-Cookie"], undefined);
});

test("error=USER_NOT_ALLOWED on the callback query redirects without calling verify", async () => {
  const req = createMockReq({ url: "/api/auth/callback?error=USER_NOT_ALLOWED" });
  const res = createMockRes();
  let verifyCalled = false;
  await handler(req, res, { verifyLoginToken: async () => { verifyCalled = true; return validFixture(); } });
  assert.equal(verifyCalled, false);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/login?error=AUTH_NOT_ALLOWED");
});

test("missing login_token redirects to AUTH_TOKEN_INVALID without calling verify", async () => {
  const req = createMockReq({ url: "/api/auth/callback" });
  const res = createMockRes();
  let verifyCalled = false;
  await handler(req, res, { verifyLoginToken: async () => { verifyCalled = true; return validFixture(); } });
  assert.equal(verifyCalled, false);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/login?error=AUTH_TOKEN_INVALID");
});

test("AX network failure during verify maps to AUTH_UNAVAILABLE", async () => {
  const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res = createMockRes();
  await handler(req, res, { verifyLoginToken: async () => { throw new Error("fetch failed"); } });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/login?error=AUTH_UNAVAILABLE");
});

test("a valid token whose response clientId does not match the configured client is rejected", async () => {
  const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res = createMockRes();
  await handler(req, res, { verifyLoginToken: async () => validFixture({ clientId: "some-other-client" }) });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/login?error=AUTH_TOKEN_INVALID");
  assert.equal(res.headers["Set-Cookie"], undefined);
});

test("a missing AX_SESSION_SECRET at session-signing time redirects to AUTH_UNAVAILABLE instead of throwing", async () => {
  const previousSecret = process.env.AX_SESSION_SECRET;
  delete process.env.AX_SESSION_SECRET;
  try {
    const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
    const res = createMockRes();
    await handler(req, res, { verifyLoginToken: async () => validFixture({ clientId: "client-1" }) });
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login?error=AUTH_UNAVAILABLE");
    assert.equal(res.headers["Set-Cookie"], undefined);
  } finally {
    if (previousSecret === undefined) delete process.env.AX_SESSION_SECRET;
    else process.env.AX_SESSION_SECRET = previousSecret;
  }
});

test("session cookie issued on success includes HttpOnly, SameSite=Lax and Path=/", async () => {
  const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
  const res = createMockRes();
  await handler(req, res, { verifyLoginToken: async () => validFixture({ clientId: "client-1" }) });
  const [sessionCookie] = res.headers["Set-Cookie"];
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Lax/);
  assert.match(sessionCookie, /Path=\//);
});

test("session cookie issued in production includes Secure and the __Host- prefix", async () => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const req = createMockReq({ url: "/api/auth/callback?login_token=T" });
    const res = createMockRes();
    await handler(req, res, { verifyLoginToken: async () => validFixture({ clientId: "client-1" }) });
    const [sessionCookie] = res.headers["Set-Cookie"];
    assert.match(sessionCookie, /^__Host-sfb_session=/);
    assert.match(sessionCookie, /Secure/);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  }
});
