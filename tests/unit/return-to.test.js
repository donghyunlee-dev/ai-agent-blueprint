import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReturnTo } from "../../api/_lib/session.js";

test("validateReturnTo accepts a same-origin internal path", () => {
  assert.equal(validateReturnTo("/blueprints/p-1"), "/blueprints/p-1");
  assert.equal(validateReturnTo("/blueprints/p-1/design"), "/blueprints/p-1/design");
});

test("validateReturnTo falls back to / for missing or empty input", () => {
  assert.equal(validateReturnTo(undefined), "/");
  assert.equal(validateReturnTo(null), "/");
  assert.equal(validateReturnTo(""), "/");
});

test("validateReturnTo rejects protocol-relative paths", () => {
  assert.equal(validateReturnTo("//evil.com/phish"), "/");
});

test("validateReturnTo rejects external absolute URLs", () => {
  assert.equal(validateReturnTo("https://evil.com"), "/");
  assert.equal(validateReturnTo("http://evil.com/path"), "/");
});

test("validateReturnTo rejects paths without a leading slash", () => {
  assert.equal(validateReturnTo("blueprints/p-1"), "/");
});

test("validateReturnTo rejects backslash tricks", () => {
  assert.equal(validateReturnTo("/\\evil.com"), "/");
});

test("validateReturnTo rejects control characters", () => {
  assert.equal(validateReturnTo("/blueprints\x00/p-1"), "/");
  assert.equal(validateReturnTo("/login%0d%0aSet-Cookie:x"), "/login%0d%0aSet-Cookie:x");
  assert.equal(validateReturnTo("/login\r\nSet-Cookie:x"), "/");
});
