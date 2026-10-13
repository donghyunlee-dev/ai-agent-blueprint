import { signSession, buildSessionCookieHeader } from "../../_lib/session.js";
import { readTransactionCookie, buildTransactionClearCookieHeader } from "../../_lib/auth-transaction.js";
import { exchangeAuthorizationCode, verifyGoogleIdToken } from "../../_lib/google-oidc.js";

function redirectError(res, cookies = []) {
  res.statusCode = 302;
  res.setHeader("Set-Cookie", cookies);
  res.setHeader("Location", "/login?error=AUTH_UNAVAILABLE");
  res.end();
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }
  let clearCookie;
  try {
    clearCookie = buildTransactionClearCookieHeader();
    const url = new URL(req.url, process.env.APP_BASE_URL || "http://localhost");
    const transaction = readTransactionCookie(req);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!transaction || !code || !state || state !== transaction.state || url.searchParams.has("error")) return redirectError(res, [clearCookie]);
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
