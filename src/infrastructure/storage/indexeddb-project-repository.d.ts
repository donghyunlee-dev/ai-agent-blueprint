import type { BlueprintAggregate, ProjectSummary } from '../../domain/blueprint/types.js';

export interface ProjectRepository {
  list(ownerKey: string): Promise<ProjectSummary[]>;
  get(ownerKey: string, projectId: string): Promise<BlueprintAggregate | null>;
  save(ownerKey: string, aggregate: BlueprintAggregate): Promise<void>;
  delete(ownerKey: string, projectId: string): Promise<void>;
  migrate(ownerKey: string): Promise<void>;
}

export function createIndexedDbProjectRepository(): ProjectRepository;
export function getIndexedDbProjectRepository(): ProjectRepository;
export function storedProjectRecord(ownerKey: string, aggregate: BlueprintAggregate): object;
export function restoreProjectAggregate(record: object, activityEntries: BlueprintAggregate['activityEntries']): BlueprintAggregate;
