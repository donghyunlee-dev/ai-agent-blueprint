import test from 'node:test';
import assert from 'node:assert/strict';
import { persistProjectCreation } from '../../src/features/projects/persistProjectCreation.js';
import { createProject } from '../../src/features/projects/createProject.js';

test('persists the canonical aggregate before exposing a created project', async () => {
  const events = [];
  const result = await persistProjectCreation({
    ownerKey: 'owner-a',
    input: { idea: 'idea', requestId: 'request-1' },
    repository: { save: async (owner, aggregate) => { events.push(['save', owner, aggregate]); } },
    createCommand: createProject,
    remember: (id) => events.push(['lastProject', id]),
  });
  assert.equal(result.project.ownerKey, 'owner-a');
  assert.deepEqual(events.map(([name]) => name), ['save', 'lastProject']);
  assert.equal(events[0][2].messages[0].content, 'idea');
});

test('does not record the last project when persistence fails', async () => {
  let remembered = false;
  await assert.rejects(persistProjectCreation({
    ownerKey: 'owner-a',
    input: { idea: 'idea', requestId: 'request-2' },
    repository: { save: async () => { throw new Error('STORAGE_FAILED'); } },
    createCommand: createProject,
    remember: () => { remembered = true; },
  }), /STORAGE_FAILED/);
  assert.equal(remembered, false);
});
