import { verifyLoginToken as defaultVerifyLoginToken, mapAxReasonToErrorCode } from "../_lib/ax-auth.js";
import {
  signSession,
  buildSessionCookieHeader,
  readReturnToCookie,
  buildReturnToClearCookieHeader,
} from "../_lib/session.js";

function redirectToLogin(res, errorCode) {
  res.statusCode = 302;
  res.setHeader("Location", `/login?error=${errorCode}`);
  res.end();
}

export default async function handler(req, res, deps = {}) {
  const verifyLoginToken = deps.verifyLoginToken || defaultVerifyLoginToken;

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const queryError = url.searchParams.get("error");
    if (queryError) {
      redirectToLogin(res, queryError === "USER_NOT_ALLOWED" ? "AUTH_NOT_ALLOWED" : "AUTH_UNAVAILABLE");
      return;
    }

    const loginToken = url.searchParams.get("login_token");
    if (!loginToken) {
      redirectToLogin(res, "AUTH_TOKEN_INVALID");
      return;
    }

    let result;
    try {
      result = await verifyLoginToken(loginToken);
    } catch {
      redirectToLogin(res, "AUTH_UNAVAILABLE");
      return;
    }

    if (!result?.valid) {
      redirectToLogin(res, mapAxReasonToErrorCode(result?.reason));
      return;
    }

    const expectedClientId = process.env.AX_AUTH_CLIENT_ID;
    if (expectedClientId && result.clientId !== expectedClientId) {
      redirectToLogin(res, "AUTH_TOKEN_INVALID");
      return;
    }

    const { value } = signSession({ email: result.email, clientId: result.clientId });
    const returnTo = readReturnToCookie(req);
    res.setHeader("Set-Cookie", [buildSessionCookieHeader(value), buildReturnToClearCookieHeader()]);
    res.statusCode = 302;
    res.setHeader("Location", returnTo);
    res.end();
  } catch (error) {
    console.error("auth/callback failed:", error?.message || "unknown error");
    redirectToLogin(res, "AUTH_UNAVAILABLE");
  }
}
