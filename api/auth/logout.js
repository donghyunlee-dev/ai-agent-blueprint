import { buildSessionClearCookieHeader } from "../_lib/session.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  res.setHeader("Set-Cookie", buildSessionClearCookieHeader());
  res.statusCode = 204;
  res.end();
}
