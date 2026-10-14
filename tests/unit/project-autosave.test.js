import test from 'node:test';
import assert from 'node:assert/strict';
import { createDebouncedProjectSaver } from '../../src/features/projects/projectAutosave.js';

function createFakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async advance(duration) {
      now += duration;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        due[1].callback();
        await Promise.resolve();
      }
      await Promise.resolve();
    },
  };
}

test('debounces changes for 500ms and persists only the latest snapshot', async () => {
  const clock = createFakeClock();
  const saved = [];
  const saver = createDebouncedProjectSaver({ save: async (value) => saved.push(value), ...clock });
  saver.schedule({ revision: 1 });
  assert.equal(saver.getState().status, 'saving');
  await clock.advance(400);
  saver.schedule({ revision: 2 });
  await clock.advance(499);
  assert.deepEqual(saved, []);
  await clock.advance(1);
  assert.deepEqual(saved, [{ revision: 2 }]);
  saver.dispose();
});

test('preserves the newest edit made during an in-flight save and reports failure for retry', async () => {
  const clock = createFakeClock();
  let releaseFirst;
  const saved = [];
  let shouldFail = true;
  const states = [];
  const saver = createDebouncedProjectSaver({
    ...clock,
    onState: (state) => states.push(state.status),
    save: async (value) => {
      saved.push(value);
      if (value.revision === 1) await new Promise((resolve) => { releaseFirst = resolve; });
      if (shouldFail) throw new Error('quota');
    },
  });
  saver.schedule({ revision: 1 });
  await clock.advance(500);
  saver.schedule({ revision: 2 });
  await clock.advance(500);
  releaseFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(saved, [{ revision: 1 }, { revision: 2 }]);
  assert.equal(saver.getSnapshot().revision, 2);
  assert.equal(states.includes('failed'), true);
  shouldFail = false;
  await saver.retry();
  assert.deepEqual(saved.at(-1), { revision: 2 });
  assert.equal(saver.getState().status, 'saved');
  saver.dispose();
});

test('queues edits made while retry is saving and persists the latest value', async () => {
  const clock = createFakeClock();
  const saved = [];
  let retryStarted;
  let releaseRetry;
  const saver = createDebouncedProjectSaver({
    ...clock,
    save: async (value) => {
      saved.push(value);
      if (saved.length === 1) throw new Error('quota');
      if (saved.length === 2) {
        retryStarted();
        await new Promise((resolve) => { releaseRetry = resolve; });
      }
    },
  });
  saver.schedule({ title: 'initial' });
  await clock.advance(500);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saver.getState().status, 'failed');

  const retryStartedPromise = new Promise((resolve) => { retryStarted = resolve; });
  const retry = saver.retry();
  await retryStartedPromise;
  saver.schedule({ title: 'latest' });
  await clock.advance(500);
  releaseRetry();
  await retry;
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(saved, [{ title: 'initial' }, { title: 'initial' }, { title: 'latest' }]);
  assert.equal(saver.getSnapshot().title, 'latest');
  assert.equal(saver.getState().status, 'saved');
  saver.dispose();
});

test('awaiting flush includes a newer queued snapshot instead of racing a transactional write', async () => {
  const clock = createFakeClock();
  let releaseFirst;
  let releaseSecond;
  const saved = [];
  const saver = createDebouncedProjectSaver({
    ...clock,
    save: async (value) => {
      saved.push(value);
      if (value.revision === 1) await new Promise((resolve) => { releaseFirst = resolve; });
      if (value.revision === 2) await new Promise((resolve) => { releaseSecond = resolve; });
    },
  });
  saver.schedule({ revision: 1 });
  await clock.advance(500);
  saver.schedule({ revision: 2 });
  let flushCompleted = false;
  const flushing = saver.flush().then(() => { flushCompleted = true; });
  releaseFirst();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(flushCompleted, false);
  releaseSecond();
  await flushing;
  assert.deepEqual(saved, [{ revision: 1 }, { revision: 2 }]);
  assert.equal(saver.getState().status, 'saved');
  saver.dispose();
});
