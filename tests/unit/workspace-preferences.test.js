import test from 'node:test';
import assert from 'node:assert/strict';
import { clampConversationWidth, clampScrollOffset, getConversationScrollTop, getConversationWidth, setConversationScrollTop, setConversationWidth } from '../../src/features/projects/workspacePreferences.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('workspace preferences are numeric and scoped by project id only', () => {
  const storage = memoryStorage();
  assert.equal(setConversationScrollTop('project one', 42, storage), true);
  assert.equal(getConversationScrollTop('project one', storage), 42);
  assert.equal(getConversationScrollTop('other', storage), null);
  assert.deepEqual([...storage.values.keys()], ['blueprint:workspace:scroll:project%20one']);
});

test('invalid or unavailable preference storage safely falls back', () => {
  const invalid = memoryStorage();
  invalid.setItem('blueprint:workspace:scroll:p', 'not-a-number');
  assert.equal(getConversationScrollTop('p', invalid), null);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(getConversationScrollTop('p', blocked), null);
  assert.equal(setConversationScrollTop('p', 10, blocked), false);
});

test('scroll offsets clamp to the available panel range', () => {
  assert.equal(clampScrollOffset(-1, 900, 300), 0);
  assert.equal(clampScrollOffset(800, 900, 300), 600);
  assert.equal(clampScrollOffset(25, 200, 300), 0);
});

test('conversation width stays between 320 and 420 pixels', () => {
  const storage = memoryStorage();
  assert.equal(clampConversationWidth(280), 320);
  assert.equal(clampConversationWidth(450), 420);
  assert.equal(setConversationWidth('p', 399.7, storage), true);
  assert.equal(getConversationWidth('p', storage), 400);
});
