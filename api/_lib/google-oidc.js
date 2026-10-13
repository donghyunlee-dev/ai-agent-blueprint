import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function exchangeAuthorizationCode({ code, codeVerifier }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) throw new Error("GOOGLE_CODE_EXCHANGE_FAILED");
  return response.json();
}

export async function verifyGoogleIdToken(idToken, nonce, options = {}) {
  const { payload } = await jwtVerify(idToken, options.jwks || GOOGLE_JWKS, {
    issuer: ISSUERS,
    audience: options.audience || process.env.GOOGLE_CLIENT_ID,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("GOOGLE_ID_TOKEN_CLAIMS_INVALID");
  }
  return { issuer: payload.iss === "accounts.google.com" ? "https://accounts.google.com" : payload.iss, subject: payload.sub, email: payload.email };
}
