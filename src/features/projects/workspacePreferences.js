const SCROLL_PREFIX = 'blueprint:workspace:scroll:';
const WIDTH_PREFIX = 'blueprint:workspace:conversation-width:';

function availableStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; } catch { return null; }
}

function readNumber(key, storage) {
  try {
    const raw = availableStorage(storage)?.getItem(key);
    if (raw === null || raw === undefined || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key, value, storage) {
  const target = availableStorage(storage);
  if (!Number.isFinite(value) || !target) return false;
  try {
    target.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function clampScrollOffset(offset, scrollHeight, clientHeight) {
  if (![offset, scrollHeight, clientHeight].every(Number.isFinite)) return 0;
  return Math.min(Math.max(0, offset), Math.max(0, scrollHeight - clientHeight));
}

export function getConversationScrollTop(projectId, storage) {
  return projectId ? readNumber(`${SCROLL_PREFIX}${encodeURIComponent(projectId)}`, storage) : null;
}

export function setConversationScrollTop(projectId, offset, storage) {
  return projectId ? writeNumber(`${SCROLL_PREFIX}${encodeURIComponent(projectId)}`, Math.max(0, offset), storage) : false;
}

export function getConversationWidth(projectId, storage) {
  const value = projectId ? readNumber(`${WIDTH_PREFIX}${encodeURIComponent(projectId)}`, storage) : null;
  return value === null ? null : clampConversationWidth(value);
}

export function setConversationWidth(projectId, width, storage) {
  return projectId ? writeNumber(`${WIDTH_PREFIX}${encodeURIComponent(projectId)}`, clampConversationWidth(width), storage) : false;
}

export function clampConversationWidth(width) {
  if (!Number.isFinite(width)) return 360;
  return Math.min(420, Math.max(320, Math.round(width)));
}
