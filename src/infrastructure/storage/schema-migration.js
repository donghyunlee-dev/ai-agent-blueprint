export const PROJECT_DB_SCHEMA_VERSION = 1;
export const PROJECT_DATA_SCHEMA_VERSION = 1;
export const PROJECT_STORE = 'projects';
export const ACTIVITY_STORE = 'activities';

export function databaseNameForOwner(ownerKey) {
  if (typeof ownerKey !== 'string' || ownerKey.trim() === '') throw new Error('OWNER_REQUIRED');
  return `blueprint-projects:${encodeURIComponent(ownerKey)}`;
}

export function migrateProjectRecord(record) {
  if (!record || typeof record !== 'object' || !Number.isInteger(record.schemaVersion)) throw new Error('STORAGE_SCHEMA_INVALID');
  if (record.schemaVersion > PROJECT_DATA_SCHEMA_VERSION) throw new Error('STORAGE_SCHEMA_NEWER');
  if (record.schemaVersion < PROJECT_DATA_SCHEMA_VERSION) throw new Error('STORAGE_SCHEMA_UNSUPPORTED');
  return record;
}

export function openProjectDatabase(ownerKey) {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('STORAGE_UNAVAILABLE'));
  const name = databaseNameForOwner(ownerKey);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, PROJECT_DB_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(ACTIVITY_STORE)) {
        const activities = database.createObjectStore(ACTIVITY_STORE, { keyPath: ['projectId', 'id'] });
        activities.createIndex('projectId', 'projectId', { unique: false });
      }
    };
    request.onerror = () => reject(request.error ?? new Error('STORAGE_OPEN_FAILED'));
    request.onblocked = () => reject(new Error('STORAGE_BLOCKED'));
    request.onsuccess = () => resolve(request.result);
  });
}
