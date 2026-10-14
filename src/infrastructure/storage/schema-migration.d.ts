export const PROJECT_DB_SCHEMA_VERSION: number;
export const PROJECT_DATA_SCHEMA_VERSION: number;
export function databaseNameForOwner(ownerKey: string): string;
export function migrateProjectRecord<T extends { schemaVersion: number }>(record: T): T;
export function openProjectDatabase(ownerKey: string): Promise<IDBDatabase>;
