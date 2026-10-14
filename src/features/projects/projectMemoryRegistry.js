const createdProjects = new Map();
let clearListenerRegistered = false;

function clearCreatedProjects() {
  createdProjects.clear();
}

function ensureClearListener() {
  if (clearListenerRegistered || typeof window === 'undefined') return;
  window.addEventListener('blueprint:clear-session-state', clearCreatedProjects);
  clearListenerRegistered = true;
}

export function registerCreatedProject(project, thread, message) {
  ensureClearListener();
  createdProjects.set(project.id, { project, thread, message });
}

export function findCreatedProject(projectId, ownerKey) {
  ensureClearListener();
  const bundle = createdProjects.get(projectId);
  return bundle?.project.ownerKey === ownerKey ? bundle : null;
}
