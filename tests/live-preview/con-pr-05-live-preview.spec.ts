import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { BlueprintAggregate } from "../../src/domain/blueprint/types.js";
import { deriveOwnerKey } from "../../src/features/auth/ownerContext.js";
import { computeDesignReadiness, DESIGN_SECTIONS } from "../../src/features/design/readiness.js";
import { databaseNameForOwner } from "../../src/infrastructure/storage/schema-migration.js";

const previewUrl = new URL(process.env.PLAYWRIGHT_PREVIEW_URL!);
const previewOrigin = previewUrl.origin;
const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN!;
const previewSessionToken = process.env.PREVIEW_E2E_SESSION_TOKEN!;

type Identity = { issuer: string; subject: string; email: string };
type Aggregate = BlueprintAggregate;

async function readAggregate(page: Page, databaseName: string, projectId: string): Promise<Aggregate> {
  return page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<Aggregate>((resolve, reject) => {
      const request = db.transaction("projects").objectStore("projects").get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record;
  }, { databaseName, projectId });
}

function safeProviderError(payload: any, status: number) {
  const code = payload?.error ?? payload?.code ?? "UNKNOWN";
  return `LIVE_PREVIEW_API_FAILED:${status}:${String(code).slice(0, 80)}`;
}

function assertGenerationTasks(ledger: any[], documentType: "requirements" | "prd") {
  const prefix = documentType === "requirements" ? "REQUIREMENTS" : "PRD";
  const allowedTasks = new Set([`${prefix}_DRAFT`, `${prefix}_REVIEW`, `${prefix}_REPAIR`]);
  const groups: any[][] = [];
  for (const entry of ledger) {
    expect(allowedTasks.has(entry.task), "the ledger must contain only this document's generation tasks").toBe(true);
    const currentGroup = groups.at(-1);
    if (!currentGroup || currentGroup[0].task !== entry.task) groups.push([entry]);
    else currentGroup.push(entry);
  }

  const groupsFor = (task: string) => groups.filter((group) => group[0].task === task);
  expect(groupsFor(`${prefix}_DRAFT`)).toHaveLength(1);
  const reviewGroups = groupsFor(`${prefix}_REVIEW`);
  expect(reviewGroups.length).toBeGreaterThanOrEqual(1);
  expect(reviewGroups.length).toBeLessThanOrEqual(2);
  const repairGroups = groupsFor(`${prefix}_REPAIR`);
  expect(repairGroups.length).toBeLessThanOrEqual(1);
  if (repairGroups.length) expect(reviewGroups).toHaveLength(2);

  for (const group of groups) {
    expect(group.length).toBeGreaterThanOrEqual(1);
    expect(group.length).toBeLessThanOrEqual(2);
    expect(group.at(-1).status, "each logical task phase must finish successfully").toBe("succeeded");
    if (group.length === 2) {
      expect(group[0]).toMatchObject({ status: "failed", errorCode: "AI_INVALID_OUTPUT" });
      expect(group[1].status).toBe("succeeded");
    }
  }
}

async function sendTurn(page: Page, text: string) {
  const requestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/blueprint/turn" && request.method() === "POST");
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return new URL(response.url()).pathname === "/api/blueprint/turn" && request.method() === "POST";
  });
  await page.getByRole("textbox", { name: "AI에 보낼 자유 답변" }).fill(text);
  await page.getByRole("button", { name: "AI로 답변 분석" }).click();
  const consent = page.getByRole("button", { name: "동의하고 계속" });
  if (await consent.isVisible().catch(() => false)) await consent.click();
  const response = await responsePromise;
  const request = await requestPromise;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok()) throw new Error(safeProviderError(payload, response.status()));
  await expect(page.locator(".ai-turn-cancel")).toBeHidden();
  return { ...payload, requestUserTurnId: request.postDataJSON()?.userTurn?.id };
}

function proposalType(proposal: any) {
  return proposal.targetType === "design_item" ? proposal.after?.type : proposal.targetType;
}

