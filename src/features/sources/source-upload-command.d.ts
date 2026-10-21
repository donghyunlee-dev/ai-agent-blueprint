import type { BlueprintAggregate, SourceDocument } from '../../domain/blueprint/types.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';

export interface SourceUploadResult extends Partial<SourceDocument> {
  fileName: string;
  status?: string;
  errorCode?: string;
  message?: string;
  /** Index in the original selection; transient correlation only, never persisted on SourceDocument. */
  fileIndex?: number;
}
export function addSourceFiles(options: {
  ownerKey: string;
  projectId: string;
  files: File[];
  repository: ProjectRepository;
  onAggregate?: (aggregate: BlueprintAggregate) => void;
  extract?: (file: File, extension: string) => Promise<Partial<SourceDocument>>;
}): Promise<SourceUploadResult[]>;
export function removeSource(options: {
  ownerKey: string;
  projectId: string;
  sourceId: string;
  expectedImpactCount?: number;
  repository: ProjectRepository;
  onAggregate?: (aggregate: BlueprintAggregate) => void;
}): Promise<BlueprintAggregate>;
export function sourceRemovalImpact(aggregate: BlueprintAggregate, sourceId: string): number;
export function retrySourceFile(options: {
  ownerKey: string;
  projectId: string;
  sourceId: string;
  file: File;
  repository: ProjectRepository;
  onAggregate?: (aggregate: BlueprintAggregate) => void;
  extract?: (file: File, extension: string) => Promise<Partial<SourceDocument>>;
}): Promise<SourceUploadResult>;
