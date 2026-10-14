export function createDebouncedProjectSaver({ save, onState = () => {}, delay = 500, setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout }) {
  if (typeof save !== 'function') throw new Error('SAVE_COMMAND_REQUIRED');
  let snapshot = null;
  let revision = 0;
  let timer = null;
  let inFlight = null;
  let queued = false;
  let disposed = false;
  let state = { status: 'saved', savedAt: null };

  const publish = (next) => { state = next; onState(state); };
  const clearTimer = () => { if (timer !== null) cancel(timer); timer = null; };

  async function flush() {
    clearTimer();
    if (!snapshot || disposed) return;
    if (inFlight) { queued = true; return inFlight; }
    const savingRevision = revision;
    const savingSnapshot = structuredClone(snapshot);
    publish({ status: 'saving', savedAt: state.savedAt });
    inFlight = Promise.resolve().then(() => save(savingSnapshot)).then(() => {
      if (savingRevision === revision) publish({ status: 'saved', savedAt: new Date().toISOString() });
    }).catch(() => {
      if (savingRevision === revision) publish({ status: 'failed', savedAt: state.savedAt });
    }).finally(() => {
      inFlight = null;
      if (queued) {
        queued = false;
        if (state.status !== 'failed') void flush();
      }
    });
    return inFlight;
  }

  return {
    schedule(nextSnapshot) {
      if (disposed) return;
      snapshot = structuredClone(nextSnapshot);
      revision += 1;
      if (inFlight) publish({ status: 'saving', savedAt: state.savedAt });
      clearTimer();
      timer = schedule(() => { timer = null; void flush(); }, delay);
    },
    flush,
    async retry() { if (!snapshot || disposed) return; clearTimer(); await flush(); },
    getSnapshot() { return snapshot ? structuredClone(snapshot) : null; },
    getState() { return { ...state }; },
    dispose() { disposed = true; clearTimer(); },
  };
}

export function formatSavedTime(isoTimestamp) {
  if (!isoTimestamp) return '';
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(isoTimestamp));
}
