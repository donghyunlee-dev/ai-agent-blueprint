import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BlueprintAggregate } from "../domain/blueprint/types.js";
import { useAuth } from "../features/auth/AuthProvider";
import { createDebouncedProjectSaver, formatSavedTime } from "../features/projects/projectAutosave.js";
import type { ProjectSaveState } from "../features/projects/projectAutosave.js";
import { getIndexedDbProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import type { ProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import { setLastProjectId } from "../features/projects/persistProjectCreation.js";
import { clampConversationWidth, clampScrollOffset, getConversationScrollTop, getConversationWidth, setConversationScrollTop, setConversationWidth } from "../features/projects/workspacePreferences.js";
import { AuthMenu } from "../components/auth/AuthMenu";
import { QuestionCard } from "../components/conversation/QuestionCard";
import { ConversationSummary } from "../components/conversation/ConversationSummary";
import { GenerationJobStatus } from "../components/conversation/GenerationJobStatus";
import { DisplayBlocks } from "../components/blueprint/display-blocks/DisplayBlocks";
import { compactConversationContext } from "../features/conversation/context-compaction-view.js";
import { AiTurnComposer } from "../components/conversation/AiTurnComposer";
import type { CatalogQuestion } from "../features/conversation/questionEngine.js";
import { createQuestionAnswerRecord, getAnswerReviewState, QUESTION_CATALOG, selectNextQuestion } from "../features/conversation/questionEngine.js";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import { approveProposal, editAndApproveProposal, rejectProposal } from "../features/proposals/proposal-commands.js";
import { bulkApproveProposals, bulkRejectProposals, classifyProposalConflicts, proposalCurrentSnapshot, resolveProposalConflict } from "../features/proposals/dsg-pr-02-commands.js";
import { DesignBoard } from "../features/design/DesignBoard.js";
import { computeDesignReadiness } from "../features/design/readiness.js";
import { RequirementsDocument } from "../components/blueprint/RequirementsDocument.js";
import { commitRequirementsResult } from "../features/documents/requirements-generation.js";
import { fetchBlueprintApi } from "../features/auth/sessionFetch.js";
import "../styles/workspace-shell.css";

const documentTypes = new Set(["design", "requirements", "prd", "setup_guide"]);
const visibleDocumentTypes = ["design", "requirements", "prd"] as const;
type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';
type ProjectSaver = ReturnType<typeof createDebouncedProjectSaver<BlueprintAggregate>>;

function formatConflictValue(value: unknown, targetType: BlueprintAggregate["proposals"][number]["targetType"]) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fields = targetType === "design_item" ? [["항목", "title"], ["설명", "description"]] : targetType === "acceptance_criterion" ? [["수용 기준", "text"]] : [["섹션 제목", "title"], ["문서 내용", "markdown"]];
  const lines = fields.flatMap(([label, key]) => record[key] === undefined || record[key] === null || record[key] === "" ? [] : [`${label}: ${String(record[key])}`]);
  return lines.length ? lines.join(" · ") : "저장된 값 없음";
}

function proposalConflictComparison(aggregate: BlueprintAggregate, proposal: BlueprintAggregate["proposals"][number]) {
  const target = proposal.targetType === "design_item"
    ? aggregate.designItems.find((item) => item.id === proposal.targetId && !item.archivedAt)
    : proposal.targetType === "acceptance_criterion"
      ? aggregate.designItems.filter((item) => !item.archivedAt).flatMap((item) => item.acceptanceCriteria).find((item) => item.id === proposal.targetId)
      : aggregate.sections.find((item) => item.id === proposal.targetId);
  const targetName = proposal.targetType === "acceptance_criterion"
    ? aggregate.designItems.find((item) => item.acceptanceCriteria.some((criterion) => criterion.id === proposal.targetId))?.title ?? "수용 기준"
    : String((target as { title?: unknown } | undefined)?.title ?? (target as { text?: unknown } | undefined)?.text ?? "변경 대상");
  return { targetName, before: formatConflictValue(proposal.before, proposal.targetType), current: formatConflictValue(target, proposal.targetType), proposed: formatConflictValue(proposal.after, proposal.targetType) };
}

export function ProjectPage({ repositoryFactory = getIndexedDbProjectRepository }: { repositoryFactory?: () => ProjectRepository }) {
  const { projectId, documentType } = useParams();
  const navigate = useNavigate();
  const { ownerKey } = useAuth();
  const [aggregate, setAggregate] = useState<BlueprintAggregate | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveState, setSaveState] = useState<ProjectSaveState>({ status: 'saved', savedAt: null });
  const [reopenedQuestionAnswerId, setReopenedQuestionAnswerId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [conversationWidth, setConversationWidthState] = useState(() => getConversationWidth(projectId ?? "") ?? 360);
  const [mobileMode, setMobileMode] = useState<"conversation" | "work" | "review">("work");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedDesignItemId, setSelectedDesignItemId] = useState<string | null>(null);
  const [inspectorOverlay, setInspectorOverlay] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches);
  const [modeTabsVisible, setModeTabsVisible] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  const [mobileLayout, setMobileLayout] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [requirementsGenerating, setRequirementsGenerating] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const requirementsRequestRef = useRef<{ logicalRequestId:string; snapshot:BlueprintAggregate } | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [proposalEdit, setProposalEdit] = useState({ title: "", description: "" });
  const [proposalBulkAction, setProposalBulkAction] = useState<"approve" | "reject" | null>(null);
  const [selectedRejectIds, setSelectedRejectIds] = useState<string[]>([]);
  const [conflictChoices, setConflictChoices] = useState<Record<string, "keep_current" | "accept_proposed" | "edit">>({});
  const proposalBulkDialogRef = useRef<HTMLDialogElement | null>(null);
  const proposalBulkTriggerRef = useRef<HTMLButtonElement | null>(null);
  const operationGeneration = useRef(0);
  const ownerRef = useRef(ownerKey);
  const projectIdRef = useRef(projectId);
  const aggregateRef = useRef<BlueprintAggregate | null>(null);
  const attemptRef = useRef(attempt);
  const activeTurnCancellationRef = useRef<{ jobId:string; abort:()=>void } | null>(null);
  const saverRef = useRef<ProjectSaver | null>(null);
  const conversationRef = useRef<HTMLElement | null>(null);
  const inspectorPanelRef = useRef<HTMLElement | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorCloseRef = useRef<HTMLButtonElement | null>(null);
  const isResizing = useRef(false);
  ownerRef.current = ownerKey;
  projectIdRef.current = projectId;
  attemptRef.current = attempt;

  useEffect(() => {
    const dialog = proposalBulkDialogRef.current;
    if (proposalBulkAction && dialog && !dialog.open) dialog.showModal();
  }, [proposalBulkAction]);

  useEffect(() => {
    const generation = ++operationGeneration.current;
    const activeOwner = ownerKey;
    const activeProjectId = projectId;
    const activeAttempt = attempt;
    let active = true;
    let saver: ProjectSaver | null = null;
    const isCurrent = () => active
      && operationGeneration.current === generation
      && ownerRef.current === activeOwner
      && projectIdRef.current === activeProjectId
      && attemptRef.current === activeAttempt;

    saverRef.current?.dispose();
    saverRef.current = null;
    setAggregate(null);
    aggregateRef.current = null;
    setTitleDraft('');
    setTitleInvalid(false);
    setLoadStatus('loading');
    setSaveState({ status: 'saved', savedAt: null });

    if (!activeOwner || !activeProjectId) {
      return () => {
        active = false;
        if (operationGeneration.current === generation) operationGeneration.current += 1;
      };
    }

    const repository = repositoryFactory();
    void repository.get(activeOwner, activeProjectId).then(async (result) => {
      if (!isCurrent()) return;
      if (!result) { setAggregate(null); setLoadStatus('missing'); return; }
      if (result.project.ownerKey !== activeOwner || result.project.id !== activeProjectId) {
        setAggregate(null);
        setLoadStatus('missing');
        return;
      }

      const conflictSync = await repository.transact(activeOwner, activeProjectId, (latest) => {
        const conflictCount = classifyProposalConflicts(latest).conflictIds.length;
        const pendingCount = latest.proposals.filter((proposal) => proposal.status === "pending").length;
        const nextProcessState = conflictCount ? "conflict_review" : latest.project.processState === "conflict_review" ? pendingCount ? "proposal_review" : "evaluating" : latest.project.processState;
        if (latest.project.readiness.conflictCount === conflictCount && latest.project.readiness.pendingProposalCount === pendingCount && latest.project.processState === nextProcessState) return { status: "unchanged" };
        latest.project.readiness.conflictCount = conflictCount;
        latest.project.readiness.pendingProposalCount = pendingCount;
        latest.project.processState = nextProcessState;
        latest.project.updatedAt = new Date().toISOString();
        return { status: "updated", aggregate: latest };
      });
      if (!isCurrent()) return;
      const loadedAggregate = conflictSync.aggregate ?? result;
      loadedAggregate.project.lastOpenedAt = new Date().toISOString();
      setLastProjectId(loadedAggregate.project.id);
      setAggregate(loadedAggregate);
      aggregateRef.current = loadedAggregate;
      setTitleDraft(loadedAggregate.project.title);
      setLoadStatus('ready');
      saver = createDebouncedProjectSaver({
        save: async (snapshot) => {
          if (!isCurrent()) throw new Error('PROJECT_CONTEXT_STALE');
          await repository.save(activeOwner, snapshot);
          if (!isCurrent()) throw new Error('PROJECT_CONTEXT_STALE');
        },
        onState: (state) => { if (isCurrent()) setSaveState(state); },
      });
      saverRef.current = saver;
      saver.schedule(loadedAggregate);
    }).catch(() => {
      if (isCurrent()) setLoadStatus('error');
    });

    return () => {
      active = false;
      if (operationGeneration.current === generation) operationGeneration.current += 1;
      saver?.dispose();
      if (saverRef.current === saver) saverRef.current = null;
    };
  }, [ownerKey, projectId, attempt, repositoryFactory]);

  useEffect(() => {
    setConversationWidthState(getConversationWidth(projectId ?? "") ?? 360);
  }, [projectId]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1279px)");
    const tabsQuery = window.matchMedia("(max-width: 1023px)");
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setInspectorOverlay(query.matches);
    const updateTabs = () => setModeTabsVisible(tabsQuery.matches);
    const updateMobile = () => setMobileLayout(mobileQuery.matches);
    update();
    updateTabs();
    updateMobile();
    query.addEventListener("change", update);
    tabsQuery.addEventListener("change", updateTabs);
    mobileQuery.addEventListener("change", updateMobile);
    return () => { query.removeEventListener("change", update); tabsQuery.removeEventListener("change", updateTabs); mobileQuery.removeEventListener("change", updateMobile); };
  }, []);

  useEffect(() => {
    if (!aggregate || loadStatus !== "ready") return;
    if (!documentType) {
      navigate(`/blueprints/${encodeURIComponent(aggregate.project.id)}/${aggregate.project.activeDocumentType}`, { replace: true });
      return;
    }
    if (documentType === "requirements" && !computeDesignReadiness(aggregate).canGenerateRequirements) {
      navigate(`/blueprints/${encodeURIComponent(aggregate.project.id)}/design`, { replace: true });
      return;
    }
    if (documentType !== aggregate.project.activeDocumentType) {
      const updated: BlueprintAggregate = {
        ...aggregate,
        project: { ...aggregate.project, activeDocumentType: documentType as BlueprintAggregate["project"]["activeDocumentType"], updatedAt: new Date().toISOString() },
      };
      setAggregate(updated);
      saverRef.current?.schedule(updated);
    }
  }, [aggregate, documentType, loadStatus, navigate]);

  useEffect(() => {
    const panel = conversationRef.current;
    if (!panel || !projectId || loadStatus !== "ready" || panel.clientHeight === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const saved = getConversationScrollTop(projectId);
      if (saved !== null) panel.scrollTop = clampScrollOffset(saved, panel.scrollHeight, panel.clientHeight);
    });
    const persist = () => { setConversationScrollTop(projectId, panel.scrollTop); };
    panel.addEventListener("scroll", persist, { passive: true });
    return () => { window.cancelAnimationFrame(frame); panel.removeEventListener("scroll", persist); };
  }, [loadStatus, mobileMode, projectId]);

  useEffect(() => {
    const inlineReview = mobileLayout && mobileMode === "review";
    inspectorPanelRef.current?.toggleAttribute("inert", !inspectorOpen && inspectorOverlay && !inlineReview);
  }, [inspectorOpen, inspectorOverlay, mobileLayout, mobileMode]);

  useEffect(() => {
    if (!inspectorOpen || !inspectorOverlay) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inspectorCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeInspector(); return; }
      if (event.key !== "Tab") return;
      const drawer = document.querySelector<HTMLElement>(".workspace-inspector");
      const controls = drawer ? [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')] : [];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const selectedTab = document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (previous?.isConnected && previous.getClientRects().length > 0 && (previous.getAttribute("role") !== "tab" || previous.getAttribute("aria-selected") === "true")) previous.focus();
      else {
        if (selectedTab) selectedTab.focus();
        else inspectorTriggerRef.current?.focus();
      }
    };
  }, [inspectorOpen, inspectorOverlay]);

  function resizeConversation(nextWidth: number) {
    const width = clampConversationWidth(nextWidth);
    setConversationWidthState(width);
    setConversationWidth(projectId ?? "", width);
  }

  function selectMode(mode: "conversation" | "work" | "review") {
    setMobileMode(mode);
    setInspectorOpen(mode === "review" && modeTabsVisible && !mobileLayout);
  }

  function closeInspector() {
    setInspectorOpen(false);
    if (modeTabsVisible && mobileMode === "review") setMobileMode("work");
  }

  function editTitle(value: string) {
    setTitleDraft(value);
    if (!aggregate || !value.trim()) { setTitleInvalid(true); return; }
    setTitleInvalid(false);
    const latest = aggregateRef.current ?? aggregate;
    const updated: BlueprintAggregate = {
      ...latest,
      project: { ...latest.project, title: value, updatedAt: new Date().toISOString() },
    };
    aggregateRef.current = updated;
    setAggregate(updated);
    saverRef.current?.schedule(updated);
  }

  async function persistAggregateNow(snapshot: BlueprintAggregate) {
    if (!ownerKey || !projectId || snapshot.project.id !== projectId) throw new Error("PROJECT_CONTEXT_STALE");
    await repositoryFactory().save(ownerKey, snapshot);
  }

  function applyAggregate(snapshot: BlueprintAggregate) {
    aggregateRef.current = snapshot;
    setAggregate(snapshot);
    saverRef.current?.schedule(snapshot);
  }

  function applyCommittedAggregate(snapshot: BlueprintAggregate) {
    aggregateRef.current = snapshot;
    setAggregate(snapshot);
  }

  async function flushProposalAutosave() {
    const saver = saverRef.current;
    if (!saver) return;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await saver.flush();
      const state = saver.getState();
      if (state.status !== "saving") {
        if (state.status === "failed") throw new Error("STORAGE_FAILED");
        return;
      }
    }
    throw new Error("STORAGE_SAVE_DID_NOT_SETTLE");
  }

  async function resolveProposal(proposalId: string, action: "approve" | "reject" | "edit") {
    if (!ownerKey || !projectId || proposalBusyId) return;
    const latest = aggregateRef.current;
    if (!latest) return;
    const pending = latest.proposals.filter((proposal) => proposal.status === "pending");
    const nextProposalId = pending[pending.findIndex((proposal) => proposal.id === proposalId) + 1]?.id;
    setProposalBusyId(proposalId);
    setProposalError(null);
    try {
      await flushProposalAutosave();
      const repository = repositoryFactory();
      const input = { ownerKey, projectId, proposalId, repository };
      const currentProposal = latest.proposals.find((proposal) => proposal.id === proposalId);
      const editedValue = currentProposal?.targetType === "acceptance_criterion" ? { text: proposalEdit.title } : currentProposal?.targetType === "document_section" ? { title: proposalEdit.title, markdown: proposalEdit.description } : proposalEdit;
      const result = action === "reject" ? await rejectProposal(input) : action === "edit" ? await editAndApproveProposal({ ...input, editedValue }) : await approveProposal(input);
      if (result.status === "stale") { if (result.aggregate) applyCommittedAggregate(result.aggregate); setProposalError("확정된 값이 제안 작성 당시와 달라졌습니다. 기존 값은 유지됐으며 이 항목은 충돌 검토가 필요합니다."); return; }
      if (result.status === "edit_not_supported") { setProposalError("삭제 제안은 수정할 수 없습니다. 승인하거나 거절해 주세요."); return; }
      if (result.status === "not_found") throw new Error("PROPOSAL_NOT_FOUND");
      if (result.status === "invalid_value") { setProposalError("제목과 설명을 입력해 주세요."); return; }
      if (result.aggregate) applyCommittedAggregate(result.aggregate);
      setEditingProposalId(null);
      if (nextProposalId) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-proposal-card="${CSS.escape(nextProposalId)}"]`)?.focus());
    } catch {
      setProposalError("저장하지 못했습니다. 제안과 확정 설계는 보존했습니다. 다시 시도해 주세요.");
    } finally { setProposalBusyId(null); }
  }

  async function resolveConflict(proposalId: string) {
    if (!ownerKey || !projectId || proposalBusyId) return;
    const choice = conflictChoices[proposalId];
    if (!choice) return;
    setProposalBusyId(proposalId); setProposalError(null);
    try {
      await flushProposalAutosave();
      const latest = aggregateRef.current; if (!latest) return;
      const proposal = latest.proposals.find((item) => item.id === proposalId);
      if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
      const editedValue = proposal.targetType === "acceptance_criterion" ? { text: proposalEdit.title } : proposal.targetType === "document_section" ? { title: proposalEdit.title, markdown: proposalEdit.description } : proposalEdit;
      const expectedCurrent = proposalCurrentSnapshot(latest, proposal);
      const result = await resolveProposalConflict({ ownerKey, projectId, proposalId, choice, expectedCurrent, editedValue, repository: repositoryFactory() });
      if (result.status === "changed_again") { if (result.aggregate) applyCommittedAggregate(result.aggregate); setProposalError("검토 중 확정값이 다시 변경됐습니다. 최신 값으로 다시 선택해 주세요."); return; }
      if (result.status === "invalid_value") { setProposalError("수정값의 필수 항목을 입력해 주세요."); return; }
      if (result.status === "invalid_target") { if (result.aggregate) applyCommittedAggregate(result.aggregate); setProposalError("제안 대상이 없거나 이미 사용 중입니다. 기존 값을 유지하거나 제안을 거절해 주세요."); return; }
      if (result.status === "not_conflict") { if (result.aggregate) applyCommittedAggregate(result.aggregate); setProposalError("현재 값은 더 이상 충돌 상태가 아닙니다. 최신 제안을 확인해 주세요."); return; }
      if (result.aggregate) applyCommittedAggregate(result.aggregate);
    } catch { setProposalError("충돌을 저장하지 못했습니다. 기존 확정 설계는 보존했습니다. 다시 시도해 주세요."); }
    finally { setProposalBusyId(null); }
  }

  function closeBulkDialog() {
    setProposalBulkAction(null);
    window.requestAnimationFrame(() => {
      const trigger = proposalBulkTriggerRef.current;
      if (trigger && !trigger.disabled) trigger.focus();
      else document.querySelector<HTMLElement>("#proposal-review-title")?.focus();
    });
  }

  async function resolveBulk(action: "approve" | "reject") {
    if (!ownerKey || !projectId || proposalBusyId) return;
    const latest = aggregateRef.current; if (!latest) return;
    const candidateIds = action === "approve" ? classifyProposalConflicts(latest).approvalCandidates.map((item) => item.id) : selectedRejectIds;
    setProposalBusyId("bulk"); setProposalError(null);
    try {
      await flushProposalAutosave();
      const input = { ownerKey, projectId, proposalIds: candidateIds, repository: repositoryFactory() };
      const result = action === "approve" ? await bulkApproveProposals(input) : await bulkRejectProposals(input);
      if (result.aggregate) applyCommittedAggregate(result.aggregate);
      setProposalBulkAction(null); setSelectedRejectIds([]);
      window.requestAnimationFrame(() => { const trigger = proposalBulkTriggerRef.current; if (trigger && !trigger.disabled) trigger.focus(); else document.querySelector<HTMLElement>("#workspace-work-panel h1")?.focus(); });
    } catch { setProposalError("일괄 저장에 실패했습니다. 제안과 확정 설계는 모두 처리 전 상태로 보존했습니다."); }
    finally { setProposalBusyId(null); }
  }

  function cancelGenerationJob(job: BlueprintAggregate["generationJobs"][number]) {
    const latest = aggregateRef.current;
    if (!latest || job.status !== "running") return;
    if (activeTurnCancellationRef.current?.jobId === job.id) {
      activeTurnCancellationRef.current.abort();
      return;
    }
    const now = new Date().toISOString();
    const updated: BlueprintAggregate = {
      ...latest,
      generationJobs: latest.generationJobs.map((item) => item.id === job.id ? { ...item, status: "cancelled", finishedAt: now } : item),
      project: { ...latest.project, updatedAt: now },
    };
    aggregateRef.current = updated;
    setAggregate(updated);
    saverRef.current?.schedule(updated);
  }

  function saveQuestionAnswer(question: CatalogQuestion, answer: { action: "answer" | "unknown" | "recommend" | "defer" | "skip"; selectedValues: string[]; customText: string; numberValue?: number; rangeValue?: { start: number; end: number }; rankedValues?: string[] }, effectiveAnswerMode: CatalogQuestion["answerMode"]) {
    const latest = aggregateRef.current;
    if (!latest || !projectId) return;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const savedAnswer: BlueprintAggregate["answers"][number] = createQuestionAnswerRecord({
      id, projectId, threadId: latest.thread.id, question, answer, effectiveAnswerMode, createdAt: now,
    });
    const updated: BlueprintAggregate = {
      ...latest,
      answers: [...latest.answers, savedAnswer],
      project: { ...latest.project, updatedAt: now },
      thread: { ...latest.thread, updatedAt: now },
    };
    aggregateRef.current = updated;
    setAggregate(updated);
    setReopenedQuestionAnswerId(null);
    saverRef.current?.schedule(updated);
  }

  if (documentType && !documentTypes.has(documentType)) return <NotFoundPage />;
  if (aggregate && (aggregate.project.ownerKey !== ownerKey || aggregate.project.id !== projectId)) return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (loadStatus === 'loading') return <main className="project-route-state" role="status">프로젝트를 불러오는 중입니다.</main>;
  if (loadStatus === 'missing') return <ProjectNotFoundPage />;
  if (loadStatus === 'error' && !aggregate) return (
    <main className="project-route-state project-route-error" role="alert">
      <h1>프로젝트를 불러오지 못했습니다</h1>
      <p>브라우저 저장소에 연결할 수 없습니다. 현재 인증 계정과 저장 공간을 확인해 주세요.</p>
      <button type="button" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>
      <Link to="/">홈으로</Link>
    </main>
  );
  if (!aggregate) return <ProjectNotFoundPage />;

  const compactedConversation = compactConversationContext({ messages: aggregate.messages, summary: aggregate.thread.summary, threshold: 20 });
  const visibleConversationMessages = compactedConversation.compacted ? compactedConversation.originalMessages : aggregate.messages;
  const visibleSummary = compactedConversation.summary ?? aggregate.thread.summary;
  const reopenedAnswer = aggregate.answers.find((answer) => answer.id === reopenedQuestionAnswerId);
  const activeQuestion = reopenedAnswer ? QUESTION_CATALOG.find((question) => question.id === reopenedAnswer.questionId) ?? null : selectNextQuestion(aggregate);
  const designReadiness = computeDesignReadiness(aggregate);
  const currentProjectId = aggregate.project.id;
  const selectedDesignItem = aggregate.designItems.find((item) => item.id === selectedDesignItemId && !item.archivedAt) ?? null;
  const designBoardVisible = documentType === "design" || (documentType === "requirements" && !designReadiness.canGenerateRequirements);

  function openDesignItem(item: BlueprintAggregate["designItems"][number]) {
    setSelectedDesignItemId(item.id);
    setInspectorOpen(true);
  }

  function continueDeciding() {
    selectMode("conversation");
    window.requestAnimationFrame(() => conversationRef.current?.focus());
  }

  function openRequirements() {
    if (designReadiness.canGenerateRequirements) navigate(`/blueprints/${encodeURIComponent(currentProjectId)}/requirements`);
  }

  async function generateRequirementsDraft() {
    const latest = aggregateRef.current;
    if (!ownerKey || !projectId || !latest || requirementsGenerating) return;
    const request = requirementsRequestRef.current ?? (computeDesignReadiness(latest).canGenerateRequirements ? { logicalRequestId:crypto.randomUUID(), snapshot:structuredClone(latest) } : null);
    if (!request) return;
    requirementsRequestRef.current = request;
    setRequirementsGenerating(true);
    setRequirementsError(null);
    const attemptId = crypto.randomUUID();
    try {
      const response = await fetchBlueprintApi('/api/blueprint/documents/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'requirements', projectId: request.snapshot.project.id, designRevision: request.snapshot.project.designRevision,
          logicalRequestId: request.logicalRequestId, attemptId,
          project: { id: request.snapshot.project.id, title: request.snapshot.project.title, designRevision: request.snapshot.project.designRevision },
          designItems: request.snapshot.designItems.map(({ id, type, key, title, description, status, priority, archivedAt, attributes, acceptanceCriteria }) => ({ id, type, key, title, description, status, priority, archivedAt, attributes, acceptanceCriteria: acceptanceCriteria.map(({ id: criterionId, text, status: criterionStatus }) => ({ id: criterionId, text, status: criterionStatus })) })),
          proposals: request.snapshot.proposals.map(({ id, operation, targetType, targetId, before, after, affectedItemIds, status }) => ({ id, operation, targetType, targetId, before, after, affectedItemIds, status })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.error === 'REQUIREMENTS_BLOCKED') throw new Error((payload.blockers ?? []).map((item: { reason?:string }) => item.reason).filter(Boolean).join(' '));
        throw new Error(payload.error === 'AI_BUDGET_EXCEEDED' ? '요청 예산을 초과해 생성하지 못했습니다.' : 'Requirements를 생성하지 못했습니다. 저장된 설계는 유지됩니다. 다시 시도해 주세요.');
      }
      const repository = repositoryFactory();
      const committed = await repository.transact(ownerKey, projectId, (current) => ({ status: 'updated', aggregate: commitRequirementsResult(current, payload, current.project.designRevision) }));
      if (!committed.aggregate) throw new Error('저장 결과를 확인하지 못했습니다. 설계는 보존됐으며 다시 시도할 수 있습니다.');
      requirementsRequestRef.current = null;
      aggregateRef.current = committed.aggregate;
      setAggregate(committed.aggregate);
    } catch (error) {
      setRequirementsError(error instanceof Error ? error.message : 'Requirements를 생성하지 못했습니다. 저장된 설계는 유지됩니다. 다시 시도해 주세요.');
    } finally { setRequirementsGenerating(false); }
  }

  return (
    <main className="workspace-shell" style={{ "--workspace-conversation-width": `${conversationWidth}px` } as CSSProperties} data-mobile-mode={mobileMode}>
      <header className="workspace-appbar">
        <Link to="/" className="workspace-home-link" aria-label="홈으로">⌂</Link>
        <label className="workspace-title-wrap" title={titleDraft}>
          <span className="workspace-sr-only">프로젝트 제목</span>
          <input className="workspace-title-input" value={titleDraft} maxLength={100} aria-invalid={titleInvalid} aria-label="프로젝트 제목" aria-describedby={titleInvalid ? 'project-title-error project-save-state' : 'project-save-state'} onChange={(event) => editTitle(event.target.value)} />
        </label>
        <nav className="workspace-document-nav" aria-label="문서">
          <span id="requirements-gate-reason" className="workspace-sr-only">설계 보드의 준비 상태와 원인을 확인해야 열 수 있습니다.</span>
          {visibleDocumentTypes.map((type) => type === "requirements" && !designReadiness.canGenerateRequirements
            ? <button key={type} type="button" className="is-disabled" disabled aria-describedby="requirements-gate-reason">{documentTypeLabel(type)}</button>
            : <Link key={type} to={`/blueprints/${encodeURIComponent(aggregate.project.id)}/${type}`} aria-current={documentType === type ? "page" : undefined} className={documentType === type ? "is-active" : ""}>{documentTypeLabel(type)}</Link>)}
        </nav>
        <div className="workspace-save-area">
          {titleInvalid ? <span id="project-title-error" className="workspace-title-error" role="alert">프로젝트 제목을 입력해 주세요.</span> : null}
          {saveState.status === "failed" ? <div id="project-save-state" className="workspace-save-state is-failed" role="alert"><span>저장 실패</span><button type="button" onClick={() => { void saverRef.current?.retry(); }}>다시 시도</button></div> : <span id="project-save-state" className={`workspace-save-state is-${saveState.status}`} role="status">{saveState.status === "saving" ? "저장 중" : `저장됨${formatSavedTime(saveState.savedAt ?? aggregate.project.updatedAt) ? ` · ${formatSavedTime(saveState.savedAt ?? aggregate.project.updatedAt)}` : ""}`}</span>}
        </div>
        <button className="workspace-export" type="button" disabled title="내보내기는 다음 단계에서 제공됩니다">내보내기</button>
        <AuthMenu placement="inline" />
      </header>
      <h1 className="workspace-sr-only">{aggregate.project.title}</h1>
      <nav className="workspace-mobile-tabs" role="tablist" aria-label="작업 패널" onKeyDown={(event) => {
        const modes = ["conversation", "work", "review"] as const;
        const current = modes.indexOf(mobileMode);
        let next = current;
        if (event.key === "ArrowRight") next = (current + 1) % modes.length;
        else if (event.key === "ArrowLeft") next = (current + modes.length - 1) % modes.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = modes.length - 1;
        else return;
        event.preventDefault();
        selectMode(modes[next]);
        document.querySelector<HTMLButtonElement>(`[data-mode-tab="${modes[next]}"]`)?.focus();
      }}>
        {([["conversation", "대화"], ["work", documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)], ["review", "검토"]] as const).map(([mode, label]) => <button key={mode} id={`workspace-mode-tab-${mode}`} type="button" role="tab" data-mode-tab={mode} aria-controls={`workspace-${mode}-panel`} aria-selected={mobileMode === mode} tabIndex={mobileMode === mode ? 0 : -1} onClick={() => selectMode(mode)}>{label}</button>)}
      </nav>
      <div className="workspace-panels">
        <section ref={conversationRef} id="workspace-conversation-panel" className="workspace-panel workspace-conversation" role={modeTabsVisible ? "tabpanel" : "region"} aria-labelledby={modeTabsVisible ? "workspace-mode-tab-conversation" : undefined} aria-label={modeTabsVisible ? undefined : "대화"} tabIndex={0}>
          <header className="workspace-panel-heading"><h1>대화</h1><span>초기 아이디어</span></header>
          <div className="workspace-conversation-content">
            {visibleSummary ? <ConversationSummary summary={visibleSummary} /> : null}
            {visibleConversationMessages.filter((message) => message.role !== "user" || message.id !== aggregate.messages.find((item) => item.role === "user")?.id).map((message) => <article key={message.id} className={`workspace-message workspace-message-${message.role}`}><span className="workspace-message-label">{message.role === "assistant" ? "Agent" : message.role === "system" ? "작업 상태" : "나"}</span>{message.blocks ? <DisplayBlocks blocks={message.blocks} questionCatalog={QUESTION_CATALOG} proposalIds={aggregate.proposals.map((proposal) => proposal.id)} onQuestionSubmit={(question,answer,mode)=>saveQuestionAnswer(question,answer,mode)} /> : <p>{message.content}</p>}</article>)}
            {aggregate.generationJobs.filter((job) => job.status === "queued" || job.status === "running").map((job) => <GenerationJobStatus key={job.id} job={job} onCancel={cancelGenerationJob} />)}
            <article className="workspace-first-message"><span className="workspace-message-label">내 아이디어</span><p>{visibleConversationMessages.find((message) => message.role === "user")?.content ?? (compactedConversation.compacted ? "요약 아래에 최근 대화가 표시됩니다." : "아직 대화가 없습니다.")}</p></article>
            <p className="workspace-next-hint">이 대화에서 요구사항을 구체화할 수 있습니다.</p>
            {aggregate.answers.length ? <section className="question-answer-history" aria-label="질문 답변 이력"><h2>이전 답변</h2>{aggregate.answers.map((answer) => {
              const question = QUESTION_CATALOG.find((item) => item.id === answer.questionId);
              const reviewRequired = getAnswerReviewState(aggregate, answer).reviewRequired;
              const value = answer.action === "defer" ? "나중에 결정" : answer.action === "skip" ? "건너뜀" : answer.action === "unknown" ? "잘 모르겠어요 · 설명 요청" : answer.action === "recommend" ? "추천 요청 · 검토 전" : [answer.customText, ...(answer.selectedValues ?? []).map((selected) => question?.options?.find((option) => option.value === selected)?.label ?? selected), answer.numberValue === undefined ? "" : String(answer.numberValue), answer.rangeValue ? `${answer.rangeValue.start}–${answer.rangeValue.end}` : "", ...(answer.rankedValues ?? []).map((ranked) => question?.options?.find((option) => option.value === ranked)?.label ?? ranked)].filter(Boolean).join(", ");
              return <article key={answer.id}><h3>{question?.prompt ?? answer.questionId}</h3><p>{value}</p>{reviewRequired ? <p role="status">선행 답변 변경으로 다시 검토가 필요합니다.</p> : null}{answer.action === "defer" ? <button type="button" onClick={() => setReopenedQuestionAnswerId(answer.id)}>다시 결정</button> : answer.action === "answer" ? <button type="button" onClick={() => setReopenedQuestionAnswerId(answer.id)}>수정</button> : null}</article>;
            })}</section> : null}
            {activeQuestion ? <QuestionCard key={`${activeQuestion.id}-${reopenedQuestionAnswerId ?? "next"}`} question={activeQuestion} onSubmit={(answer, effectiveAnswerMode) => saveQuestionAnswer(activeQuestion, answer, effectiveAnswerMode)} /> : <p className="question-complete-state" role="status">{aggregate.project.readiness.pendingProposalCount ? "제안 검토를 마치면 다음 질문이 이어집니다." : "현재 필요한 질문에 답했습니다."}</p>}
            <AiTurnComposer aggregate={aggregate} projectId={aggregate.project.id} question={activeQuestion} onAggregateChange={applyAggregate} persistAggregate={persistAggregateNow} activeTurnCancellationRef={activeTurnCancellationRef} onQuestionSubmit={saveQuestionAnswer} />
          </div>
        </section>
        <button className="workspace-resizer" type="button" role="separator" aria-orientation="vertical" aria-label="대화 패널 너비" aria-valuemin={320} aria-valuemax={420} aria-valuenow={conversationWidth} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); resizeConversation(conversationWidth - 16); }
          if (event.key === "ArrowRight") { event.preventDefault(); resizeConversation(conversationWidth + 16); }
        }} onPointerDown={(event) => { isResizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (isResizing.current) resizeConversation(event.clientX); }} onPointerUp={() => { isResizing.current = false; }} />
        <section id="workspace-work-panel" className="workspace-panel workspace-work" role={modeTabsVisible ? "tabpanel" : "region"} aria-labelledby={modeTabsVisible ? "workspace-mode-tab-work" : undefined} aria-label={modeTabsVisible ? undefined : "작업 영역"} tabIndex={0}>
          <header className="workspace-panel-heading workspace-work-heading"><div><p className="workspace-eyebrow">{documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)}</p><h1>{documentType === "requirements" ? "요구사항" : documentType === "prd" ? "제품 요구사항 문서" : documentType === "setup_guide" ? "설정 안내" : "설계"}</h1></div><button ref={inspectorTriggerRef} type="button" className="workspace-inspector-trigger" onClick={() => setInspectorOpen(true)}>상세 보기</button></header>
          <div className="workspace-work-content">
            {aggregate.proposals.some((proposal) => proposal.status === "pending") ? <section className="proposal-review" aria-labelledby="proposal-review-title">
              <header className="proposal-review-heading"><div><p className="workspace-eyebrow">검토가 필요한 변경</p><h2 id="proposal-review-title" tabIndex={-1}>제안 {aggregate.proposals.filter((proposal) => proposal.status === "pending").length}개</h2></div><p>승인한 값만 확정 설계에 반영됩니다.</p></header>
              {(() => { const review = classifyProposalConflicts(aggregate); return <div className="proposal-bulk-controls"><p>안전하게 승인 가능 {review.approvalCandidates.length}개 · 제외 {review.excluded.length}개{review.excluded.length ? ` (${review.excluded.map(({proposal,reason}) => `${proposal.id}: ${reason}`).join("; ")})` : ""}</p><button type="button" disabled={!review.approvalCandidates.length || Boolean(proposalBusyId)} onClick={(event) => { proposalBulkTriggerRef.current = event.currentTarget; setProposalBulkAction("approve"); }}>가능한 제안 일괄 승인</button><button type="button" disabled={!selectedRejectIds.length || Boolean(proposalBusyId)} onClick={(event) => { proposalBulkTriggerRef.current = event.currentTarget; setProposalBulkAction("reject"); }}>선택한 제안 일괄 거절 ({selectedRejectIds.length})</button></div>; })()}
              {proposalBulkAction ? <dialog ref={proposalBulkDialogRef} className="proposal-bulk-confirm" aria-labelledby="proposal-bulk-title" onCancel={(event) => { event.preventDefault(); closeBulkDialog(); }}><h3 id="proposal-bulk-title">{proposalBulkAction === "approve" ? "충돌 없는 제안을 승인할까요?" : "선택한 제안을 거절할까요?"}</h3><p>{proposalBulkAction === "approve" ? `${classifyProposalConflicts(aggregate).approvalCandidates.length}개 승인, ${classifyProposalConflicts(aggregate).excluded.length}개 제외` : `${selectedRejectIds.length}개 제안 거절`}. 한 번의 저장 transaction으로 처리합니다.</p>{proposalError ? <p role="alert">{proposalError}</p> : null}<button type="button" onClick={closeBulkDialog}>취소</button><button type="button" disabled={Boolean(proposalBusyId)} onClick={() => void resolveBulk(proposalBulkAction)}>{proposalBulkAction === "approve" ? "승인" : "거절"} 확인</button></dialog> : null}
              {proposalError ? <p className="proposal-review-error" role="alert">{proposalError}</p> : null}
              <ol className="proposal-review-list">{aggregate.proposals.filter((proposal) => proposal.status === "pending").map((proposal, index) => {
                const value = (proposal.after ?? proposal.before ?? {}) as Record<string, unknown>;
                const editing = editingProposalId === proposal.id && proposal.operation !== "delete";
                const isConflict = classifyProposalConflicts(aggregate).conflictIds.includes(proposal.id);
                const conflictComparison = isConflict ? proposalConflictComparison(aggregate, proposal) : null;
                return <li key={proposal.id} className="proposal-review-item" tabIndex={-1} data-proposal-card={proposal.id}>
                  <label className="proposal-bulk-select"><input type="checkbox" checked={selectedRejectIds.includes(proposal.id)} onChange={(event) => setSelectedRejectIds((ids) => event.target.checked ? [...ids, proposal.id] : ids.filter((id) => id !== proposal.id))} /> 일괄 거절 대상으로 선택</label>
                  {isConflict && conflictComparison ? <section className="proposal-conflict" aria-labelledby={`conflict-${proposal.id}`}><h3 id={`conflict-${proposal.id}`}>충돌 검토 · {conflictComparison.targetName}</h3><div className="proposal-diff proposal-conflict-diff"><div><small>제안 작성 당시</small><p>{conflictComparison.before}</p></div><div><small>최신 확정값</small><p>{conflictComparison.current}</p></div><div><small>제안값</small><p>{conflictComparison.proposed}</p></div></div><p><strong>변경 이유</strong> · {proposal.rationale}</p>{proposal.evidence.length ? <div className="proposal-evidence"><strong>근거</strong>{proposal.evidence.map((ref) => <p key={ref.id}>{ref.sourceType === "agent_inference" ? "Agent 추론 · 검토 필요" : ref.excerpt ?? ref.sourceId}</p>)}</div> : null}{proposal.affectedItemIds.length ? <p>영향 항목: {proposal.affectedItemIds.map((id) => aggregate.designItems.find((item) => item.id === id)?.title ?? id).join(" · ")}</p> : null}<fieldset><legend>해결 방법을 선택하세요</legend><label><input type="radio" name={`conflict-${proposal.id}`} checked={conflictChoices[proposal.id] === "keep_current"} onChange={() => setConflictChoices((value) => ({...value,[proposal.id]:"keep_current"}))} /> 기존 값 유지</label><label><input type="radio" name={`conflict-${proposal.id}`} checked={conflictChoices[proposal.id] === "accept_proposed"} onChange={() => setConflictChoices((value) => ({...value,[proposal.id]:"accept_proposed"}))} /> 새 제안 사용</label><label><input type="radio" name={`conflict-${proposal.id}`} checked={conflictChoices[proposal.id] === "edit"} onChange={() => { setConflictChoices((value) => ({...value,[proposal.id]:"edit"})); setProposalEdit({title:String(value.title ?? value.text ?? ""),description:String(value.description ?? value.markdown ?? "")}); }} /> 직접 수정</label></fieldset>{conflictChoices[proposal.id] === "edit" ? <div className="proposal-edit-form"><label>{proposal.targetType === "acceptance_criterion" ? "수용 기준" : proposal.targetType === "document_section" ? "섹션 제목" : "제목"}<input value={proposalEdit.title} onChange={(event)=>setProposalEdit((current)=>({...current,title:event.target.value}))}/></label>{proposal.targetType !== "acceptance_criterion" ? <label>{proposal.targetType === "document_section" ? "문서 내용" : "설명"}<textarea value={proposalEdit.description} onChange={(event)=>setProposalEdit((current)=>({...current,description:event.target.value}))}/></label> : null}</div> : null}<button type="button" disabled={!conflictChoices[proposal.id] || Boolean(proposalBusyId)} onClick={()=>void resolveConflict(proposal.id)}>선택 적용</button></section> : null}
                  <div className="proposal-review-card-heading"><span>제안 {index + 1} · {proposal.operation === "create" ? "추가" : proposal.operation === "update" ? "수정" : "삭제"}</span><span>확정 전</span></div>
                  {proposal.operation === "update" ? <div className="proposal-diff"><div><small>변경 전</small><p>{String((proposal.before as Record<string, unknown> | undefined)?.title ?? (proposal.before as Record<string, unknown> | undefined)?.text ?? "기존 값")}</p></div><div><small>제안값</small><p>{String(value.title ?? value.text ?? "삭제 제안")}</p></div></div> : null}
                  {editing ? <form className="proposal-edit-form" onSubmit={(event) => { event.preventDefault(); void resolveProposal(proposal.id, "edit"); }}>
                    <label>{proposal.targetType === "acceptance_criterion" ? "수용 기준" : proposal.targetType === "document_section" ? "섹션 제목" : "제목"}<input autoFocus value={proposalEdit.title} onChange={(event) => setProposalEdit((current) => ({ ...current, title: event.target.value }))} aria-required={proposal.targetType !== "document_section"} /></label>
                    {proposal.targetType !== "acceptance_criterion" ? <label>{proposal.targetType === "document_section" ? "문서 내용" : "설명"}<textarea value={proposalEdit.description} onChange={(event) => setProposalEdit((current) => ({ ...current, description: event.target.value }))} rows={3} /></label> : null}
                    <div className="proposal-review-actions"><button type="button" onClick={() => setEditingProposalId(null)}>수정 취소</button><button type="submit" disabled={proposalBusyId === proposal.id}>수정값 승인</button></div>
                  </form> : <><h3>{String(value.title ?? value.text ?? "제안된 변경")}</h3><p className="proposal-review-value">{String(value.description ?? value.markdown ?? value.text ?? "")}</p></>}
                  <p className="proposal-review-rationale">{proposal.rationale}</p>
                  <div className="proposal-evidence"><strong>근거</strong>{proposal.evidence.map((ref) => <p key={ref.id}>{ref.sourceType === "agent_inference" ? "Agent 추론 · 검토 필요" : ref.excerpt ?? ref.sourceId}</p>)}</div>
                  {!isConflict ? <div className="proposal-review-actions"><button type="button" disabled={Boolean(proposalBusyId)} onClick={() => void resolveProposal(proposal.id, "reject")}>거절</button>{proposal.operation !== "delete" && !editing ? <button type="button" disabled={Boolean(proposalBusyId)} onClick={() => { setProposalError(null); setEditingProposalId(proposal.id); setProposalEdit({ title: String(value.title ?? value.text ?? ""), description: String(value.description ?? value.markdown ?? "") }); }}>수정 후 승인</button> : null}<button type="button" disabled={Boolean(proposalBusyId) || editing} onClick={() => void resolveProposal(proposal.id, "approve")}>{proposalBusyId === proposal.id ? "저장 중…" : "승인"}</button></div> : null}
                </li>;
              })}</ol>
            </section> : null}
            {designBoardVisible ? <DesignBoard aggregate={aggregate} readiness={designReadiness} selectedItemId={selectedDesignItemId} onSelectItem={openDesignItem} onContinueDeciding={continueDeciding} onOpenRequirements={openRequirements} /> : documentType === 'requirements' ? (() => { const saved = aggregate.documents.filter((document) => document.type === 'requirements').sort((a,b)=>b.version-a.version)[0]; return <RequirementsDocument document={saved} sections={saved ? aggregate.sections.filter((section) => section.documentId === saved.id) : []} generating={requirementsGenerating} error={requirementsError} onGenerate={() => void generateRequirementsDraft()} />; })() : !aggregate.proposals.some((proposal) => proposal.status === "pending") ? <div className="workspace-empty-state"><div className="workspace-empty-mark" aria-hidden="true">✦</div><h2>{documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)} 작업을 시작해 보세요</h2><p>첫 아이디어를 바탕으로 내용을 정리하고 필요한 결정을 이어갈 수 있습니다.</p><span>현재 문서: {documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)}</span></div> : null}
            {aggregate.designItems.some((item) => item.status === "review_required" && !item.archivedAt) ? <section className="proposal-review-required" aria-labelledby="review-required-title"><h2 id="review-required-title">선행 변경으로 재검토가 필요한 항목</h2><ul>{aggregate.designItems.filter((item) => item.status === "review_required" && !item.archivedAt).map((item) => <li key={item.id}><strong>{item.title}</strong><p>{String(item.attributes.reviewRequiredReason ?? "선행 결정 변경으로 확인이 필요합니다.")}</p></li>)}</ul></section> : null}
          </div>
        </section>
      <aside ref={inspectorPanelRef} id="workspace-review-panel" className={`workspace-panel workspace-inspector ${inspectorOpen ? "is-open" : ""}`} aria-label="상세 정보" aria-hidden={!inspectorOpen && inspectorOverlay && mobileMode !== "review"} aria-modal={inspectorOpen && inspectorOverlay ? true : undefined} role={inspectorOpen && inspectorOverlay ? "dialog" : modeTabsVisible && mobileMode === "review" ? "tabpanel" : "complementary"} aria-labelledby={modeTabsVisible && mobileMode === "review" && !inspectorOpen ? "workspace-mode-tab-review" : undefined}>
          <header className="workspace-panel-heading"><h2>프로젝트 상세</h2><button ref={inspectorCloseRef} className="workspace-drawer-close" type="button" aria-label="상세 닫기" onClick={closeInspector}>×</button></header>
          <div className="workspace-inspector-content">{selectedDesignItem ? <div className="design-inspector">
            <p className="workspace-readiness-label">설계 항목 · {designReadiness.blockers.some((blocker) => blocker.key === "conflicts" && blocker.itemIds.includes(selectedDesignItem.id)) ? "충돌" : selectedDesignItem.status === "confirmed" ? "확정" : selectedDesignItem.status === "review_required" ? "재검토 필요" : selectedDesignItem.status === "not_applicable" ? "해당 없음" : selectedDesignItem.status === "deferred" ? "미정 · 오픈 이슈" : "제안 검토"}</p>
            <h3>{selectedDesignItem.title}</h3><p>{selectedDesignItem.description || "설명 없음"}</p>
            <section className="design-inspector-block"><h4>근거</h4>{selectedDesignItem.evidence.length ? selectedDesignItem.evidence.map((evidence) => <p key={evidence.id}>{evidence.excerpt ?? evidence.sourceId}</p>) : <p>연결된 근거가 없습니다.</p>}</section>
            <section className="design-inspector-block"><h4>관련 항목</h4>{selectedDesignItem.relatedItemIds.length ? <ul>{selectedDesignItem.relatedItemIds.map((id) => <li key={id}>{aggregate.designItems.find((item) => item.id === id)?.title ?? id}</li>)}</ul> : <p>연결된 항목이 없습니다.</p>}</section>
            {selectedDesignItem.acceptanceCriteria.length ? <section className="design-inspector-block"><h4>수용 기준</h4><ul>{selectedDesignItem.acceptanceCriteria.map((criterion) => <li key={criterion.id}>{criterion.text} · {criterion.status === "confirmed" ? "확정" : "재검토 필요"}</li>)}</ul></section> : null}
          </div> : <><p className="workspace-readiness-label">진행 상태</p><p className="workspace-readiness-value">{readinessLabel(aggregate.project.readiness.state)}</p><p>확인할 제안 {aggregate.project.readiness.pendingProposalCount}개 · 충돌 {aggregate.project.readiness.conflictCount}개</p><div className="workspace-inspector-next"><strong>다음 단계</strong><p>아이디어를 대화에서 구체화한 뒤 문서 작업을 이어가세요.</p></div></>}
          <button type="button" onClick={closeInspector}>닫기</button></div>
        </aside>
        {inspectorOpen ? <div className="workspace-drawer-backdrop" aria-hidden="true" onClick={closeInspector} /> : null}
      </div>
    </main>
  );
}

function documentTypeLabel(type: string) {
  if (type === "design") return "설계";
  if (type === "requirements") return "Requirements";
  if (type === "prd") return "PRD";
  return "Setup Guide";
}

function readinessLabel(state: string) {
  if (state === "ready") return "문서 준비 완료";
  if (state === "workable") return "작업 진행 가능";
  return "정보 수집 중";
}
