import type { CreatedProjectBundle, CreateProjectInput } from './createProject.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';

export const LAST_PROJECT_ID_KEY: string;
export function setLastProjectId(projectId: string): boolean;
export function getLastProjectId(): string | null;
export function persistProjectCreation(options: { input: CreateProjectInput; ownerKey: string; repository?: ProjectRepository; createCommand?: (input: CreateProjectInput, ownerKey: string) => Promise<CreatedProjectBundle>; remember?: (projectId: string) => unknown }): Promise<CreatedProjectBundle>;
