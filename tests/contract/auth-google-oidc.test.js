import { test, before } from "node:test";
import assert from "node:assert/strict";
import startHandler from "../../api/auth/google/start.js";
import callbackHandler from "../../api/auth/google/callback.js";
import sessionHandler from "../../api/auth/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.APP_SESSION_SECRET = "unit-test-session-secret-with-sufficient-length";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:5173/api/auth/google/callback";
  process.env.APP_BASE_URL = "http://localhost:5173";
});

test("Google start uses only openid email, PKCE and a safe internal returnTo transaction", async () => {
  const req = createMockReq({ url: "/api/auth/google/start?returnTo=%2Fblueprints%2Fp1" });
  const res = createMockRes();
  await startHandler(req, res);
  const redirect = new URL(res.headers.Location);
  assert.equal(res.statusCode, 302);
  assert.equal(redirect.origin, "https://accounts.google.com");
  assert.equal(redirect.searchParams.get("scope"), "openid email");
  assert.ok(redirect.searchParams.get("state"));
  assert.ok(redirect.searchParams.get("nonce"));
  assert.ok(redirect.searchParams.get("code_challenge"));
  assert.equal(redirect.searchParams.get("code_challenge_method"), "S256");
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.match(res.headers["Set-Cookie"], /SameSite=Lax/);
  assert.equal(res.headers["Set-Cookie"].includes("Secure"), process.env.NODE_ENV === "production");
  assert.doesNotMatch(res.headers.Location, /client_secret|test-client-secret/);
});

test("Google start rejects external returnTo by storing the application root", async () => {
  const req = createMockReq({ url: "/api/auth/google/start?returnTo=https%3A%2F%2Fevil.example" });
  const res = createMockRes();
  await startHandler(req, res);
  assert.equal(res.statusCode, 302);
  assert.ok(res.headers["Set-Cookie"]);
});

test("callback validates transaction then exchanges code and issues identity-only session", async () => {
  const startReq = createMockReq({ url: "/api/auth/google/start?returnTo=%2Fblueprints%2Fp1" });
  const startRes = createMockRes();
  await startHandler(startReq, startRes);
  const state = new URL(startRes.headers.Location).searchParams.get("state");
  const transactionCookie = startRes.headers["Set-Cookie"].split(";")[0];
  const req = createMockReq({ url: `/api/auth/google/callback?code=private-code&state=${state}`, cookie: transactionCookie });
  const res = createMockRes();
  let exchangeOptions;
  await callbackHandler(req, res, {
    exchangeCode: async (options) => { exchangeOptions = options; return { id_token: "private-id-token", access_token: "private-access-token" }; },
    verifyIdToken: async () => ({ issuer: "https://accounts.google.com", subject: "subject-123", email: "person@example.com" }),
  });
  assert.equal(exchangeOptions.code, "private-code");
  assert.ok(exchangeOptions.codeVerifier);
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.Location, "/blueprints/p1");
  assert.doesNotMatch(JSON.stringify(res.headers), /private-code|private-id-token|private-access-token/);
  const sessionCookie = res.headers["Set-Cookie"].find((value) => value.startsWith("sfb_session="));
  assert.ok(sessionCookie);
  const sessionReq = createMockReq({ url: "/api/auth/session", cookie: sessionCookie.split(";")[0] });
  const sessionRes = createMockRes();
  await sessionHandler(sessionReq, sessionRes);
  assert.deepEqual(JSON.parse(sessionRes.body), { authenticated: true, user: { issuer: "https://accounts.google.com", subject: "subject-123", email: "person@example.com" } });
});

test("OAuth transaction can be consumed once only, including callback replay", async () => {
  const startReq = createMockReq({ url: "/api/auth/google/start" });
  const startRes = createMockRes();
  await startHandler(startReq, startRes);
  const state = new URL(startRes.headers.Location).searchParams.get("state");
  const transactionCookie = startRes.headers["Set-Cookie"].split(";")[0];
  let exchangeCount = 0;
  const deps = {
    exchangeCode: async () => { exchangeCount += 1; return { id_token: "private-id-token" }; },
    verifyIdToken: async () => ({ issuer: "https://accounts.google.com", subject: "subject-replay" }),
  };
  const request = () => createMockReq({ url: `/api/auth/google/callback?code=private-code&state=${state}`, cookie: transactionCookie });
  const first = createMockRes();
  await callbackHandler(request(), first, deps);
  const replay = createMockRes();
  await callbackHandler(request(), replay, deps);
  assert.equal(exchangeCount, 1);
  assert.ok(first.headers["Set-Cookie"].some((value) => value.startsWith("sfb_session=")));
  assert.equal((replay.headers["Set-Cookie"] || []).some((value) => value.startsWith("sfb_session=")), false);
});

