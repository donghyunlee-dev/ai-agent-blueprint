import { buildSessionClearCookieHeader } from "../_lib/session.js";
import { rejectCrossOriginMutation } from "../_lib/require-session.js";

export default function handler(req, res) {
  if (rejectCrossOriginMutation(req, res)) return;
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }
  res.setHeader("Set-Cookie", buildSessionClearCookieHeader());
  res.statusCode = 204;
  res.end();
}
