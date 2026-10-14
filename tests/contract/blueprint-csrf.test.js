import { test, before } from "node:test";
import assert from "node:assert/strict";
import chatHandler from "../../api/blueprint/chat.js";
import requirementsHandler from "../../api/blueprint/requirements.js";
import prdHandler from "../../api/blueprint/prd.js";
import { signSession, sessionCookieName } from "../../api/_lib/session.js";
import { createMockReq, createMockRes } from "../fixtures/http.js";

before(() => {
  process.env.APP_SESSION_SECRET = "test-session-secret-with-sufficient-length";
});

const endpoints = [
  ["chat", chatHandler, { message: "서비스를 설명합니다" }],
  ["requirements", requirementsHandler, { formData: {} }],
  ["prd", prdHandler, { title: "PRD" }],
];

function sessionCookie() {
  const { value } = signSession({ issuer: "https://accounts.google.com", subject: "csrf-test" });
  return `${sessionCookieName()}=${encodeURIComponent(value)}`;
}

for (const [name, handler, body] of endpoints) {
  test(`POST /api/blueprint/${name} rejects cross-origin and originless mutations before AI work`, async () => {
    let aiCalls = 0;
    const requestStructuredOutput = async () => { aiCalls += 1; return {}; };
    const cookie = sessionCookie();

    for (const headers of [
      { host: "app.example", "x-forwarded-proto": "https", origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
      { host: "app.example", "x-forwarded-proto": "https" },
    ]) {
      const req = createMockReq({ method: "POST", url: `/api/blueprint/${name}`, cookie, headers, body });
      const res = createMockRes();
      req.body = body;
      await handler(req, res, { requestStructuredOutput });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(JSON.parse(res.body), { error: "CSRF_REJECTED" });
    }

    assert.equal(aiCalls, 0);
  });

  test(`POST /api/blueprint/${name} accepts a same-origin request with a valid session`, async () => {
    let aiCalls = 0;
    const requestStructuredOutput = async () => { aiCalls += 1; return { title: "Test", summary: "Test", reportMarkdown: "Test", guideDocs: [] }; };
    const req = createMockReq({
      method: "POST",
      url: `/api/blueprint/${name}`,
      cookie: sessionCookie(),
      headers: { host: "app.example", "x-forwarded-proto": "https", origin: "https://app.example", "sec-fetch-site": "same-origin" },
      body,
    });
    req.body = body;
    const res = createMockRes();

    await handler(req, res, { requestStructuredOutput });

    assert.equal(res.statusCode, 200);
    assert.equal(aiCalls, 1);
  });
}
