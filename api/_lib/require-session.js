import { requireSession } from "./session.js";

export function rejectUnauthenticated(req, res) {
  if (requireSession(req).ok) return false;
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "AUTH_REQUIRED" }));
  return true;
}
