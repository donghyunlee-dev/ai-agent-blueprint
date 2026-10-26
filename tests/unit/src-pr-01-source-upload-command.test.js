import test from 'node:test';
import assert from 'node:assert/strict';
import { addSourceFiles, removeSource, retrySourceFile } from '../../src/features/sources/source-upload-command.js';
import { selectedFileForSourceResult } from '../../src/features/sources/source-file-correlation.js';

function repositoryWith(sources = []) {
  let aggregate = { project: { id: 'project-one', ownerKey: 'owner-one', updatedAt: 'before' }, sources, designItems: [], messages: [{ id: 'keep-me' }] };
  let queue = Promise.resolve();
  return {
    get aggregate() { return aggregate; },
    async transact(ownerKey, projectId, mutate) {
      let release;
      const previous = queue;
      queue = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        assert.equal(ownerKey, 'owner-one');
        assert.equal(projectId, 'project-one');
        const result = mutate(structuredClone(aggregate));
        if (result.aggregate) aggregate = result.aggregate;
        return result;
      } finally { release(); }
    },
  };
}
const file = (name) => ({ name, size: 3, type: 'text/markdown', arrayBuffer: async () => new TextEncoder().encode('body').buffer });

test('reserves against the latest aggregate and caps concurrent uploads at five', async () => {
  const repository = repositoryWith(Array.from({ length: 4 }, (_, index) => ({ id: `existing-${index}`, extractionStatus: 'failed' })));
  const extract = async () => ({ extractionStatus: 'ready', extractedText: 'text', preview: 'text', textHash: 'hash' });
  const [first, second] = await Promise.all([
    addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [file('one.md')], repository, extract }),
    addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [file('two.md')], repository, extract }),
  ]);
  assert.equal(repository.aggregate.sources.filter((source) => !source.archivedAt).length, 5);
  assert.equal([...first, ...second].filter((source) => source.errorCode === 'SOURCE_LIMIT').length, 1);
  assert.equal(repository.aggregate.messages[0].id, 'keep-me');
  assert.equal(repository.aggregate.sources.filter((source) => source.extractionStatus === 'ready').length, 1);
});

test('does not extract preflight failures and preserves successful siblings and prior data', async () => {
  const original = { id: 'old', extractionStatus: 'ready', extractedText: 'previous' };
  const repository = repositoryWith([original]);
  let calls = 0;
  const results = await addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [file('good.md'), file('bad.exe'), file('bad.md')], repository, extract: async (_file, extension) => {
    calls += 1;
    if (extension === 'md' && calls === 2) return { extractionStatus: 'failed', errorCode: 'EXTRACTION_FAILED' };
    return { extractionStatus: 'ready', extractedText: 'new', preview: 'new', textHash: 'sha256' };
  } });
  assert.equal(calls, 2);
  assert.equal(results.find((row) => row.fileName === 'bad.exe').errorCode, 'UNSUPPORTED_TYPE');
  assert.equal(results.find((row) => row.fileName === 'good.md').extractionStatus, 'ready');
  assert.equal(results.find((row) => row.fileName === 'bad.md').extractionStatus, 'failed');
  assert.equal(results.find((row) => row.fileName === 'bad.md').errorCode, 'EXTRACTION_FAILED');
  assert.equal(repository.aggregate.sources.find((row) => row.id === 'old').extractedText, 'previous');
  assert.equal(repository.aggregate.messages[0].id, 'keep-me');
  assert.equal(JSON.stringify(results).includes('sensitive parser detail'), false);
  assert.equal(repository.aggregate.sources.some((row) => 'binary' in row), false);
});

test('removes a source transactionally without replacing sibling records', async () => {
  const repository = repositoryWith([{ id: 'one' }, { id: 'two' }]);
  await removeSource({ ownerKey: 'owner-one', projectId: 'project-one', sourceId: 'one', repository });
  assert.deepEqual(repository.aggregate.sources.map((source) => source.id), ['two']);
  assert.equal(repository.aggregate.messages[0].id, 'keep-me');
});

test('reports a failed status save without claiming extraction success or changing older data', async () => {
  const repository = repositoryWith([{ id: 'old', extractionStatus: 'ready', extractedText: 'saved before failure' }]);
  const originalTransact = repository.transact.bind(repository);
  let calls = 0;
  repository.transact = async (...args) => { calls += 1; if (calls === 3) throw new Error('quota'); return originalTransact(...args); };
  const results = await addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [file('new.md')], repository, extract: async () => ({ extractionStatus: 'ready', extractedText: 'must not claim saved', preview: 'text', textHash: 'hash' }) });
  assert.equal(results[0].errorCode, 'STORAGE_FAILED');
  assert.equal(results[0].extractionStatus, 'failed');
  assert.equal(repository.aggregate.sources.find((source) => source.id === 'old').extractedText, 'saved before failure');
  assert.equal(repository.aggregate.sources.some((source) => source.extractedText === 'must not claim saved'), false);
});

test('correlates identical-name and identical-size upload results to their original file index', async () => {
  const repository = repositoryWith();
  const originalTransact = repository.transact.bind(repository);
  let calls = 0;
  repository.transact = async (...args) => { calls += 1; if (calls === 5) throw new Error('quota'); return originalTransact(...args); };
  const first = { ...file('same.md'), content: 'first text' };
  const later = { ...file('same.md'), content: 'later text' };
  assert.equal(first.size, later.size);
  const results = await addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [first, later], repository, extract: async (selected) => ({ extractionStatus: 'ready', extractedText: selected.content, preview: selected.content, textHash: 'hash' }) });
  assert.equal(results[0].fileIndex, 0);
  assert.equal(results[1].fileIndex, 1);
  assert.equal(results[1].errorCode, 'STORAGE_FAILED');
  assert.notEqual(results[0].id, results[1].id);
  assert.equal(selectedFileForSourceResult(results[1], [first, later]), later);
  assert.equal(selectedFileForSourceResult(results[1], [first, later]).content, 'later text');
});

test('retries a source whose terminal state could not be persisted', async () => {
  const repository = repositoryWith();
  const originalTransact = repository.transact.bind(repository);
  let calls = 0;
  repository.transact = async (...args) => { calls += 1; if (calls === 3) throw new Error('quota'); return originalTransact(...args); };
  const selected = file('retry.md');
  const failed = await addSourceFiles({ ownerKey: 'owner-one', projectId: 'project-one', files: [selected], repository, extract: async () => ({ extractionStatus: 'ready', extractedText: 'persist this', preview: 'persist this', textHash: 'hash' }) });
  assert.equal(failed[0].errorCode, 'STORAGE_FAILED');
  const recovered = await retrySourceFile({ ownerKey: 'owner-one', projectId: 'project-one', sourceId: failed[0].id, file: selected, repository, extract: async () => ({ extractionStatus: 'ready', extractedText: 'persist this', preview: 'persist this', textHash: 'hash' }) });
  assert.equal(recovered.extractionStatus, 'ready');
  assert.equal(repository.aggregate.sources.find((source) => source.id === failed[0].id).extractedText, 'persist this');
});