const groundedProposalPatterns: Record<string, RegExp> = {
  product_definition: /회의실|예약/,
  problem: /중복|충돌|예약|빈 회의실/,
  goal: /중복|예약|회의실/,
  user_role: /직원|총무|관리/,
  scenario: /직원|예약|회의실|찾/,
  requirement: /예약|중복|시간대|수용 인원/,
  scope: /검색|예약|취소|회의실/,
  out_of_scope: /방문자|결제|출입|좌석/,
  success_metric: /50|2분|중복|예약/,
  risk: /동기화|정보|충돌|예약/,
  acceptance_criterion: /예약|중복|시간대|안내/,
};

async function approveVerifiedProposals(
  page: Page,
  projectId: string,
  databaseName: string,
  expected: { allowedTypes: string[]; evidenceSourceIds: string[] },
) {
  const before = await readAggregate(page, databaseName, projectId);
  const pending = before.proposals.filter((proposal) => proposal.status === "pending");
  expect(pending.length, "only proposals produced by the user turn under review may be approved").toBeGreaterThan(0);
  for (const proposal of pending) {
    const type = proposalType(proposal);
    expect(expected.allowedTypes, "proposal type must match a fact entered in the current test turn").toContain(type);
    expect(groundedProposalPatterns[type]?.test(JSON.stringify(proposal.after)), "proposal content must match the user-provided decision").toBe(true);
    expect(
      proposal.evidence.some((evidence: any) => evidence.sourceType === "message" && expected.evidenceSourceIds.includes(evidence.sourceId)),
      "every proposal must cite a user message that supplied the fact",
    ).toBe(true);
  }

  await page.goto(`/blueprints/${projectId}/design#proposal-review-title`);
  for (const proposal of pending) {
    const card = page.locator(`.proposal-review-item[data-proposal-card="${proposal.id}"]`);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "승인", exact: true }).click();
    await expect(card).toHaveCount(0);
  }
  const after = await readAggregate(page, databaseName, projectId);
  expect(after.proposals.filter((proposal) => pending.some((item) => item.id === proposal.id)).every((proposal) => proposal.status === "accepted")).toBe(true);
  await page.goto(`/blueprints/${projectId}#conversation`);
}

const designFacts: Record<string, string> = {
  product_definition: "제품은 사내 직원과 총무 담당자가 함께 쓰는 회의실 예약 및 운영 웹 서비스입니다.",
  problem: "현재는 여러 도구에 예약이 흩어져 같은 회의실과 시간대에 중복 예약이 생기고 빈 회의실도 찾기 어렵습니다.",
  goal: "목표는 중복 예약을 막고 직원이 적합한 회의실을 직접 찾아 빠르게 예약하도록 하는 것입니다.",
  user_role: "주요 사용자는 사내 회의를 예약하는 직원과 회의실 정보 및 예외를 관리하는 총무 담당자입니다.",
  scenario: "직원은 날짜와 참석 인원을 입력해 사용 가능한 회의실을 찾고 예약하며, 총무 담당자는 회의실 운영 상태를 관리합니다.",
  requirement: "핵심 기능은 예약 전에 회의실의 수용 인원과 기존 예약을 검사하고 중복 시간대 예약을 막는 것입니다. 수용 기준은 같은 회의실과 시간대에 두 번째 예약을 보내면 저장되지 않고 중복 안내가 보여야 합니다.",
  scope: "첫 버전 범위에는 회의실 검색, 이용 가능 시간 확인, 예약 생성과 취소, 회의실 수용 인원 표시가 포함됩니다.",
  out_of_scope: "첫 버전에서 제외할 항목은 방문자 예약, 출입문 제어, 좌석 배치도, 유료 결제입니다.",
  success_metric: "성공 기준은 출시 3개월 안에 중복 예약을 기준선보다 50퍼센트 줄이고 예약에 걸리는 중앙값을 2분 이하로 만드는 것입니다.",
  risk: "주요 위험은 외부 일정 동기화 지연과 오래된 회의실 정보이며, 예약 직전에 서버가 다시 시간대 충돌을 검사해야 합니다.",
};

