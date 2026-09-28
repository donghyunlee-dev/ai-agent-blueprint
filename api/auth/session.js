import { requireSession } from "../_lib/session.js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  const result = requireSession(req);
  if (!result.ok) return sendJson(res, 401, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, user: result.user });
}
