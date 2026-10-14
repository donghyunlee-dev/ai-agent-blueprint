export const CIRCUIT_WINDOW_SECONDS = 60;
export const CIRCUIT_THRESHOLD = 3;
export const CIRCUIT_OPEN_SECONDS = 60;

export async function circuitState(store, key) {
  const state = await store.circuitState(key);
  return { open: Boolean(state.open), probeAllowed: Boolean(state.probeAllowed) };
}

export async function circuitFailure(store, key) {
  return store.circuitFailure(key, CIRCUIT_WINDOW_SECONDS, CIRCUIT_THRESHOLD, CIRCUIT_OPEN_SECONDS);
}

export async function circuitSuccess(store, key) {
  return store.circuitSuccess(key);
}
