import { test } from "node:test";
import assert from "node:assert/strict";
import { createOwnerContextLifecycle, deriveOwnerKey } from "../../src/features/auth/ownerContext.js";

const identity = (subject, email = "first@example.test", issuer = "https://accounts.google.com") => ({
  issuer,
  subject,
  email,
  clientId: "private-client-id",
  idToken: "private-id-token",
});

test("owner key is deterministic, opaque, and independent of profile or credential fields", async () => {
  const first = await deriveOwnerKey(identity("opaque-subject", "first@example.test"));
  const changedEmail = await deriveOwnerKey(identity("opaque-subject", "changed@example.test"));
  assert.equal(first, changedEmail);
  assert.match(first, /^owner:v1:[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(first, /opaque-subject|example\.test|private/);
});

test("byte-distinct subjects receive different owner keys without subject normalization", async () => {
  const base = await deriveOwnerKey(identity(" subject "));
  assert.notEqual(base, await deriveOwnerKey(identity("subject")));
});

test("owner key helper accepts only canonical verified issuer and a non-empty subject", async () => {
  await assert.rejects(deriveOwnerKey(identity("subject", "a@example.test", "accounts.google.com")), /INVALID_OWNER_IDENTITY/);
  await assert.rejects(deriveOwnerKey(identity("", "a@example.test")), /INVALID_OWNER_IDENTITY/);
});

test("owner context is absent until verified identity activation and is revoked on generation change", async () => {
  const lifecycle = createOwnerContextLifecycle();
  const generation = lifecycle.beginCheck();
  assert.deepEqual(lifecycle.snapshot(), { generation, ownerKey: null });
  assert.equal(await lifecycle.activate(generation, identity("user-a")), true);
  assert.match(lifecycle.snapshot().ownerKey, /^owner:v1:/);

  const expiredGeneration = lifecycle.revoke();
  assert.deepEqual(lifecycle.snapshot(), { generation: expiredGeneration, ownerKey: null });
});

test("late identity activation cannot restore a revoked context or replace a newer owner", async () => {
  const pending = new Map();
  const lifecycle = createOwnerContextLifecycle({
    deriveKey: (value) => new Promise((resolve) => pending.set(value.subject, resolve)),
  });

  const generationA = lifecycle.beginCheck();
  const activationA = lifecycle.activate(generationA, identity("user-a"));
  const generationB = lifecycle.beginCheck();
  const activationB = lifecycle.activate(generationB, identity("user-b"));
  pending.get("user-b")("owner-b");
  assert.equal(await activationB, true);
  pending.get("user-a")("owner-a");
  assert.equal(await activationA, false);
  assert.deepEqual(lifecycle.snapshot(), { generation: generationB, ownerKey: "owner-b" });

  const generationC = lifecycle.beginCheck();
  const activationC = lifecycle.activate(generationC, identity("user-c"));
  lifecycle.revoke();
  pending.get("user-c")("owner-c");
  assert.equal(await activationC, false);
  assert.equal(lifecycle.snapshot().ownerKey, null);
});
