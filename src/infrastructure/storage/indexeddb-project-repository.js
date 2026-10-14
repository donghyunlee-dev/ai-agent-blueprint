import { projectSummaryFromProject, sortRecentProjectSummaries, validateBlueprintAggregate } from '../../features/projects/projectAggregate.js';
import { ACTIVITY_STORE, PROJECT_DATA_SCHEMA_VERSION, PROJECT_STORE, migrateProjectRecord, openProjectDatabase } from './schema-migration.js';

const databases = new Map();
const transactions = new Set();
let ownerGeneration = 0;
let sessionListenerRegistered = false;

function invalidateOwnerConnections() {
  ownerGeneration += 1;
  for (const transaction of transactions) {
    try { transaction.abort(); } catch { /* Completed transactions cannot be aborted. */ }
  }
  transactions.clear();
  for (const database of databases.values()) database.close();
  databases.clear();
}

function observeOwnerContext() {
  if (sessionListenerRegistered || typeof window === 'undefined') return;
  window.addEventListener('blueprint:clear-session-state', invalidateOwnerConnections);
  sessionListenerRegistered = true;
}

function assertCurrent(generation) {
  if (generation !== ownerGeneration) throw new Error('OWNER_CONTEXT_STALE');
}

async function getDatabase(ownerKey, generation) {
  observeOwnerContext();
  let databasePromise = databases.get(ownerKey);
  if (!databasePromise) {
    databasePromise = openProjectDatabase(ownerKey).then((database) => {
      database.onversionchange = () => { database.close(); databases.delete(ownerKey); };
      return database;
    });
    databasePromise.catch(() => { if (databases.get(ownerKey) === databasePromise) databases.delete(ownerKey); });
    databases.set(ownerKey, databasePromise);
  }
  const database = await databasePromise;
  assertCurrent(generation);
  return database;
}

function waitForTransaction(transaction, ownerGenerationAtStart) {
  transactions.add(transaction);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      transactions.delete(transaction);
      try { assertCurrent(ownerGenerationAtStart); resolve(); } catch (error) { reject(error); }
    };
    transaction.onabort = () => {
      transactions.delete(transaction);
      reject(transaction.error ?? new Error('STORAGE_TRANSACTION_FAILED'));
    };
    transaction.onerror = () => {
      // The abort event carries the final transaction error.
    };
  });
}

function migrateOpenDatabase(database, generation) {
  const transaction = database.transaction(PROJECT_STORE, 'readonly');
  const done = waitForTransaction(transaction, generation);
  let migrationError;
  transaction.objectStore(PROJECT_STORE).getAll().onsuccess = (event) => {
    try {
      for (const record of event.target.result) migrateProjectRecord(record);
    } catch (error) {
      migrationError = error;
      try { transaction.abort(); } catch { /* Already completed. */ }
    }
  };
  return done.catch(() => { if (migrationError) throw migrationError; throw new Error('STORAGE_MIGRATION_FAILED'); });
}

export function storedProjectRecord(ownerKey, aggregate) {
  validateBlueprintAggregate(ownerKey, aggregate);
  const { activityEntries: _activityEntries, ...projectData } = aggregate;
  return { id: aggregate.project.id, schemaVersion: PROJECT_DATA_SCHEMA_VERSION, ...projectData };
}

export function restoreProjectAggregate(record, activityEntries) {
  migrateProjectRecord(record);
  const { schemaVersion, id, ...aggregate } = record;
  if (id !== aggregate.project?.id) throw new Error('STORAGE_RECORD_INVALID');
  return { ...aggregate, activityEntries };
}

function mapStorageError(error, generation) {
  if (generation !== ownerGeneration) return new Error('OWNER_CONTEXT_STALE');
  if (error?.message === 'OWNER_CONTEXT_STALE' || error?.message?.startsWith('STORAGE_SCHEMA_') || error?.message === 'AGGREGATE_INVALID' || error?.message === 'PROJECT_LIMIT_REACHED') return error;
  return new Error('STORAGE_FAILED');
}

