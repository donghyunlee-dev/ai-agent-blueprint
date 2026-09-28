import { test, before } from "node:test";
import assert from "node:assert/strict";
import handler from "../../api/auth/login.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.AX_AUTH_BASE_URL = "https://ax-auth.s-food.ai";
  process.env.AX_AUTH_CLIENT_ID = "client-1";
  process.env.AX_AUTH_REDIRECT_URI = "https://blueprint.s-food.ai/api/auth/callback";
});

test("valid returnTo is stored in a short-lived cookie and redirects to AX login", () => {
  const req = createMockReq({ url: "/api/auth/login?returnTo=/blueprints/p-1" });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.match(res.headers["Set-Cookie"], /sfb_return_to=%2Fblueprints%2Fp-1/);
  assert.match(res.headers["Set-Cookie"], /HttpOnly/);
  assert.equal(res.headers.Location, "https://ax-auth.s-food.ai/auth/login/client-1?redirect_uri=https%3A%2F%2Fblueprint.s-food.ai%2Fapi%2Fauth%2Fcallback");
});

test("invalid returnTo (external URL) falls back to / before redirecting to AX", () => {
  const req = createMockReq({ url: "/api/auth/login?returnTo=https://evil.com" });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.match(res.headers["Set-Cookie"], /sfb_return_to=%2F(;|$)/);
});

test("missing returnTo defaults to /", () => {
  const req = createMockReq({ url: "/api/auth/login" });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 302);
  assert.match(res.headers["Set-Cookie"], /sfb_return_to=%2F(;|$)/);
});

test("non-GET method is rejected", () => {
  const req = createMockReq({ method: "POST", url: "/api/auth/login" });
  const res = createMockRes();
  handler(req, res);
  assert.equal(res.statusCode, 405);
});

test("missing AX_AUTH_REDIRECT_URI redirects to AUTH_UNAVAILABLE instead of throwing", () => {
  const previousRedirectUri = process.env.AX_AUTH_REDIRECT_URI;
  delete process.env.AX_AUTH_REDIRECT_URI;
  try {
    const req = createMockReq({ url: "/api/auth/login" });
    const res = createMockRes();
    handler(req, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login?error=AUTH_UNAVAILABLE");
  } finally {
    if (previousRedirectUri === undefined) delete process.env.AX_AUTH_REDIRECT_URI;
    else process.env.AX_AUTH_REDIRECT_URI = previousRedirectUri;
  }
});

test("unparseable AX_AUTH_BASE_URL redirects to AUTH_UNAVAILABLE instead of throwing", () => {
  const previousBaseUrl = process.env.AX_AUTH_BASE_URL;
  process.env.AX_AUTH_BASE_URL = "";
  try {
    const req = createMockReq({ url: "/api/auth/login" });
    const res = createMockRes();
    handler(req, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.Location, "/login?error=AUTH_UNAVAILABLE");
  } finally {
    if (previousBaseUrl === undefined) delete process.env.AX_AUTH_BASE_URL;
    else process.env.AX_AUTH_BASE_URL = previousBaseUrl;
  }
});
