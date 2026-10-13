import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

const TRANSACTION_TTL_SECONDS = 300;
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

function rateLimitKey(operation, ip) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error("APP_SESSION_SECRET_NOT_CONFIGURED");
  return `blueprint:auth:rate:${crypto.createHmac("sha256", secret).update(`${operation}:${ip}`).digest("hex")}`;
}

export function createMemoryAuthStore({ now = Date.now } = {}) {
  const transactions = new Map();
  const counters = new Map();
  return {
    async createTransaction(state, transaction, ttlSeconds = TRANSACTION_TTL_SECONDS) {
      const existing = transactions.get(state);
      if (existing && existing.expiresAt > now()) return false;
      transactions.set(state, { transaction, expiresAt: now() + ttlSeconds * 1000 });
      return true;
    },
    async consumeTransaction(state) {
      const stored = transactions.get(state);
      transactions.delete(state);
      if (!stored || stored.expiresAt <= now()) return null;
      return stored.transaction;
    },
    async checkRateLimit(operation, ip, limit, windowSeconds) {
      const key = rateLimitKey(operation, ip);
      const timestamp = now();
      const current = counters.get(key);
      if (!current || current.expiresAt <= timestamp) {
        counters.set(key, { count: 1, expiresAt: timestamp + windowSeconds * 1000 });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
  };
}

export function getRequestIp(req) {
  const direct = req.headers?.["x-real-ip"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export function createRedisAuthStore(redis) {
  return {
    async createTransaction(state, transaction, ttlSeconds = TRANSACTION_TTL_SECONDS) {
      const result = await redis.set(`blueprint:oauth:state:${state}`, transaction, { ex: ttlSeconds, nx: true });
      return result === "OK";
    },
    async consumeTransaction(state) {
      return redis.getdel(`blueprint:oauth:state:${state}`);
    },
    async checkRateLimit(operation, ip, limit, windowSeconds) {
      const count = await redis.eval(RATE_LIMIT_SCRIPT, [rateLimitKey(operation, ip)], [windowSeconds]);
      return Number(count) <= limit;
    },
  };
}

let localStore;
let productionStore;

export function getAuthStore() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    if (productionStore) return productionStore;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("AUTH_STORE_NOT_CONFIGURED");
    try {
      productionStore = createRedisAuthStore(new Redis({ url, token, enableTelemetry: false }));
      return productionStore;
    } catch {
      throw new Error("AUTH_STORE_NOT_CONFIGURED");
    }
  }
  if (!localStore) localStore = createMemoryAuthStore();
  return localStore;
}
