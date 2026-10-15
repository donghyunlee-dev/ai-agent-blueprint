export function createDebouncedProjectSaver({ save, onState = () => {}, delay = 500, setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout }) {
  if (typeof save !== 'function') throw new Error('SAVE_COMMAND_REQUIRED');
  let snapshot = null;
  let revision = 0;
  let timer = null;
  let inFlight = null;
  let savedRevision = 0;
  let disposed = false;
  let state = { status: 'saved', savedAt: null };

  const publish = (next) => { state = next; onState(state); };
  const clearTimer = () => { if (timer !== null) cancel(timer); timer = null; };

  async function flush() {
    clearTimer();
    if (!snapshot || disposed) return;
    while (!disposed && savedRevision < revision) {
      if (state.status === 'failed') return;
      if (inFlight) {
        await inFlight;
        continue;
      }
      const savingRevision = revision;
      const savingSnapshot = structuredClone(snapshot);
      publish({ status: 'saving', savedAt: state.savedAt });
      inFlight = Promise.resolve().then(() => save(savingSnapshot)).then(() => {
        savedRevision = Math.max(savedRevision, savingRevision);
        if (savingRevision === revision) publish({ status: 'saved', savedAt: new Date().toISOString() });
      }).catch(() => {
        if (savingRevision === revision) publish({ status: 'failed', savedAt: state.savedAt });
      }).finally(() => { inFlight = null; });
      await inFlight;
      if (state.status === 'failed' && savingRevision === revision) return;
    }
  }

  return {
    schedule(nextSnapshot) {
      if (disposed) return;
      snapshot = structuredClone(nextSnapshot);
      revision += 1;
      publish({ status: 'saving', savedAt: state.savedAt });
      clearTimer();
      timer = schedule(() => { timer = null; void flush(); }, delay);
    },
    flush,
    async retry() { if (!snapshot || disposed) return; clearTimer(); if (state.status === 'failed') publish({ status: 'saved', savedAt: state.savedAt }); await flush(); },
    getSnapshot() { return snapshot ? structuredClone(snapshot) : null; },
    getState() { return { ...state }; },
    dispose() { disposed = true; clearTimer(); },
  };
}

export function formatSavedTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(isoTimestamp));
}
