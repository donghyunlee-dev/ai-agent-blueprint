import { test } from "node:test";
import assert from "node:assert/strict";

const STORAGE_KEY = "windsoft-agent-blueprint:prd-context";
const LEGACY_STORAGE_KEY = "sfood-agent-blueprint:prd-context";

function installSessionStorage(entries = []) {
  const values = new Map(entries);
  globalThis.sessionStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return values;
}

test("loadPrdContext migrates the legacy context and removes the old key", async () => {
  const context = { formData: { serviceName: "Windsoft" }, recommendation: {} };
  const values = installSessionStorage([[LEGACY_STORAGE_KEY, JSON.stringify(context)]]);
  const { loadPrdContext } = await import("../../src/features/prd/contextStorage.ts");

  assert.deepEqual(loadPrdContext(), context);
  assert.equal(values.get(STORAGE_KEY), JSON.stringify(context));
  assert.equal(values.has(LEGACY_STORAGE_KEY), false);
});

test("loadPrdContext prefers an existing new context and removes legacy data", async () => {
  const current = { formData: { serviceName: "Current" }, recommendation: {} };
  const legacy = { formData: { serviceName: "Legacy" }, recommendation: {} };
  const values = installSessionStorage([
    [STORAGE_KEY, JSON.stringify(current)],
    [LEGACY_STORAGE_KEY, JSON.stringify(legacy)],
  ]);
  const { loadPrdContext } = await import("../../src/features/prd/contextStorage.ts");

  assert.deepEqual(loadPrdContext(), current);
  assert.equal(values.get(STORAGE_KEY), JSON.stringify(current));
  assert.equal(values.has(LEGACY_STORAGE_KEY), false);
});

test("loadPrdContext preserves valid legacy context when the new value is malformed", async () => {
  const legacy = { formData: { serviceName: "Legacy" }, recommendation: {} };
  const values = installSessionStorage([
    [STORAGE_KEY, "{"],
    [LEGACY_STORAGE_KEY, JSON.stringify(legacy)],
  ]);
  const { loadPrdContext } = await import("../../src/features/prd/contextStorage.ts");

  assert.deepEqual(loadPrdContext(), legacy);
  assert.equal(values.get(STORAGE_KEY), JSON.stringify(legacy));
  assert.equal(values.has(LEGACY_STORAGE_KEY), false);
});

test("loadPrdContext ignores malformed legacy context without copying it", async () => {
  const values = installSessionStorage([[LEGACY_STORAGE_KEY, "{"]]);
  const { loadPrdContext } = await import("../../src/features/prd/contextStorage.ts");

  assert.equal(loadPrdContext(), null);
  assert.equal(values.has(STORAGE_KEY), false);
  assert.equal(values.has(LEGACY_STORAGE_KEY), false);
});

test("savePrdContext writes only to the Windsoft context key", async () => {
  const values = installSessionStorage();
  const context = { formData: { serviceName: "Windsoft" }, recommendation: {} };
  const { savePrdContext } = await import("../../src/features/prd/contextStorage.ts");

  savePrdContext(context);

  assert.equal(values.get(STORAGE_KEY), JSON.stringify(context));
  assert.equal(values.has(LEGACY_STORAGE_KEY), false);
});
