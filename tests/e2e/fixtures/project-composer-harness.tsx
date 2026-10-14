import React from "react";
import { createRoot } from "react-dom/client";
import { ProjectComposer } from "../../../src/components/projects/ProjectComposer";
import { createProject } from "../../../src/features/projects/createProject.js";
import type { ProjectRepository, ProjectSummary } from "../../../src/infrastructure/storage/indexeddb-project-repository.js";
import type { CreateProjectInput } from "../../../src/features/projects/createProject.js";
import "../../../src/styles/globals.css";
import "../../../src/styles/home.css";

declare global {
  interface Window { releaseProjectCommand?: () => void; releaseDelete?: () => void; rejectDelete?: () => void; switchOwner?: () => void }
}

let calls = 0;
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
let deleteCalls = 0;
const summaries: ProjectSummary[] = Array.from({ length: 20 }, (_, index) => ({
  id: `race-project-${index}`,
  title: `경합 프로젝트 ${index}`,
  updatedAt: new Date(2026, 0, index + 1).toISOString(),
  lastOpenedAt: new Date(2026, 0, index + 1).toISOString(),
  readiness: { state: "insufficient", areas: [], pendingProposalCount: 0, conflictCount: 0 },
  activeDocumentType: null,
}));
const raceRepository: ProjectRepository = {
  list: async () => summaries,
  get: async () => null,
  save: async () => {},
  delete: async () => {
    deleteCalls += 1;
    if (deleteCalls === 1) await new Promise<void>((resolve, reject) => {
      window.releaseDelete = resolve;
      window.rejectDelete = () => reject(new Error("DELETE_RACE_REJECTED"));
    });
  },
  migrate: async () => {},
};

async function command(input: CreateProjectInput, ownerKey: string | null) {
  calls += 1;
  if (mode === "pending" && calls === 1) {
    await new Promise<void>((resolve) => { window.releaseProjectCommand = resolve; });
  }
  if (mode === "failure" && calls === 1) throw new Error("TEST_FAILURE");
  return createProject(input, ownerKey);
}

function Harness() {
  const [activeOwner, updateOwner] = React.useState("test-owner");
  window.switchOwner = () => updateOwner("next-owner");
  return (
    <div className="home-shell">
      <header className="home-shell-header"><span className="home-shell-brand"><span className="home-shell-mark">W</span>Blueprint</span></header>
      <main className="home-shell-main" data-created-project="" data-owner={activeOwner}>
        <section className="home-shell-intro"><p className="home-shell-eyebrow">PRODUCT BLUEPRINT</p><h1>아이디어를 제품 설계로 구체화하세요</h1><p>AI와 함께 결정하고 Requirements와 PRD를 완성합니다.</p></section>
        <ProjectComposer ownerKey={activeOwner} onCreated={(projectId) => { document.querySelector("main")?.setAttribute("data-created-project", projectId); }} createCommand={command} repositoryFactory={mode?.startsWith("delete-race") ? () => raceRepository : undefined} />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
