import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseNameForOwner, migrateProjectRecord, PROJECT_DATA_SCHEMA_VERSION } from '../../src/infrastructure/storage/schema-migration.js';

test('IndexedDB namespace requires an owner key and separates owners', () => {
  assert.notEqual(databaseNameForOwner('owner-a'), databaseNameForOwner('owner-b'));
  assert.throws(() => databaseNameForOwner(' '), /OWNER_REQUIRED/);
});

test('schema migration accepts the current record and rejects unknown or newer shapes safely', () => {
  const current = { schemaVersion: PROJECT_DATA_SCHEMA_VERSION, id: 'project-one' };
  assert.equal(migrateProjectRecord(current), current);
  assert.throws(() => migrateProjectRecord({ schemaVersion: PROJECT_DATA_SCHEMA_VERSION + 1 }), /STORAGE_SCHEMA_NEWER/);
  assert.throws(() => migrateProjectRecord({ schemaVersion: PROJECT_DATA_SCHEMA_VERSION - 1 }), /STORAGE_SCHEMA_UNSUPPORTED/);
  assert.throws(() => migrateProjectRecord({}), /STORAGE_SCHEMA_INVALID/);
});
