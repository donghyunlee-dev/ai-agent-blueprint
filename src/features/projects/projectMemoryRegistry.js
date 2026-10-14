const createdProjects = new Map();

export function registerCreatedProject(project, thread, message) {
  createdProjects.set(project.id, { project, thread, message });
}

export function findCreatedProject(projectId, ownerKey) {
  const bundle = createdProjects.get(projectId);
  return bundle?.project.ownerKey === ownerKey ? bundle : null;
}