function readinessPrompt(aggregate: Aggregate) {
  const readiness = computeDesignReadiness(aggregate);
  const missing = new Set<string>();
  const confirmedTypes = new Set<string>(aggregate.designItems.filter((item) => item.status === "confirmed").map((item) => item.type));
  for (const area of readiness.areas) {
    const section = DESIGN_SECTIONS.find((entry) => entry.key === area.key);
    if (area.status === "missing") for (const type of section?.requiredTypes ?? []) if (!confirmedTypes.has(type)) missing.add(type);
    if (area.key === "features" && area.blockers.some((blocker: any) => /수용 기준/.test(blocker.reason))) {
      missing.add("acceptance_criterion");
    }
  }

  const expectedTypes = [...missing];
  const facts = expectedTypes.filter((type) => type !== "acceptance_criterion").map((type) => designFacts[type]).filter(Boolean);
  const criterionTarget = aggregate.designItems.find((item) => item.type === "requirement" && !(item.acceptanceCriteria ?? []).some((criterion) => criterion.status === "confirmed" && criterion.text?.trim()));
  if (missing.has("acceptance_criterion") && criterionTarget) {
    facts.push(`확정 기능 ‘${criterionTarget.title}’의 수용 기준은 같은 회의실 같은 시간대의 첫 예약은 저장되고 두 번째는 거절되며 기존 예약은 보존되는 것입니다.`);
  }
  if (!facts.length) return null;
  return {
    expectedTypes,
    text: `아래의 사실은 내가 결정한 내용입니다. 근거 없는 내용을 추가하지 말고, 가능한 서로 다른 항목을 최대 네 개까지 검토 대기 설계 제안으로 만들어 주세요. 이번에 다루지 못한 사실은 다음 대화에서 제안해도 됩니다.\n${facts.join("\n")}`,
  };
}

