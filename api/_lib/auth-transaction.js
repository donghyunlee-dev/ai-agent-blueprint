import crypto from "node:crypto";
import { parseCookies } from "./session.js";

const NAME = "sfb_oauth_tx";
const MAX_AGE_SECONDS = 300;

function key() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error("APP_SESSION_SECRET_NOT_CONFIGURED");
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify({ ...payload, expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function buildTransactionCookieHeader(transaction) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NAME}=${encodeURIComponent(encrypt(transaction))}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function readTransactionCookie(req) {
  const value = parseCookies(req.headers?.cookie)[NAME];
  if (!value) return null;
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8"));
    if (typeof payload.expiresAt !== "number" || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function buildTransactionClearCookieHeader() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NAME}=; Path=/; SameSite=Lax; HttpOnly; Max-Age=0${secure}`;
}
