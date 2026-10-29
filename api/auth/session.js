import { buildSessionClearCookieHeader, requireSession } from "../_lib/session.js";
import { rejectCrossOriginMutation } from "../_lib/require-session.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default function handler(req, res) {
  if (req.method === "POST") {
    if (rejectCrossOriginMutation(req, res)) return;
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
