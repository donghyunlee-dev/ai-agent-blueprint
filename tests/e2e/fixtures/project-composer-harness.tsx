import React from "react";
import { createRoot } from "react-dom/client";
import { ProjectComposer } from "../../../src/components/projects/ProjectComposer";
import { createProject } from "../../../src/features/projects/createProject.js";
import type { CreateProjectInput } from "../../../src/features/projects/createProject.js";
import "../../../src/styles/globals.css";
import "../../../src/styles/home.css";

declare global {
  interface Window { releaseProjectCommand?: () => void }
}

let calls = 0;
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");

async function command(input: CreateProjectInput, ownerKey: string | null) {
  calls += 1;
  if (mode === "pending" && calls === 1) {
    await new Promise<void>((resolve) => { window.releaseProjectCommand = resolve; });
  }
  if (mode === "failure" && calls === 1) throw new Error("TEST_FAILURE");
  return createProject(input, ownerKey);
}

createRoot(document.getElementById("root")!).render(
  <div className="home-shell">
    <header className="home-shell-header"><span className="home-shell-brand"><span className="home-shell-mark">W</span>Blueprint</span></header>
    <main className="home-shell-main" data-created-project="">
      <section className="home-shell-intro"><p className="home-shell-eyebrow">PRODUCT BLUEPRINT</p><h1>아이디어를 제품 설계로 구체화하세요</h1><p>AI와 함께 결정하고 Requirements와 PRD를 완성합니다.</p></section>
      <ProjectComposer ownerKey="test-owner" onCreated={(projectId) => { document.querySelector("main")?.setAttribute("data-created-project", projectId); }} createCommand={command} />
    </main>
  </div>,
);
