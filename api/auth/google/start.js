import crypto from "node:crypto";
import { validateReturnTo } from "../../_lib/return-to.js";
import { buildTransactionCookieHeader } from "../../_lib/auth-transaction.js";
import { getAuthStore, getRequestIp } from "../../_lib/auth-store.js";

const TRANSACTION_TTL_SECONDS = 300;
const START_RATE_LIMIT = 10;
const RATE_WINDOW_SECONDS = 900;

function sendStatus(res, status) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: status === 429 ? "AUTH_RATE_LIMITED" : "AUTH_UNAVAILABLE" }));
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
  let store;
  try {
    store = deps.store || getAuthStore();
    if (!await store.checkRateLimit("google-start", getRequestIp(req), START_RATE_LIMIT, RATE_WINDOW_SECONDS)) {
      sendStatus(res, 429);
      return;
    }
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
    if (!await store.createTransaction(state, transaction, TRANSACTION_TTL_SECONDS)) throw new Error("AUTH_TRANSACTION_STORE_FAILED");
    res.setHeader("Set-Cookie", buildTransactionCookieHeader(state));
    res.statusCode = 302;
    res.setHeader("Location", authorizationUrl.toString());
    res.end();
  } catch { sendStatus(res, 503); }
}
