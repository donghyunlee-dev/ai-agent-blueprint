import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import chatHandler from "../../api/blueprint/chat.js";
import requirementsHandler from "../../api/blueprint/requirements.js";
import prdHandler from "../../api/blueprint/prd.js";
import documentsGenerateHandler from "../../api/blueprint/documents/generate.js";
import reviewHandler from "../../api/blueprint/review.js";
import patchHandler from "../../api/blueprint/documents/patch.js";
import requirementsReadyHandler from "../../api/blueprint/documents/requirements/ready.js";
import setupGuideReadyHandler from "../../api/blueprint/documents/setup-guide/ready.js";
import { sessionCookieName } from "../../api/_lib/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.APP_SESSION_SECRET = "test-session-secret-with-sufficient-length";
});

function expiredSessionCookie() {
  const payload = Buffer.from(JSON.stringify({
    user: { issuer: "https://accounts.google.com", subject: "expired-subject" },
    issuedAt: Date.now() - 120_000,
    expiresAt: Date.now() - 60_000,
    audience: "windsoft-agent-blueprint",
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.APP_SESSION_SECRET).update(payload).digest("base64url");
  return `${sessionCookieName()}=${encodeURIComponent(`${payload}.${signature}`)}`;
}

function sideEffectStore(counter) {
  return new Proxy({}, { get() { counter.calls += 1; throw new Error("Store should not be accessed before authentication"); } });
}

for (const [name, handler, body] of [
  ["chat", chatHandler, { message: "서비스를 설명합니다" }],
  ["requirements", requirementsHandler, { formData: {} }],
  ["prd", prdHandler, { title: "PRD" }],
]) {
  test(`POST /api/blueprint/${name} rejects missing or expired sessions before AI work`, async () => {
    let aiCalls = 0;
    const storeEffects = { calls: 0 };
    const requestStructuredOutput = async () => { aiCalls += 1; throw new Error("AI should not run"); };

    for (const cookie of [undefined, expiredSessionCookie()]) {
      const req = createMockReq({ method: "POST", url: `/api/blueprint/${name}`, cookie });
      const res = createMockRes();
      await handler(req, res, { requestStructuredOutput, store: sideEffectStore(storeEffects) });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(JSON.parse(res.body), { error: "AUTH_REQUIRED" });
    }

    assert.equal(aiCalls, 0);
    assert.equal(storeEffects.calls, 0);
  });
}

for (const [path, handler] of [
  ["/api/blueprint/review", reviewHandler],
  ["/api/blueprint/documents/patch", patchHandler],
  ["/api/blueprint/documents/generate", documentsGenerateHandler],
  ["/api/blueprint/documents/requirements/ready", requirementsReadyHandler],
  ["/api/blueprint/documents/setup-guide/ready", setupGuideReadyHandler],
]) {
  test(`POST ${path} rejects missing or expired sessions before side effects`, async () => {
    let providerCalls = 0;
    const storeEffects = { calls: 0 };
    for (const cookie of [undefined, expiredSessionCookie()]) {
      const req = createMockReq({ method: "POST", url: path, cookie });
      req.body = {};
      const res = createMockRes();
      await handler(req, res, { requestStructuredOutput: async () => { providerCalls += 1; }, store: sideEffectStore(storeEffects) });
      assert.equal(res.statusCode, 401);
      assert.deepEqual(JSON.parse(res.body), { error: "AUTH_REQUIRED" });
    }
    assert.equal(providerCalls, 0);
    assert.equal(storeEffects.calls, 0);
  });
}