export function createIndexedDbProjectRepository() {
  const migrations = new Map();

  async function prepare(ownerKey, generation) {
    const database = await getDatabase(ownerKey, generation);
    let migration = migrations.get(ownerKey);
    if (!migration) {
      migration = migrateOpenDatabase(database, generation).catch((error) => {
        migrations.delete(ownerKey);
        throw error;
      });
      migrations.set(ownerKey, migration);
    }
    await migration;
    assertCurrent(generation);
    return database;
  }

  return {
    async migrate(ownerKey) {
      const generation = ownerGeneration;
      try { await prepare(ownerKey, generation); } catch (error) { throw mapStorageError(error, generation); }
    },

    async list(ownerKey) {
      const generation = ownerGeneration;
      try {
        const database = await prepare(ownerKey, generation);
        const transaction = database.transaction(PROJECT_STORE, 'readonly');
        const done = waitForTransaction(transaction, generation);
        const request = transaction.objectStore(PROJECT_STORE).getAll();
        const records = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await done;
        const summaries = records.map((record) => {
          migrateProjectRecord(record);
          return projectSummaryFromProject(record.project);
        });
        return sortRecentProjectSummaries(summaries).slice(0, 20);
      } catch (error) { throw mapStorageError(error, generation); }
    },

    async get(ownerKey, projectId) {
      const generation = ownerGeneration;
      try {
        const database = await prepare(ownerKey, generation);
        const transaction = database.transaction([PROJECT_STORE, ACTIVITY_STORE], 'readonly');
        const done = waitForTransaction(transaction, generation);
        const projectRequest = transaction.objectStore(PROJECT_STORE).get(projectId);
        const activityRequest = transaction.objectStore(ACTIVITY_STORE).index('projectId').getAll(projectId);
        const [record, activityEntries] = await Promise.all([
          new Promise((resolve, reject) => { projectRequest.onsuccess = () => resolve(projectRequest.result); projectRequest.onerror = () => reject(projectRequest.error); }),
          new Promise((resolve, reject) => { activityRequest.onsuccess = () => resolve(activityRequest.result); activityRequest.onerror = () => reject(activityRequest.error); }),
        ]);
        await done;
        if (!record) return null;
        const aggregate = restoreProjectAggregate(record, activityEntries);
        validateBlueprintAggregate(ownerKey, aggregate);
        return aggregate;
      } catch (error) { throw mapStorageError(error, generation); }
    },

    async save(ownerKey, aggregate) {
      const generation = ownerGeneration;
      try {
        const record = storedProjectRecord(ownerKey, aggregate);
        const database = await prepare(ownerKey, generation);
        const transaction = database.transaction([PROJECT_STORE, ACTIVITY_STORE], 'readwrite');
        const done = waitForTransaction(transaction, generation);
        let saveFailure;
        const projects = transaction.objectStore(PROJECT_STORE);
        const projectKeys = projects.getAllKeys();
        projectKeys.onsuccess = (event) => {
          try {
            const keys = event.target.result;
            if (!keys.includes(record.id) && keys.length >= 20) {
              saveFailure = new Error('PROJECT_LIMIT_REACHED');
              transaction.abort();
              return;
            }
            projects.put(record);
            const activities = transaction.objectStore(ACTIVITY_STORE);
            const existing = activities.index('projectId').openKeyCursor(IDBKeyRange.only(aggregate.project.id));
            existing.onsuccess = () => {
              try {
                const cursor = existing.result;
                if (cursor) { activities.delete(cursor.primaryKey); cursor.continue(); }
                else for (const entry of aggregate.activityEntries) activities.put(entry);
              } catch (error) { saveFailure = error; try { transaction.abort(); } catch { /* Already aborted. */ } }
            };
            existing.onerror = () => { try { transaction.abort(); } catch { /* Already aborted. */ } };
          } catch (error) {
            saveFailure = error;
            try { transaction.abort(); } catch { /* Already aborted. */ }
          }
        };
        projectKeys.onerror = () => { try { transaction.abort(); } catch { /* Already aborted. */ } };
        try { await done; } catch (error) { throw saveFailure ?? error; }
      } catch (error) { throw mapStorageError(error, generation); }
    },

    async transact(ownerKey, projectId, mutate) {
      const generation = ownerGeneration;
      try {
        const database = await prepare(ownerKey, generation);
        const transaction = database.transaction([PROJECT_STORE, ACTIVITY_STORE], 'readwrite');
        const done = waitForTransaction(transaction, generation);
        const projects = transaction.objectStore(PROJECT_STORE);
        const activities = transaction.objectStore(ACTIVITY_STORE);
        const projectRequest = projects.get(projectId);
        const activityRequest = activities.index('projectId').getAll(projectId);
        let result;
        let operationError;
        let loaded = 0;
        const apply = () => {
          loaded += 1;
          if (loaded !== 2) return;
          try {
            if (!projectRequest.result) { result = { status: 'not_found' }; return; }
            const aggregate = restoreProjectAggregate(projectRequest.result, activityRequest.result);
            validateBlueprintAggregate(ownerKey, aggregate);
            result = mutate(aggregate);
            if (!result?.aggregate) return;
            const stored = storedProjectRecord(ownerKey, result.aggregate);
            projects.put(stored);
            const oldKeys = activities.index('projectId').getAllKeys(projectId);
            oldKeys.onsuccess = () => {
              try {
                for (const key of oldKeys.result) activities.delete(key);
                for (const entry of result.aggregate.activityEntries) activities.put(entry);
              } catch (error) { operationError = error; try { transaction.abort(); } catch { /* Already aborted. */ } }
            };
            oldKeys.onerror = () => { operationError = oldKeys.error; try { transaction.abort(); } catch { /* Already aborted. */ } };
          } catch (error) { operationError = error; try { transaction.abort(); } catch { /* Already aborted. */ } }
        };
        projectRequest.onsuccess = apply;
        activityRequest.onsuccess = apply;
        projectRequest.onerror = () => { operationError = projectRequest.error; try { transaction.abort(); } catch { /* Already aborted. */ } };
        activityRequest.onerror = () => { operationError = activityRequest.error; try { transaction.abort(); } catch { /* Already aborted. */ } };
        await done.catch((error) => { throw operationError ?? error; });
        assertCurrent(generation);
        return result;
      } catch (error) { throw mapStorageError(error, generation); }
    },

    async delete(ownerKey, projectId) {
      const generation = ownerGeneration;
      try {
        const database = await prepare(ownerKey, generation);
        const transaction = database.transaction([PROJECT_STORE, ACTIVITY_STORE], 'readwrite');
        const done = waitForTransaction(transaction, generation);
        try { transaction.objectStore(PROJECT_STORE).delete(projectId); } catch (error) { try { transaction.abort(); } catch { /* Already aborted. */ } await done.catch(() => {}); throw error; }
        const activities = transaction.objectStore(ACTIVITY_STORE);
        const existing = activities.index('projectId').openKeyCursor(IDBKeyRange.only(projectId));
        existing.onsuccess = () => {
          try {
            const cursor = existing.result;
            if (cursor) { activities.delete(cursor.primaryKey); cursor.continue(); }
          } catch { try { transaction.abort(); } catch { /* Already aborted. */ } }
        };
        existing.onerror = () => { try { transaction.abort(); } catch { /* Already aborted. */ } };
        await done;
      } catch (error) { throw mapStorageError(error, generation); }
    },
  };
}

let defaultRepository;
export function getIndexedDbProjectRepository() {
  defaultRepository ??= createIndexedDbProjectRepository();
  return defaultRepository;
}

export function __resetProjectRepositoryForTests() {
  invalidateOwnerConnections();
  defaultRepository = undefined;
}
