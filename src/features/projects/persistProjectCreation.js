import { createProject } from './createProject.js';
import { createBlueprintAggregate } from './projectAggregate.js';
import { getIndexedDbProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';

export const LAST_PROJECT_ID_KEY = 'blueprint:lastProjectId';

export function setLastProjectId(projectId) {
  if (typeof localStorage === 'undefined') return false;
  try { localStorage.setItem(LAST_PROJECT_ID_KEY, projectId); return true; } catch { return false; }
}

export function getLastProjectId() {
  if (typeof localStorage === 'undefined') return null;
  try { return localStorage.getItem(LAST_PROJECT_ID_KEY); } catch { return null; }
}

export async function persistProjectCreation({
  input,
  ownerKey,
  repository = getIndexedDbProjectRepository(),
  createCommand = createProject,
  remember = setLastProjectId,
}) {
  if (!ownerKey) throw new Error('OWNER_REQUIRED');
  const bundle = await createCommand(input, ownerKey);
  const aggregate = createBlueprintAggregate(bundle);
  await repository.save(ownerKey, aggregate);
  remember(bundle.project.id);
  return bundle;
}
