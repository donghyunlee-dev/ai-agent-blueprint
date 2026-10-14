import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "../../../src/features/auth/AuthProvider";
import { createProject, findCreatedProject } from "../../../src/features/projects/createProject.js";

function ProviderProbe() {
  const { status, user, ownerKey, checkSession, logout } = useAuth();
  const [memoryProjects, setMemoryProjects] = useState<Array<{ subject: string; projectId: string; ownerKey: string }>>([]);
  const [, refreshMemoryRegistry] = useState(0);

  useEffect(() => {
    if (status !== "authenticated" || !user || !ownerKey) return;
    let cancelled = false;
    void createProject({ idea: `Memory lifecycle project for ${user.subject}`, requestId: `auth-provider-${user.subject}` }, ownerKey).then(({ project }) => {
      if (cancelled) return;
      setMemoryProjects((current) => current.some((entry) => entry.projectId === project.id)
        ? current
        : [...current, { subject: user.subject, projectId: project.id, ownerKey }]);
    });
    return () => { cancelled = true; };
  }, [ownerKey, status, user]);

  const currentProject = memoryProjects.find((entry) => entry.subject === user?.subject);
  const currentProjectExists = currentProject && findCreatedProject(currentProject.projectId, currentProject.ownerKey);
  const memoryProjectStatus = memoryProjects.map((entry) => (
    `${entry.subject}:${findCreatedProject(entry.projectId, entry.ownerKey) ? "present" : "missing"}`
  )).join(",");

  return (
    <main>
      <output data-testid="auth-status">{status}</output>
      <output data-testid="auth-subject">{user?.subject ?? ""}</output>
      <output data-testid="owner-context-present">{ownerKey ? "yes" : "no"}</output>
      <output data-testid="memory-project-owner">{currentProjectExists ? currentProject?.subject : ""}</output>
      <output data-testid="memory-project-status">{memoryProjectStatus}</output>
      <button type="button" onClick={() => refreshMemoryRegistry((revision) => revision + 1)}>Refresh memory registry</button>
      <button type="button" onClick={() => void checkSession()}>Check session</button>
      <button type="button" onClick={() => window.dispatchEvent(new Event("blueprint:session-expired"))}>Expire session</button>
      <button type="button" onClick={() => void logout()}>Logout</button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider><ProviderProbe /></AuthProvider>,
);
