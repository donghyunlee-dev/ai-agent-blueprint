import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

const TRANSACTION_TTL_SECONDS = 300;
const TURN_TRANSITIONS = Object.freeze({ queued: new Set(["running", "failed", "cancelled"]), running: new Set(["running", "succeeded", "failed", "cancelled", "unknown"]) });
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
  const turns = new Map();
  const circuits = new Map();
  function prune(map, key) { const value = map.get(key); if (value?.expiresAt <= now()) map.delete(key); return map.get(key); }
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
    async claimTurn(key, record, ttlSeconds) {
      const current = prune(turns, key);
      if (current && !["failed", "cancelled"].includes(current.status)) return { acquired: false, record: current };
      const value = { ...record, expiresAt: now() + ttlSeconds * 1000 };
      turns.set(key, value);
      return { acquired: true, record: value };
    },
    async readTurn(key) { return prune(turns, key) || null; },
    async finishTurn(key, record, ttlSeconds) {
      const current = turns.get(key);
      if (!current || current.attemptId !== record.attemptId || !TURN_TRANSITIONS[current.status]?.has(record.status)) return false;
      turns.set(key, { ...record, expiresAt: now() + ttlSeconds * 1000 });
      return true;
    },
    async circuitFailure(key, windowSeconds, threshold, openSeconds) {
      const current = prune(circuits, key) || { failures: 0, expiresAt: now() + windowSeconds * 1000 };
      current.failures += 1;
      if (current.failures >= threshold) {
        current.openUntil = now() + openSeconds * 1000;
        current.expiresAt = current.openUntil + windowSeconds * 1000;
        current.probeClaimed = false;
      }
      circuits.set(key, current);
      return { failures: current.failures, openUntil: current.openUntil || 0 };
    },
    async circuitState(key) {
      const current = prune(circuits, key);
      if (!current) return { failures: 0, openUntil: 0, probeClaimed: false };
      if (current.openUntil > now()) return { failures: current.failures, openUntil: current.openUntil, open: true, probeAllowed: false };
      if (current.openUntil && current.openUntil <= now()) {
        if (current.probeClaimed) return { failures: current.failures, openUntil: current.openUntil, open: true, probeAllowed: false };
        current.probeClaimed = true;
        return { failures: current.failures, openUntil: current.openUntil, open: false, halfOpen: true, probeAllowed: true };
      }
      return { failures: current.failures, openUntil: current.openUntil || 0, probeAllowed: false };
    },
    async circuitSuccess(key) { circuits.delete(key); },
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
  const readJson = async (key) => {
    const value = await redis.get(key);
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return value; }
  };
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
    async claimTurn(key, record, ttlSeconds) {
      const result = await redis.eval(`
        local current = redis.call('GET', KEYS[1])
        if current then
          local decoded = cjson.decode(current)
          if decoded.status ~= 'failed' and decoded.status ~= 'cancelled' then return {0, current} end
        end
        redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
        return {1, ARGV[1]}
      `, [`blueprint:turn:${key}`], [JSON.stringify(record), ttlSeconds]);
      const acquired = Number(result?.[0]) === 1;
      let stored = result?.[1];
      if (typeof stored === "string") { try { stored = JSON.parse(stored); } catch { stored = null; } }
      return { acquired, record: stored };
    },
    async readTurn(key) { return readJson(`blueprint:turn:${key}`); },
    async finishTurn(key, record, ttlSeconds) {
      const result = await redis.eval(`
        local current = redis.call('GET', KEYS[1])
        if not current then return 0 end
        local decoded = cjson.decode(current)
        if decoded.attemptId ~= ARGV[1] then return 0 end
        local allowed = (decoded.status == 'queued' and (ARGV[4] == 'running' or ARGV[4] == 'failed' or ARGV[4] == 'cancelled'))
          or (decoded.status == 'running' and (ARGV[4] == 'running' or ARGV[4] == 'succeeded' or ARGV[4] == 'failed' or ARGV[4] == 'cancelled' or ARGV[4] == 'unknown'))
        if not allowed then return 0 end
        redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
        return 1
      `, [`blueprint:turn:${key}`], [record.attemptId, JSON.stringify(record), ttlSeconds, record.status]);
      return Number(result) === 1;
    },
    async circuitFailure(key, windowSeconds, threshold, openSeconds) {
      const result = await redis.eval(`
        local n = redis.call('INCR', KEYS[1])
        if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
        if n >= tonumber(ARGV[2]) or redis.call('EXISTS', KEYS[4]) == 1 then
          redis.call('SET', KEYS[2], 'open', 'EX', ARGV[3])
          redis.call('SET', KEYS[3], 'probe-required', 'EX', ARGV[4])
        end
        return n
      `, [`blueprint:turn:circuit:failures:${key}`, `blueprint:turn:circuit:open:${key}`, `blueprint:turn:circuit:required:${key}`, `blueprint:turn:circuit:probe:${key}`], [windowSeconds, threshold, openSeconds, openSeconds + windowSeconds]);
      return { failures: Number(result), openUntil: 0 };
    },
    async circuitState(key) {
      const result = await redis.eval(`
        if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end
        if redis.call('EXISTS', KEYS[2]) == 0 then return 0 end
        if redis.call('SET', KEYS[3], 'claimed', 'EX', 60, 'NX') then return 2 end
        return 1
      `, [`blueprint:turn:circuit:open:${key}`, `blueprint:turn:circuit:required:${key}`, `blueprint:turn:circuit:probe:${key}`], []);
      return { open: Number(result) === 1, probeAllowed: Number(result) === 2 };
    },
    async circuitSuccess(key) {
      await redis.del(`blueprint:turn:circuit:failures:${key}`, `blueprint:turn:circuit:open:${key}`, `blueprint:turn:circuit:required:${key}`, `blueprint:turn:circuit:probe:${key}`);
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
