import { signSession, buildSessionCookieHeader } from "../../_lib/session.js";
import { readTransactionState, buildTransactionClearCookieHeader } from "../../_lib/auth-transaction.js";
import { exchangeAuthorizationCode, verifyGoogleIdToken } from "../../_lib/google-oidc.js";
import { getAuthStore, getRequestIp } from "../../_lib/auth-store.js";

const CALLBACK_RATE_LIMIT = 20;
const RATE_WINDOW_SECONDS = 900;

function redirectError(res, cookies = []) {
  res.statusCode = 302;
  res.setHeader("Set-Cookie", cookies);
  res.setHeader("Location", "/login?error=AUTH_UNAVAILABLE");
  res.end();
}

function sendUnavailable(res, clearCookie) {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (clearCookie) res.setHeader("Set-Cookie", [clearCookie]);
  res.end(JSON.stringify({ error: "AUTH_UNAVAILABLE" }));
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
  let clearCookie;
  let store;
  try {
    clearCookie = buildTransactionClearCookieHeader();
    store = deps.store || getAuthStore();
  } catch {
    sendUnavailable(res, clearCookie);
    return;
  }
  let withinRateLimit;
  try {
    withinRateLimit = await store.checkRateLimit("google-callback", getRequestIp(req), CALLBACK_RATE_LIMIT, RATE_WINDOW_SECONDS);
  } catch {
    sendUnavailable(res, clearCookie);
    return;
  }
  if (!withinRateLimit) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Set-Cookie", [clearCookie]);
    res.end(JSON.stringify({ error: "AUTH_RATE_LIMITED" }));
    return;
  }
  let url;
  let code;
  let transaction;
  try {
    url = new URL(req.url, process.env.APP_BASE_URL || "http://localhost");
    code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = readTransactionState(req);
    if (!cookieState || !state || state !== cookieState) return redirectError(res, [clearCookie]);
    transaction = await store.consumeTransaction(state);
  } catch {
    sendUnavailable(res, clearCookie);
    return;
  }
  if (!transaction) return redirectError(res, [clearCookie]);
  if (!code || url.searchParams.has("error")) return redirectError(res, [clearCookie]);
  try {
    const exchange = deps.exchangeCode || exchangeAuthorizationCode;
    const verify = deps.verifyIdToken || verifyGoogleIdToken;
    const tokens = await exchange({ code, codeVerifier: transaction.codeVerifier });
    if (!tokens?.id_token) throw new Error("GOOGLE_ID_TOKEN_MISSING");
    const identity = await verify(tokens.id_token, transaction.nonce);
    if (!identity || identity.issuer !== "https://accounts.google.com" || !identity.subject) throw new Error("GOOGLE_IDENTITY_INVALID");
    const { value } = signSession(identity);
    res.statusCode = 302;
    res.setHeader("Set-Cookie", [buildSessionCookieHeader(value), clearCookie]);
    res.setHeader("Location", transaction.returnTo);
    res.end();
  } catch {
    redirectError(res, clearCookie ? [clearCookie] : []);
  }
}
