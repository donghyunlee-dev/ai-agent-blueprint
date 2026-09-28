// Server-to-server AX Auth client. AX always answers /auth/token/verify with
// HTTP 200; success/failure is decided by the `valid` field in the body, never
// by response.ok. See docs/product/11-ax-login-authentication.md.

const REASON_TO_ERROR_CODE = {
  TOKEN_NOT_FOUND: "AUTH_TOKEN_INVALID",
  TOKEN_CLIENT_MISMATCH: "AUTH_TOKEN_INVALID",
  TOKEN_EXPIRED: "AUTH_TOKEN_INVALID",
  TOKEN_ALREADY_USED: "AUTH_TOKEN_INVALID",
  INVALID_CLIENT: "AUTH_UNAVAILABLE",
  CLIENT_DISABLED: "AUTH_UNAVAILABLE",
  INVALID_SECRET: "AUTH_UNAVAILABLE",
};

export function mapAxReasonToErrorCode(reason) {
  return REASON_TO_ERROR_CODE[reason] || "AUTH_UNAVAILABLE";
}

export async function verifyLoginToken(loginToken) {
  const baseUrl = process.env.AX_AUTH_BASE_URL;
  const clientId = process.env.AX_AUTH_CLIENT_ID;
  const clientSecret = process.env.AX_AUTH_CLIENT_SECRET;
  const response = await fetch(`${baseUrl}/auth/token/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret, loginToken }),
  });
  const body = await response.json();
  if (body && body.valid === true) {
    return { valid: true, email: body.email, clientId: body.clientId };
  }
  return { valid: false, reason: body?.reason || "TOKEN_NOT_FOUND" };
}

// returnTo is intentionally not forwarded to AX: it is validated and stored in
// our own short-lived cookie by api/auth/login.js, and read back by
// api/auth/callback.js after AX redirects to the fixed, registered redirect_uri.
// This function takes no returnTo parameter for that reason.
export function buildAxLoginRedirectUrl() {
  const baseUrl = process.env.AX_AUTH_BASE_URL;
  const clientId = process.env.AX_AUTH_CLIENT_ID;
  const redirectUri = process.env.AX_AUTH_REDIRECT_URI;
  if (!redirectUri) throw new Error("AX_AUTH_REDIRECT_URI_NOT_CONFIGURED");
  const url = new URL(`/auth/login/${clientId}`, baseUrl);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}
