import test from 'node:test';
import assert from 'node:assert/strict';
import { countActiveSources, MAX_ACTIVE_SOURCES, MAX_SOURCE_FILE_BYTES, validateSourceFile } from '../../src/features/sources/source-validation.js';

const file = (name, size = 1, type = '') => ({ name, size, type });

test('accepts only supported extensions with compatible or generic MIME types', () => {
  for (const name of ['notes.txt', 'brief.md', 'brief.markdown', 'scan.pdf']) assert.equal(validateSourceFile(file(name)).valid, true, name);
  assert.equal(validateSourceFile(file('brief.md', 1, 'application/octet-stream')).valid, true);
  assert.deepEqual(validateSourceFile(file('brief.exe')), { valid: false, errorCode: 'UNSUPPORTED_TYPE' });
  assert.deepEqual(validateSourceFile(file('brief.pdf', 1, 'text/plain')), { valid: false, errorCode: 'TYPE_MISMATCH' });
  assert.deepEqual(validateSourceFile(file('brief.md', 1, 'image/png')), { valid: false, errorCode: 'TYPE_MISMATCH' });
});

test('enforces a positive size and inclusive 10 MiB boundary', () => {
  assert.deepEqual(validateSourceFile(file('brief.txt', 0)), { valid: false, errorCode: 'EMPTY_FILE' });
  assert.equal(validateSourceFile(file('brief.txt', MAX_SOURCE_FILE_BYTES)).valid, true);
  assert.deepEqual(validateSourceFile(file('brief.txt', MAX_SOURCE_FILE_BYTES + 1)), { valid: false, errorCode: 'FILE_TOO_LARGE' });
});

test('counts failed and unsupported active rows and frees archived rows', () => {
  const sources = Array.from({ length: MAX_ACTIVE_SOURCES }, (_, index) => ({ extractionStatus: index ? 'failed' : 'unsupported' }));
  assert.equal(countActiveSources(sources), MAX_ACTIVE_SOURCES);
  sources[0].archivedAt = '2026-10-15T00:00:00.000Z';
  assert.equal(countActiveSources(sources), MAX_ACTIVE_SOURCES - 1);
});
