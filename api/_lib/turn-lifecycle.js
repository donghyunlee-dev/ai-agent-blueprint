import crypto from 'node:crypto';

export const TURN_CLAIM_TTL_SECONDS = 120;
export const TURN_RESULT_TTL_SECONDS = 24 * 60 * 60;

function hmac(value) {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) throw new Error('AUTH_STORE_NOT_CONFIGURED');
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function turnKey(ownerKey, projectId, logicalRequestId) {
  return hmac(`${ownerKey}\0${projectId}\0${logicalRequestId}`);
}

export function turnFingerprint(request) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  return hmac(JSON.stringify(canonical({ ...request, attemptId: undefined })));
}

export async function claimTurn(store, key, fingerprint, attemptId, metadata = {}) {
  const previous = await store.readTurn(key);
  if (previous) {
    if (previous.attemptId === attemptId) return { kind: 'conflict' };
    if (previous.fingerprint !== fingerprint) return { kind: 'conflict' };
    if (previous.status === 'succeeded') return { kind: 'replay', result: previous.result };
    if (previous.status === 'unknown') return { kind: 'unknown' };
    if (previous.status === 'queued' || previous.status === 'running') return { kind: 'processing' };
  }
  const record = { fingerprint, attemptId, status: 'queued', metadata, updatedAt: Date.now() };
  const claim = await store.claimTurn(key, record, TURN_CLAIM_TTL_SECONDS);
  if (claim.acquired) return { kind: 'claimed' };
  if (!claim.record || claim.record.fingerprint !== fingerprint) return { kind: 'conflict' };
  if (claim.record.status === 'succeeded') return { kind: 'replay', result: claim.record.result };
  if (claim.record.status === 'unknown') return { kind: 'unknown' };
  return { kind: 'processing' };
}

export async function finishTurn(store, key, { status, attemptId, result, errorCode }) {
  const current = await store.readTurn(key);
  if (!current || current.attemptId !== attemptId) return false;
  const record = { ...current, status, attemptId, updatedAt: Date.now(), ...(result ? { result } : {}), ...(errorCode ? { errorCode } : {}) };
  return store.finishTurn(key, record, status === 'unknown' || status === 'succeeded' ? TURN_RESULT_TTL_SECONDS : TURN_CLAIM_TTL_SECONDS);
}