test("Google OAuth cancellation consumes the matching transaction", async () => {
  const startRes = createMockRes();
  await startHandler(createMockReq({ url: "/api/auth/google/start" }), startRes);
  const state = new URL(startRes.headers.Location).searchParams.get("state");
  const cookie = startRes.headers["Set-Cookie"].split(";")[0];
  const store = (await import("../../api/_lib/auth-store.js")).getAuthStore();
  const cancelled = createMockRes();
  await callbackHandler(createMockReq({ url: `/api/auth/google/callback?error=access_denied&state=${state}`, cookie }), cancelled);
  assert.equal(cancelled.statusCode, 302);
  let exchangeCalled = false;
  const replay = createMockRes();
  await callbackHandler(createMockReq({ url: `/api/auth/google/callback?code=private&state=${state}`, cookie }), replay, {
    store,
    exchangeCode: async () => { exchangeCalled = true; return {}; },
  });
  assert.equal(exchangeCalled, false);
  assert.equal(replay.headers.Location, "/login?error=AUTH_UNAVAILABLE");
});

test("Google start returns 429 when its per-IP rate limit is exhausted", async () => {
  const res = createMockRes();
  await startHandler(createMockReq({ url: "/api/auth/google/start", headers: { "x-real-ip": "192.0.2.1" } }), res, {
    store: { checkRateLimit: async () => false },
  });
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers.Location, undefined);
});

test("Google start fails closed with generic 503 when persistent storage is unavailable", async () => {
  const res = createMockRes();
  await startHandler(createMockReq({ url: "/api/auth/google/start" }), res, {
    store: { checkRateLimit: async () => { throw new Error("private Redis connection detail"); } },
  });
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.body, /Redis|private|token/i);
});

test("callback returns 429 for an exhausted per-IP limit without consuming the transaction", async () => {
  let consumeCalled = false;
  let exchangeCalled = false;
  const res = createMockRes();
  await callbackHandler(createMockReq({ url: "/api/auth/google/callback?code=private&state=state-1", headers: { "x-real-ip": "192.0.2.4" } }), res, {
    store: {
      checkRateLimit: async (operation, ip, limit, windowSeconds) => {
        assert.equal(operation, "google-callback");
        assert.equal(ip, "192.0.2.4");
        assert.ok(limit > 0 && windowSeconds > 0);
        return false;
      },
      consumeTransaction: async () => { consumeCalled = true; return null; },
    },
    exchangeCode: async () => { exchangeCalled = true; },
  });
  assert.equal(res.statusCode, 429);
  assert.equal(consumeCalled, false);
  assert.equal(exchangeCalled, false);
});

test("callback fails closed with generic 503 when transaction storage fails", async () => {
  const res = createMockRes();
  await callbackHandler(createMockReq({ url: "/api/auth/google/callback?code=private&state=state-1", cookie: "sfb_oauth_tx=state-1" }), res, {
    store: {
      checkRateLimit: async () => true,
      consumeTransaction: async () => { throw new Error("private Redis connection detail"); },
    },
  });
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.body, /Redis|private|token/i);
});

test("callback does not exchange code for missing, mismatched or reused state", async (t) => {
  for (const state of [undefined, "wrong-state"]) {
    await t.test(`state=${state ?? "missing"}`, async () => {
      let exchangeCalled = false;
      const req = createMockReq({ url: `/api/auth/google/callback?code=private-code${state ? `&state=${state}` : ""}` });
      const res = createMockRes();
      await callbackHandler(req, res, { exchangeCode: async () => { exchangeCalled = true; }, verifyIdToken: async () => ({}) });
      assert.equal(exchangeCalled, false);
      assert.equal(res.statusCode, 302);
      assert.equal((res.headers["Set-Cookie"] || []).some((value) => value.startsWith("sfb_session=")), false);
      assert.doesNotMatch(res.headers.Location, /private-code|state/);
    });
  }
});

test("callback refuses unverified identities and leaks no credentials", async () => {
  const startReq = createMockReq({ url: "/api/auth/google/start" });
  const startRes = createMockRes();
  await startHandler(startReq, startRes);
  const state = new URL(startRes.headers.Location).searchParams.get("state");
  const req = createMockReq({ url: `/api/auth/google/callback?code=private-code&state=${state}`, cookie: startRes.headers["Set-Cookie"].split(";")[0] });
  const res = createMockRes();
  await callbackHandler(req, res, {
    exchangeCode: async () => ({ id_token: "private-id-token" }),
    verifyIdToken: async () => { throw new Error("unverified identity"); },
  });
  assert.equal((res.headers["Set-Cookie"] || []).some((value) => value.startsWith("sfb_session=")), false);
  assert.doesNotMatch(JSON.stringify(res.headers), /private-code|private-id-token/);
});

test("session POST clears the session cookie idempotently", async () => {
  for (let call = 0; call < 2; call += 1) {
    const res = createMockRes();
    await sessionHandler(createMockReq({ method: "POST", url: "/api/auth/session", headers: { host: "app.example", origin: "http://app.example" } }), res);
    assert.equal(res.statusCode, 204);
    assert.match(res.headers["Set-Cookie"], /Max-Age=0/);
  }
});
