import crypto from "node:crypto";
import { validateReturnTo } from "../../_lib/return-to.js";
import { buildTransactionCookieHeader } from "../../_lib/auth-transaction.js";

function sendErrorRedirect(res) {
  res.statusCode = 302;
  res.setHeader("Location", "/login?error=AUTH_UNAVAILABLE");
  res.end();
}

export default function handler(req, res) {
  if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !redirectUri || !process.env.APP_BASE_URL) throw new Error("GOOGLE_OIDC_NOT_CONFIGURED");
    const url = new URL(req.url, process.env.APP_BASE_URL);
    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const codeVerifier = crypto.randomBytes(48).toString("base64url");
    const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }).toString();
    const transaction = { state, nonce, codeVerifier, returnTo: validateReturnTo(url.searchParams.get("returnTo")) };
    res.setHeader("Set-Cookie", buildTransactionCookieHeader(transaction));
    res.statusCode = 302;
    res.setHeader("Location", authorizationUrl.toString());
    res.end();
  } catch { sendErrorRedirect(res); }
}
