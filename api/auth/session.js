import crypto from "node:crypto";
import { buildSessionClearCookieHeader, requireSession, signSession, buildSessionCookieHeader } from "../_lib/session.js";
import { rejectCrossOriginMutation } from "../_lib/require-session.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function bootstrapPreviewSession(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const finish = (status) => {
    res.statusCode = status;
    res.end();
  };
  const expectedToken = process.env.PREVIEW_E2E_SESSION_TOKEN;
  if (!expectedToken?.trim()) return finish(404);
  const actualToken = req.headers["x-preview-e2e-session-token"];
  if (typeof actualToken !== "string") return finish(401);
  // Fixed-length digests keep comparison constant-time for all token lengths.
  const actual = crypto.createHash("sha256").update(actualToken).digest();
  const expected = crypto.createHash("sha256").update(expectedToken).digest();
  if (!crypto.timingSafeEqual(actual, expected)) return finish(401);
  if (!process.env.APP_SESSION_SECRET) return finish(503);

  const { value } = signSession({
    issuer: "https://accounts.google.com",
    subject: "blueprint-preview-e2e-synthetic",
    email: "preview-e2e@blueprint.example.test",
  });
  const cookie = buildSessionCookieHeader(value);
  res.setHeader("Set-Cookie", cookie.includes("; Secure") ? cookie : `${cookie}; Secure`);
  return finish(204);
}

export default function handler(req, res) {
  if (req.method === "POST") {
    if (rejectCrossOriginMutation(req, res)) return;
    if (process.env.VERCEL_ENV === "preview" && Object.hasOwn(req.headers || {}, "x-preview-e2e-session-token")) {
      return bootstrapPreviewSession(req, res);
    }
    res.setHeader("Set-Cookie", buildSessionClearCookieHeader());
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  if (!process.env.APP_SESSION_SECRET) return sendJson(res, 503, { error: "AUTH_UNAVAILABLE" });
  const result = requireSession(req);
  if (!result.ok) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
  return sendJson(res, 200, { authenticated: true, user: result.user });
}
