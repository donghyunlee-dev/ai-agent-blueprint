import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { signSession, verifySession } from "../../api/_lib/session.js";

before(() => {
  process.env.AX_SESSION_SECRET = "test-session-secret";
  process.env.AX_SESSION_TTL_SECONDS = "28800";
});

test("signSession then verifySession round-trips the user", () => {
  const { value } = signSession({ email: "user@s-food.com", clientId: "client-1" });
  const session = verifySession(value);
  assert.ok(session);
  assert.equal(session.user.email, "user@s-food.com");
  assert.equal(session.user.clientId, "client-1");
  assert.equal(session.audience, "sfood-agent-blueprint");
});

test("verifySession rejects a tampered signature", () => {
  const { value } = signSession({ email: "user@s-food.com", clientId: "client-1" });
  const [payload, signature] = value.split(".");
  const tamperedChar = signature.at(-1) === "A" ? "B" : "A";
  const tampered = `${payload}.${signature.slice(0, -1)}${tamperedChar}`;
  assert.equal(verifySession(tampered), null);
});

test("verifySession rejects a tampered payload", () => {
  const { value } = signSession({ email: "user@s-food.com", clientId: "client-1" });
  const [, signature] = value.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({
    user: { email: "attacker@s-food.com", clientId: "client-1" },
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000,
    audience: "sfood-agent-blueprint",
  })).toString("base64url");
  assert.equal(verifySession(`${forgedPayload}.${signature}`), null);
});

test("verifySession rejects an expired session", () => {
  const secret = process.env.AX_SESSION_SECRET;
  const session = {
    user: { email: "user@s-food.com", clientId: "client-1" },
    issuedAt: Date.now() - 10_000,
    expiresAt: Date.now() - 1_000,
    audience: "sfood-agent-blueprint",
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  assert.equal(verifySession(`${payload}.${signature}`), null);
});

test("verifySession rejects malformed input", () => {
  assert.equal(verifySession(""), null);
  assert.equal(verifySession(undefined), null);
  assert.equal(verifySession("not-a-valid-cookie-value"), null);
});
