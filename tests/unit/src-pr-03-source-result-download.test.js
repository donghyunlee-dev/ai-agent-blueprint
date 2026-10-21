import test from 'node:test';
import assert from 'node:assert/strict';
import { canDownloadSourceResult, createSourceResultFilename, downloadSourceResult } from '../../src/features/sources/source-result-download.js';

const readySource = { fileName: 'policy.md', extractionStatus: 'ready', extractedText: '예약 취소 정책' };

test('only ready, non-archived sources with non-empty extracted text can download', () => {
  assert.equal(canDownloadSourceResult(readySource), true);
  for (const source of [
    { ...readySource, extractionStatus: 'queued' },
    { ...readySource, extractionStatus: 'extracting' },
    { ...readySource, extractionStatus: 'failed' },
    { ...readySource, extractionStatus: 'unsupported' },
    { ...readySource, archivedAt: '2026-10-21T00:00:00Z' },
    { ...readySource, extractedText: '' },
    { ...readySource, extractedText: '  \n  ' },
    { ...readySource, extractedText: undefined },
  ]) assert.equal(canDownloadSourceResult(source), false);
});

test('creates a safe filename with a distinct extracted-result suffix and final txt extension', () => {
  assert.equal(createSourceResultFilename('../../notes\\draft:policy.md'), 'notes-draft-policy-extracted-result.txt');
  assert.equal(createSourceResultFilename('..'), 'source-extracted-result.txt');
  assert.equal(createSourceResultFilename('quarter\u0000\r\nname.md'), 'quarter-name-extracted-result.txt');
});

test('downloads exact extracted text as UTF-8 text and releases URL and anchor', () => {
  const calls = [];
  const deps = {
    Blob: class { constructor(parts, options) { this.parts = parts; this.options = options; calls.push(['blob', parts, options]); } },
    URL: { createObjectURL: (blob) => { calls.push(['create', blob]); return 'blob:result'; }, revokeObjectURL: (url) => calls.push(['revoke', url]) },
    document: { body: { appendChild: (anchor) => calls.push(['append', anchor]) }, createElement: () => ({ click: () => calls.push(['click']), remove: () => calls.push(['remove']) }) },
    setTimeout: (callback, delay) => { calls.push(['defer', delay]); callback(); },
  };
  downloadSourceResult(readySource, deps);
  assert.deepEqual(calls[0], ['blob', ['예약 취소 정책'], { type: 'text/plain;charset=utf-8' }]);
  assert.deepEqual(calls.map(([name]) => name), ['blob', 'create', 'append', 'click', 'defer', 'revoke', 'remove']);
});

test('releases URL and anchor if download setup fails after URL creation', () => {
  const calls = [];
  const anchor = { click() {}, remove: () => calls.push('remove') };
  assert.throws(() => downloadSourceResult(readySource, {
    URL: { createObjectURL: () => 'blob:result', revokeObjectURL: (url) => { calls.push(`revoke:${url}`); throw new Error('revoke failed'); } },
    document: { body: { appendChild() {} }, createElement: () => anchor },
    setTimeout() { throw new Error('schedule failed'); },
  }), /schedule failed/);
  assert.deepEqual(calls, ['revoke:blob:result', 'remove']);
});