test("protected Preview supports live conversation, recommendation approval, Requirements, and same-revision PRD", async ({ page }, testInfo) => {
  test.setTimeout(15 * 60 * 1000);
  const pageErrors: string[] = [];
  const googleOAuthRequests: string[] = [];
  const apiEvidence: Array<Record<string, any>> = [];
  page.on("pageerror", (error) => pageErrors.push(error.name || "PageError"));
  page.on("console", (message) => { if (message.type() === "error") pageErrors.push("ConsoleError"); });
  page.on("request", (request) => {
    if (/\/api\/auth\/google\/(start|callback)/.test(new URL(request.url()).pathname)) googleOAuthRequests.push(new URL(request.url()).pathname);
  });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== previewOrigin) return route.continue();
    await route.continue({ headers: { ...route.request().headers(), "x-vercel-trusted-oidc-idp-token": vercelOidcToken } });
  });

  await page.goto("/");
  const bootstrap = await page.evaluate(async (token) => {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "x-preview-e2e-session-token": token },
      credentials: "same-origin",
    });
    return response.status;
  }, previewSessionToken);
  expect(bootstrap, "the Preview-only synthetic session must be accepted").toBe(204);
  const sessionResponse = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session", { credentials: "same-origin" });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  });
  expect(sessionResponse.status).toBe(200);
  expect(sessionResponse.body).toMatchObject({ authenticated: true, user: { subject: "blueprint-preview-e2e-synthetic" } });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" })).toBeVisible();
  const identity = sessionResponse.body.user as Identity;
  const ownerKey = await deriveOwnerKey(identity);
  const databaseName = databaseNameForOwner(ownerKey);

  const projectIdea = "사내 회의실 예약 서비스입니다. 여러 도구에 예약이 흩어져 같은 회의실과 시간대에 중복 예약이 생기고 빈 회의실을 찾기 어렵습니다. 사용자는 예약하는 직원과 회의실을 관리하는 총무 담당자입니다. 직원은 날짜와 참석 인원으로 빈 방을 찾아 예약하고, 총무는 회의실 정보를 관리합니다. 핵심 기능은 예약 전 수용 인원과 기존 일정을 확인해 중복을 막는 것입니다. 두 번째 같은 시간대 예약은 저장되지 않고 안내되어야 합니다. 첫 버전은 검색, 가능 시간 확인, 예약 생성과 취소, 수용 인원 표시를 포함하고 방문자 예약, 출입문 제어, 좌석 배치도, 결제는 제외합니다. 출시 3개월 안에 중복 예약을 50퍼센트 줄이고 예약 중앙값을 2분 이내로 만드는 것이 성공 기준입니다. 위험은 일정 동기화 지연과 오래된 방 정보이며 예약 직전 서버 충돌 검사가 필요합니다.";
  await page.getByRole("textbox", { name: "만들고 싶은 제품이나 해결할 문제" }).fill(projectIdea);
  await page.getByRole("button", { name: "Blueprint 시작" }).click();
  await expect(page).toHaveURL(/\/blueprints\/[^/]+#conversation$/);
  const projectId = new URL(page.url()).pathname.split("/").filter(Boolean).at(-1)!;
  let aggregate = await readAggregate(page, databaseName, projectId);

  let recommendationPayload: any;
  for (let attempt = 0; attempt < 4; attempt++) {
    recommendationPayload = await sendTurn(page, "회의실 예약 중복을 막는 핵심 기능에 대해 대화에서 확인한 조건을 반영한 11개 추천안을 보여 주세요. 각 안에 실제 대화 근거를 연결해 주세요.");
    const candidates = recommendationPayload.recommendationCandidates?.candidates;
    if (Array.isArray(candidates) && candidates.length === 11) break;
    if (attempt < 3) {
      const questionCard = page.locator(".contextual-question-card").last();
      await expect(questionCard, "an insufficient-context response must ask the user for the missing decision").toBeVisible();
      await sendTurn(page, "우선순위는 제가 처음 설명한 대로 같은 회의실과 시간대의 중복 예약을 막고 수용 인원을 확인하는 것입니다. 그 외의 확인되지 않은 기준은 새로 가정하지 말아 주세요.");
    }
  }
  const candidates = recommendationPayload?.recommendationCandidates?.candidates;
  expect(Array.isArray(candidates) ? candidates.length : 0, "live provider must return all 11 recommendation candidates").toBe(11);
  const candidateTitles = candidates.map((candidate: any) => candidate.title);
  expect(new Set(candidateTitles).size, "recommendation titles must be distinct").toBe(11);
  expect(candidates.every((candidate: any) => Array.isArray(candidate.evidence) && candidate.evidence.length > 0), "each recommendation must show grounded evidence").toBe(true);
  expect(recommendationPayload.requestLedgerEntries).toHaveLength(3);
  expect(recommendationPayload.requestLedgerEntries.every((entry: any) => entry.task === "OPTION_RECOMMEND" && entry.status === "succeeded")).toBe(true);
  await expect(page.locator(".recommendation-candidates li")).toHaveCount(11);
  await expect(page.getByRole("button", { name: "이 추천 선택" })).toHaveCount(11);
  apiEvidence.push({ endpoint: "turn/OPTION_RECOMMEND", status: 200, recommendationCount: candidates.length, distinctTitles: new Set(candidateTitles).size, evidenceCount: candidates.reduce((sum: number, candidate: any) => sum + candidate.evidence.length, 0) });

  const requirementCandidateIndex = candidates.findIndex((candidate: any) => candidate.proposalDraft?.after?.type === "requirement" && candidate.evidence.some((item: any) => item.sourceType === "message"));
  expect(requirementCandidateIndex, "at least one recommendation must create a core feature for approval").toBeGreaterThanOrEqual(0);
  const selectedCandidate = candidates[requirementCandidateIndex];
  expect(groundedProposalPatterns.requirement.test(JSON.stringify(selectedCandidate.proposalDraft.after))).toBe(true);
  const selectedCandidateCard = page.locator(".recommendation-candidates li").nth(requirementCandidateIndex);
  const citedMessageId = selectedCandidate.evidence.find((item: any) => item.sourceType === "message").sourceId;
  await selectedCandidateCard.getByRole("button", { name: "대화 근거 보기" }).first().click();
  await expect(page.locator(`#conversation-message-${citedMessageId}`)).toBeFocused();
  const choose = selectedCandidateCard.getByRole("button", { name: "이 추천 선택" });
  await expect(choose).toBeVisible();
  await choose.click();
  await expect(page.locator(".workspace-message-assistant").filter({ hasText: "승인 대기" }).last()).toBeVisible();
  aggregate = await readAggregate(page, databaseName, projectId);
  const pendingCandidate = aggregate.proposals.filter((proposal) => proposal.status === "pending");
  expect(pendingCandidate).toHaveLength(1);
  expect(pendingCandidate[0]).toMatchObject({ targetType: "design_item", operation: "create", after: { type: "requirement", title: selectedCandidate.title } });
  const citedMessageIds = selectedCandidate.evidence.map((item: any) => item.sourceId);
  await approveVerifiedProposals(page, projectId, databaseName, { allowedTypes: ["requirement"], evidenceSourceIds: citedMessageIds });
  await expect(page.getByRole("complementary", { name: "요약" })).toContainText(selectedCandidate.title);

  for (let attempt = 0; attempt < 10; attempt++) {
    aggregate = await readAggregate(page, databaseName, projectId);
    if (computeDesignReadiness(aggregate).canGenerateRequirements) break;
    const prompt = readinessPrompt(aggregate);
    if (!prompt) break;
    const response = await sendTurn(page, prompt.text);
    apiEvidence.push({ endpoint: "turn/TURN_ANALYZE", status: 200, proposalCount: response.proposals?.length ?? 0 });
    const responseProposals = response.proposals ?? [];
    if (responseProposals.length) {
      for (const proposal of responseProposals) expect(prompt.expectedTypes).toContain(proposalType(proposal));
      await approveVerifiedProposals(page, projectId, databaseName, { allowedTypes: prompt.expectedTypes, evidenceSourceIds: [response.requestUserTurnId] });
    }
  }
  aggregate = await readAggregate(page, databaseName, projectId);
  expect(computeDesignReadiness(aggregate).canGenerateRequirements, "Requirements stays gated until real conversational proposals are approved").toBe(true);

  await page.goto(`/blueprints/${projectId}/requirements`);
  const requirementsResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/blueprint/documents/generate" && response.request().method() === "POST");
  await page.getByRole("button", { name: "요구사항 명세 생성" }).click();
  const requirementsResponse = await requirementsResponsePromise;
  const requirementsResult = await requirementsResponse.json().catch(() => ({}));
  if (!requirementsResponse.ok()) throw new Error(safeProviderError(requirementsResult, requirementsResponse.status()));
  const requirements = requirementsResult.document;
  aggregate = await readAggregate(page, databaseName, projectId);
  expect(requirements).toMatchObject({ type: "requirements", status: "review_required", designRevision: aggregate.project.designRevision });
  expect(requirements.generationArtifact).toEqual(expect.any(String));
  assertGenerationTasks(requirementsResult.requestLedgerEntries ?? [], "requirements");
  apiEvidence.push({ endpoint: "documents/generate:requirements", status: 200, documentStatus: requirements.status, designRevision: requirements.designRevision, sectionCount: requirements.sectionIds?.length ?? 0, tasks: requirementsResult.requestLedgerEntries.map((entry: any) => entry.task) });

  const readyButton = page.getByRole("button", { name: "검토 완료 확인" });
  await expect(readyButton).toBeEnabled();
  await readyButton.click();
  const readyResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/blueprint/documents/requirements/ready" && response.request().method() === "POST");
  await page.getByRole("dialog").getByRole("button", { name: "요구사항 명세 검토 완료" }).click();
  const readyResponse = await readyResponsePromise;
  const readyResult = await readyResponse.json().catch(() => ({}));
  if (!readyResponse.ok()) throw new Error(safeProviderError(readyResult, readyResponse.status()));
  aggregate = await readAggregate(page, databaseName, projectId);
  const readyRequirements = aggregate.documents.filter((document: any) => document.type === "requirements").sort((a: any, b: any) => b.version - a.version)[0];
  expect(readyRequirements).toMatchObject({ status: "ready", designRevision: aggregate.project.designRevision, readyDesignRevision: aggregate.project.designRevision });
  apiEvidence.push({ endpoint: "documents/requirements/ready", status: 200, designRevision: readyRequirements.readyDesignRevision });

  const requirementsDownload = page.getByRole("group", { name: "요구사항 명세 내보내기" }).getByRole("button", { name: "Markdown 다운로드" });
  const requirementsDownloadPromise = page.waitForEvent("download");
  await requirementsDownload.click();
  const requirementsFile = await requirementsDownloadPromise;
  expect(requirementsFile.suggestedFilename()).toMatch(/\.md$/i);
  const requirementsPath = testInfo.outputPath(requirementsFile.suggestedFilename());
  await requirementsFile.saveAs(requirementsPath);
  const requirementsMarkdown = await readFile(requirementsPath, "utf8");
  expect(requirementsMarkdown).toContain(`# ${requirements.title}`);
  expect(requirementsMarkdown.trim().length).toBeGreaterThan(300);

  await page.getByRole("button", { name: "PRD 열기" }).click();
  const prdResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/blueprint/documents/generate" && response.request().method() === "POST");
  await page.getByRole("button", { name: "PRD 생성" }).click();
  const prdResponse = await prdResponsePromise;
  const prdResult = await prdResponse.json().catch(() => ({}));
  if (!prdResponse.ok()) throw new Error(safeProviderError(prdResult, prdResponse.status()));
  const prd = prdResult.document;
  expect(prd).toMatchObject({ type: "prd", status: "review_required", designRevision: readyRequirements.readyDesignRevision });
  assertGenerationTasks(prdResult.requestLedgerEntries ?? [], "prd");
  apiEvidence.push({ endpoint: "documents/generate:prd", status: 200, documentStatus: prd.status, designRevision: prd.designRevision, sectionCount: prd.sectionIds?.length ?? 0, tasks: prdResult.requestLedgerEntries.map((entry: any) => entry.task) });
  const prdDownload = page.getByRole("group", { name: "PRD 내보내기" }).getByRole("button", { name: "Markdown 다운로드" });
  const prdDownloadPromise = page.waitForEvent("download");
  await prdDownload.click();
  const prdFile = await prdDownloadPromise;
  expect(prdFile.suggestedFilename()).toMatch(/\.md$/i);
  const prdPath = testInfo.outputPath(prdFile.suggestedFilename());
  await prdFile.saveAs(prdPath);
  const prdMarkdown = await readFile(prdPath, "utf8");
  expect(prdMarkdown).toContain(`# ${prd.title}`);
  expect(prdMarkdown.trim().length).toBeGreaterThan(300);

  await page.reload();
  await expect(page.getByRole("heading", { name: "제품 요구사항 문서" })).toBeVisible();
  aggregate = await readAggregate(page, databaseName, projectId);
  const savedPrd = aggregate.documents.filter((document: any) => document.type === "prd").sort((a: any, b: any) => b.version - a.version)[0];
  expect(savedPrd).toMatchObject({ status: "review_required", designRevision: readyRequirements.readyDesignRevision });
  expect(aggregate.project.designRevision).toBe(readyRequirements.readyDesignRevision);
  expect(googleOAuthRequests).toEqual([]);
  expect(pageErrors).toEqual([]);

  const report = {
    viewport: testInfo.project.name,
    projectId,
    designRevision: aggregate.project.designRevision,
    approvedDesignItemCount: aggregate.designItems.filter((item) => item.status === "confirmed").length,
    apiEvidence,
    downloads: [requirementsFile.suggestedFilename(), prdFile.suggestedFilename()],
    googleOAuthRequests: googleOAuthRequests.length,
    pageErrors: pageErrors.length,
    providerLedger: aggregate.requestLedgerEntries.map((entry: any) => ({ task: entry.task, status: entry.status, resolvedModel: entry.resolvedModel })),
  };
  await testInfo.attach("live-preview-acceptance.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
});
