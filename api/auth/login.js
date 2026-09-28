import { buildAxLoginRedirectUrl } from "../_lib/ax-auth.js";
import { validateReturnTo, buildReturnToCookieHeader } from "../_lib/session.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    const returnTo = validateReturnTo(url.searchParams.get("returnTo"));
    res.setHeader("Set-Cookie", buildReturnToCookieHeader(returnTo));
    res.statusCode = 302;
    res.setHeader("Location", buildAxLoginRedirectUrl());
    res.end();
  } catch (error) {
    console.error("auth/login failed:", error?.message || "unknown error");
    res.statusCode = 302;
    res.setHeader("Location", "/login?error=AUTH_UNAVAILABLE");
    res.end();
  }
}
