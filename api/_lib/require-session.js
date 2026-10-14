import { requireSession } from "./session.js";
import { isSameOriginMutation } from "./same-origin.js";

export function rejectUnauthenticated(req, res) {
  if (requireSession(req).ok) return false;
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "AUTH_REQUIRED" }));
  return true;
}

export function rejectCrossOriginMutation(req, res) {
  if (isSameOriginMutation(req)) return false;
  res.statusCode = 403;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "CSRF_REJECTED" }));
  return true;
}
