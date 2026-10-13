import { test, before } from "node:test";
import assert from "node:assert/strict";
import { createMemoryAuthStore, createRedisAuthStore, getAuthStore } from "../../api/_lib/auth-store.js";

before(() => { process.env.APP_SESSION_SECRET = "auth-store-test-session-secret"; });

test("memory auth store atomically consumes an OAuth transaction once", async () => {
  const store = createMemoryAuthStore();
  const transaction = { nonce: "n", codeVerifier: "v", returnTo: "/" };
  await store.createTransaction("state-1", transaction, 60);
  const results = await Promise.all([store.consumeTransaction("state-1"), store.consumeTransaction("state-1")]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(results.find(Boolean), transaction);
});

test("memory auth store enforces per-key fixed-window rate limits", async () => {
  const store = createMemoryAuthStore();
  assert.equal(await store.checkRateLimit("google-start", "test-ip", 2, 60), true);
  assert.equal(await store.checkRateLimit("google-start", "test-ip", 2, 60), true);
  assert.equal(await store.checkRateLimit("google-start", "test-ip", 2, 60), false);
  assert.equal(await store.checkRateLimit("google-start", "other-ip", 2, 60), true);
});

test("Redis auth store uses SET NX EX, GETDEL and atomic rate-limit eval", async () => {
  const calls = [];
  const redis = {
    set: async (...args) => { calls.push(["set", ...args]); return "OK"; },
    getdel: async (...args) => { calls.push(["getdel", ...args]); return { nonce: "n" }; },
    eval: async (...args) => { calls.push(["eval", ...args]); return 3; },
  };
  const store = createRedisAuthStore(redis);
  await store.createTransaction("state-1", { nonce: "n" }, 300);
  assert.deepEqual(await store.consumeTransaction("state-1"), { nonce: "n" });
  assert.equal(await store.checkRateLimit("google-start", "192.0.2.3", 2, 900), false);
  assert.deepEqual(calls[0], ["set", "blueprint:oauth:state:state-1", { nonce: "n" }, { ex: 300, nx: true }]);
  assert.deepEqual(calls[1], ["getdel", "blueprint:oauth:state:state-1"]);
  assert.equal(calls[2][0], "eval");
  assert.match(calls[2][1], /redis\.call\('EXPIRE'/);
  assert.match(calls[2][2][0], /^blueprint:auth:rate:[a-f0-9]{64}$/);
  assert.doesNotMatch(calls[2][2][0], /192\.0\.2\.3/);
});

test("production auth store fails closed when Upstash REST credentials are missing", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercel = process.env.VERCEL;
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.NODE_ENV = "test";
  process.env.VERCEL = "1";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    assert.throws(() => getAuthStore(), { message: "AUTH_STORE_NOT_CONFIGURED" });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = previousVercel;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});
