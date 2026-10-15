import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSourceFile } from '../../src/features/sources/source-extraction.js';

const file = (bytes) => ({ arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

test('extracts Markdown UTF-8 with BOM and persists normalized text, preview, and SHA-256', async () => {
  const source = await extractSourceFile(file(new TextEncoder().encode('\uFEFF# Product\n\nPlan')), 'md');
  assert.equal(source.extractionStatus, 'ready');
  assert.equal(source.extractedText, '# Product\n\nPlan');
  assert.equal(source.preview, source.extractedText);
  assert.equal(source.textHash, 'a31521ed131319a5430af5d8ef53db097814079daadd5570aac7b869e393fb96');
});

test('rejects invalid UTF-8 without exposing decoder details', async () => {
  const source = await extractSourceFile(file(Uint8Array.from([0xC3, 0x28])), 'txt');
  assert.deepEqual(source, { extractionStatus: 'failed', errorCode: 'INVALID_ENCODING' });
});

test('returns a stable failure code when reading the file fails', async () => {
  const source = await extractSourceFile({ arrayBuffer: async () => { throw new Error('secret file bytes'); } }, 'txt');
  assert.deepEqual(source, { extractionStatus: 'failed', errorCode: 'EXTRACTION_FAILED' });
});
