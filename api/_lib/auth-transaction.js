import { parseCookies } from "./session.js";

const NAME = "sfb_oauth_tx";
const MAX_AGE_SECONDS = 300;

export function buildTransactionCookieHeader(state) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NAME}=${encodeURIComponent(state)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function readTransactionState(req) {
  return parseCookies(req.headers?.cookie)[NAME] || null;
}

export function buildTransactionClearCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NAME}=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0${secure}`;
}
