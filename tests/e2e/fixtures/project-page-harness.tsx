import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../../src/features/auth/AuthProvider";
import { deriveOwnerKey } from "../../../src/features/auth/ownerContext.js";
import { createBlueprintAggregate } from "../../../src/features/projects/projectAggregate.js";
import { ProjectPage } from "../../../src/pages/ProjectPage";
import type { BlueprintAggregate } from "../../../src/domain/blueprint/types.js";
import type { ProjectRepository } from "../../../src/infrastructure/storage/indexeddb-project-repository.js";
import "../../../src/styles/globals.css";

declare global { interface Window { rejectRetry?: () => void } }

const issuer = "https://accounts.google.com";
const ownerA = await deriveOwnerKey({ issuer, subject: "retry-owner-a" });
const ownerB = await deriveOwnerKey({ issuer, subject: "retry-owner-b" });
let ownerASaves = 0;

function aggregate(ownerKey: string, title: string): BlueprintAggregate {
  const now = new Date().toISOString();
  const project = {
    id: "retry-project", ownerKey, schemaVersion: 1, title, status: "active" as const,
    activeDocumentType: "design" as const, activeThreadId: "retry-thread", processState: "intake" as const,
    readiness: { state: "insufficient" as const, areas: [], pendingProposalCount: 0, conflictCount: 0 },
    createdAt: now, updatedAt: now, lastOpenedAt: now,
  };
  const thread = { id: "retry-thread", projectId: project.id, title, status: "active" as const, createdAt: now, updatedAt: now };
  const message = { id: `message-${ownerKey}`, threadId: thread.id, logicalRequestId: "request", role: "user" as const, kind: "text" as const, content: title, createdAt: now };
  return createBlueprintAggregate({ project, thread, message });
}

const aggregates = new Map([[ownerA, aggregate(ownerA, "A 소유자 프로젝트")], [ownerB, aggregate(ownerB, "B 소유자 프로젝트")]]);
const repository: ProjectRepository = {
  list: async () => [],
  get: async (ownerKey, projectId) => projectId === "retry-project" ? structuredClone(aggregates.get(ownerKey) ?? null) : null,
  save: async (ownerKey) => {
    if (ownerKey === ownerA) {
      ownerASaves += 1;
      document.body.dataset.aSaves = String(ownerASaves);
      if (ownerASaves === 1) throw new Error("INITIAL_SAVE_FAILURE");
      if (ownerASaves === 2) await new Promise<void>((_, reject) => { window.rejectRetry = () => reject(new Error("STALE_RETRY_FAILURE")); });
    }
  },
  delete: async () => {},
  migrate: async () => {},
};
const repositoryFactory = () => repository;

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={["/blueprints/retry-project"]}>
      <Routes>
        <Route path="/blueprints/:projectId" element={<ProjectPage repositoryFactory={repositoryFactory} />} />
      </Routes>
    </MemoryRouter>
  </AuthProvider>,
);
