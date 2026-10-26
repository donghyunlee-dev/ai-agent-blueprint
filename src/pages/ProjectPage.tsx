import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { BlueprintAggregate, EvidenceRef, SourceDocument } from "../domain/blueprint/types.js";
import { useAuth } from "../features/auth/AuthProvider";
import { createDebouncedProjectSaver, formatSavedTime } from "../features/projects/projectAutosave.js";
import type { ProjectSaveState } from "../features/projects/projectAutosave.js";
import { getIndexedDbProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import type { ProjectRepository } from "../infrastructure/storage/indexeddb-project-repository.js";
import { setLastProjectId } from "../features/projects/persistProjectCreation.js";
import { clampConversationWidth, clampScrollOffset, getConversationScrollTop, getConversationWidth, setConversationScrollTop, setConversationWidth } from "../features/projects/workspacePreferences.js";
import type { ContextualResponse } from "../components/conversation/ContextualQuestionCard";
import { ConversationWorkspace } from "../components/conversation/ConversationWorkspace";
import { BlueprintStageNav } from "../components/blueprint/BlueprintStageNav";
import type { BlueprintStage } from "../components/blueprint/BlueprintStageNav";
import { GenerationJobStatus } from "../components/conversation/GenerationJobStatus";
import { DisplayBlocks } from "../components/blueprint/display-blocks/DisplayBlocks";
import { compactConversationContext } from "../features/conversation/context-compaction-view.js";
import { AiTurnComposer } from "../components/conversation/AiTurnComposer";
import type { CatalogQuestion } from "../features/conversation/questionEngine.js";
import { createQuestionAnswerRecord, getAnswerReviewState, QUESTION_CATALOG } from "../features/conversation/questionEngine.js";
import { projectDecisionSummary } from "../features/conversation/project-decision-summary.js";
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import { approveProposal, editAndApproveProposal, rejectProposal } from "../features/proposals/proposal-commands.js";
import { bulkApproveProposals, bulkRejectProposals, classifyProposalConflicts, proposalCurrentSnapshot, resolveProposalConflict } from "../features/proposals/dsg-pr-02-commands.js";
import { DesignBoard } from "../features/design/DesignBoard.js";
import { ProposalReviewPanel } from "../components/proposals/ProposalReviewPanel.js";
import { computeDesignReadiness } from "../features/design/readiness.js";
import { RequirementsDocument, RequirementsPageHeader } from "../components/blueprint/RequirementsDocument.js";
import { PrdDocument } from "../components/blueprint/PrdDocument.js";
import { SetupGuideDocument } from "../components/blueprint/SetupGuideDocument.js";
import { commitRequirementsResult } from "../features/documents/requirements-generation.js";
import { assessRequirementsReady, confirmRequirementsReady } from "../features/documents/requirements-ready.js";
import { commitPrdResult, validatePrdAllowed } from "../features/documents/prd-generation.js";
import { commitSetupGuideResult } from "../features/documents/setup-guide-generation.js";
import { setupGuideCompletionBlockers } from "../features/documents/setup-guide-plan-builder.js";
import { approveDocumentPatch, buildDocumentPatchProposals, prepareDocumentPatchApproval, rejectDocumentPatch, validateDocumentPatchOutput } from "../features/documents/document-refinement.js";
import { commitConsistencyReview } from "../features/documents/consistency-review.js";
import { previewDocumentImpact } from "../features/documents/document-impact-preview.js";
import { commitDirectDocumentEdit } from "../features/documents/document-edit-transaction.js";
import { SourceDocuments } from "../components/projects/SourceDocuments.js";
import { fetchBlueprintApi } from "../features/auth/sessionFetch.js";
import "../styles/workspace-shell.css";
import "../styles/proposal-review.css";

const documentTypes = new Set(["design", "requirements", "prd", "setup_guide"]);
const visibleDocumentTypes = ["design", "requirements", "prd", "setup_guide"] as const;
function stableJson(value:unknown):string { if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value as object).sort().map((key)=>`${JSON.stringify(key)}:${stableJson((value as Record<string,unknown>)[key])}`).join(',')}}`;return JSON.stringify(value); }
type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';
type ProjectSaver = ReturnType<typeof createDebouncedProjectSaver<BlueprintAggregate>>;
function formatConflictValue(value: unknown, targetType: BlueprintAggregate["proposals"][number]["targetType"]) {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fields = targetType === "design_item" ? [["항목", "title"], ["설명", "description"]] : targetType === "acceptance_criterion" ? [["수용 기준", "text"]] : [["섹션 제목", "title"], ["문서 내용", "markdown"]];
  const lines = fields.flatMap(([label, key]) => record[key] === undefined || record[key] === null || record[key] === "" ? [] : [`${label}: ${String(record[key])}`]);
  return lines.length ? lines.join(" · ") : "저장된 값 없음";
}

function ConversationAvatar({ role }: { role: "user" | "assistant" }) {
  return <span className={`conversation-avatar conversation-avatar-${role}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d={role === "user" ? "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" : "m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z"} /></svg></span>;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(date);
}

function EvidencePreview({ evidence, sources }: { evidence:EvidenceRef; sources:SourceDocument[] }) {
  if (evidence.sourceType !== "file") return <p key={evidence.id}>{evidence.excerpt ?? evidence.sourceId}</p>;
  const source = sources.find((item) => item.id === evidence.sourceId && !item.archivedAt);
  return <div key={evidence.id} className={`design-evidence-preview${source ? "" : " is-deleted"}`} role={source ? undefined : "status"} aria-label={source ? undefined : "삭제된 자료 근거"}>
    <strong>{source?.fileName ?? "삭제된 자료"}</strong>
    {evidence.excerpt ? <blockquote>{evidence.excerpt}</blockquote> : <p>저장된 인용 발췌가 없습니다.</p>}
    {evidence.location ? <small>{evidence.location}</small> : null}
  </div>;
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

function classifyDesignProposals(aggregate:BlueprintAggregate) {
  return classifyProposalConflicts({...aggregate,proposals:aggregate.proposals.filter((proposal)=>!proposal.documentSnapshot)});
}

export function ProjectPage({ repositoryFactory = getIndexedDbProjectRepository }: { repositoryFactory?: () => ProjectRepository }) {
  const { projectId, documentType } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { ownerKey } = useAuth();
  const [aggregate, setAggregate] = useState<BlueprintAggregate | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveState, setSaveState] = useState<ProjectSaveState>({ status: 'saved', savedAt: null });
  const [reopenedQuestionAnswerId, setReopenedQuestionAnswerId] = useState<string | null>(null);
  const [revealedSourceMessageId, setRevealedSourceMessageId] = useState<string | null>(null);
  const [sourceMessageFocusId, setSourceMessageFocusId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [conversationWidth, setConversationWidthState] = useState(() => getConversationWidth(projectId ?? "") ?? 360);
  const [mobileMode, setMobileMode] = useState<"conversation" | "work" | "review">("work");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedDesignItemId, setSelectedDesignItemId] = useState<string | null>(null);
  const [inspectorOverlay, setInspectorOverlay] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches);
  const modeTabsVisible = false;
  const [mobileLayout, setMobileLayout] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [proposalBusyId, setProposalBusyId] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [requirementsGenerating, setRequirementsGenerating] = useState(false);
  const [requirementsError, setRequirementsError] = useState<string | null>(null);
  const [requirementsReadyError, setRequirementsReadyError] = useState<string | null>(null);
  const [prdGenerating, setPrdGenerating] = useState(false);
  const [prdError, setPrdError] = useState<string | null>(null);
  const [setupGuideGenerating,setSetupGuideGenerating]=useState(false);
  const [setupGuideError,setSetupGuideError]=useState<string|null>(null);
  const [setupGuideReadyError,setSetupGuideReadyError]=useState<string|null>(null);
  const [documentPatchBusy, setDocumentPatchBusy] = useState(false);
  const [documentPatchError, setDocumentPatchError] = useState<string | null>(null);
  const [consistencyReview, setConsistencyReview] = useState<{ status:'not_run'|'loading'|'completed'|'failed'; findings:Record<string,unknown>[]; error?:string } | null>(null);
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
  const contextualSubmitRef = useRef<((response:ContextualResponse)=>Promise<void>)|null>(null);
  const saverRef = useRef<ProjectSaver | null>(null);
  const conversationRef = useRef<HTMLElement | null>(null);
  const conversationContentRef = useRef<HTMLDivElement | null>(null);
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
    setRevealedSourceMessageId(null);
    setSourceMessageFocusId(null);
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
        const conflictCount = classifyDesignProposals(latest).conflictIds.length;
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
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setInspectorOverlay(query.matches);
    const updateMobile = () => setMobileLayout(mobileQuery.matches);
    update();
    updateMobile();
    query.addEventListener("change", update);
    mobileQuery.addEventListener("change", updateMobile);
    return () => { query.removeEventListener("change", update); mobileQuery.removeEventListener("change", updateMobile); };
  }, []);

  useEffect(() => {
    if (!aggregate || loadStatus !== "ready") return;
    if (documentType === "requirements" && !computeDesignReadiness(aggregate).canGenerateRequirements) {
      navigate(`/blueprints/${encodeURIComponent(aggregate.project.id)}/design`, { replace: true });
      return;
    }
    if (documentType && documentType !== aggregate.project.activeDocumentType) {
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
    await flushProposalAutosave();
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

  async function saveDirectDocumentEdit(edit:{documentId:string;sectionId:string;baseVersion:number;baseDesignRevision:number;title:string;markdown:string;excludedImpactIds:string[]}) {
    if (!ownerKey || !projectId) throw new Error('PROJECT_CONTEXT_STALE');
    await flushProposalAutosave();
    const saved = await repositoryFactory().transact(ownerKey,projectId,(latest)=>commitDirectDocumentEdit(latest,edit));
    if (saved.status === 'conflict') {
      const latest = await repositoryFactory().get(ownerKey,projectId);
      if (latest) { aggregateRef.current = latest; setAggregate(latest); }
      return saved as Extract<ReturnType<typeof commitDirectDocumentEdit>,{status:'conflict'}>;
    }
    if (!saved.aggregate) throw new Error('DOCUMENT_EDIT_SAVE_FAILED');
    applyCommittedAggregate(saved.aggregate);
    return {status:'updated' as const};
  }

  async function requestDocumentPatch(targets:{sectionIds:string[];requirementIds:string[]}, documentType:'requirements'|'prd'='requirements') {
    if (!ownerKey || !projectId || documentPatchBusy) return;
    const snapshot = aggregateRef.current;
    const document = snapshot?.documents.find((item)=>item.type===documentType);
    if (!snapshot || !document || (!targets.sectionIds.length && !targets.requirementIds.length)) return;
    setDocumentPatchBusy(true); setDocumentPatchError(null);
    try {
      await flushProposalAutosave();
      const repository = repositoryFactory();
      const latest = await repository.get(ownerKey, projectId);
      const currentDocument = latest?.documents.find((item)=>item.id===document.id);
      if (!latest || !currentDocument || latest.project.designRevision !== snapshot.project.designRevision || currentDocument.version !== document.version) throw new Error('DOCUMENT_REVISION_STALE');
      const targetSections = latest.sections.filter((section)=>section.documentId===document.id && targets.sectionIds.includes(section.id));
      const targetRequirements = (currentDocument.requirements ?? []).filter((requirement)=>targets.requirementIds.includes(requirement.id));
      const sourceIds = new Set([...targetSections.flatMap((section)=>section.sourceItemIds), ...targetRequirements.flatMap((requirement)=>requirement.sourceItemIds)]);
      const request = { projectId, documentId:document.id, designRevision:latest.project.designRevision ?? 0, logicalRequestId:crypto.randomUUID(), attemptId:crypto.randomUUID(), project:{id:projectId,title:latest.project.title,designRevision:latest.project.designRevision ?? 0}, document:currentDocument, sections:latest.sections.filter((section)=>section.documentId===document.id), designItems:latest.designItems.filter((item)=>sourceIds.has(item.id)).map(({id,type,title,description,status,archivedAt})=>({id,type,title,description,status,archivedAt})), targetSectionIds:targets.sectionIds, targetRequirementIds:targets.requirementIds, requestLedgerEntries:latest.requestLedgerEntries, instruction:'' };
      const response = await fetchBlueprintApi('/api/blueprint/documents/patch', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(request) });
      const result = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(result.error ?? 'DOCUMENT_PATCH_FAILED');
      const currentAggregate = await repository.get(ownerKey, projectId);
      if (!currentAggregate) throw new Error('PROJECT_NOT_FOUND');
      const validation = validateDocumentPatchOutput({proposals:result.proposals}, {aggregate:currentAggregate,documentId:document.id,targetSectionIds:targets.sectionIds,targetRequirementIds:targets.requirementIds,designRevision:request.designRevision});
      if (!validation.valid) throw new Error('AI_INVALID_OUTPUT');
      const pending = buildDocumentPatchProposals(currentAggregate, validation.proposals, {documentId:document.id,targetRequirementIds:targets.requirementIds,logicalRequestId:request.logicalRequestId,designRevision:request.designRevision});
      const committed = await repository.transact(ownerKey, projectId, (current) => {
        const freshDocument = current.documents.find((item)=>item.id===document.id);
        if (current.project.designRevision !== request.designRevision || freshDocument?.version !== document.version) throw new Error('DOCUMENT_REVISION_STALE');
        const revalidated = validateDocumentPatchOutput({proposals:result.proposals}, {aggregate:current,documentId:document.id,targetSectionIds:targets.sectionIds,targetRequirementIds:targets.requirementIds,designRevision:request.designRevision});
        if (!revalidated.valid) throw new Error('DOCUMENT_REVISION_STALE');
        const proposals = pending.filter((proposal)=>!current.proposals.some((existing)=>existing.id===proposal.id));
        const at = new Date().toISOString();
        return {status:'updated',aggregate:{...current,proposals:[...current.proposals,...proposals],requestLedgerEntries:[...current.requestLedgerEntries,...(result.requestLedgerEntries??[])],project:{...current.project,processState:'proposal_review',readiness:{...current.project.readiness,pendingProposalCount:current.proposals.filter((proposal)=>proposal.status==='pending').length+proposals.length},updatedAt:at},activityEntries:[...current.activityEntries,...proposals.map((proposal)=>({id:crypto.randomUUID(),projectId,action:'document_patch_proposed',targetType:'document',targetId:document.id,logicalRequestId:request.logicalRequestId,summary:'선택한 문서 대상의 보완 제안을 만들었습니다.',createdAt:at}))]}};
      });
      if (!committed.aggregate) throw new Error('DOCUMENT_PATCH_SAVE_FAILED');
      applyCommittedAggregate(committed.aggregate);
    } catch (error) {
      setDocumentPatchError(error instanceof Error && error.message==='DOCUMENT_REVISION_STALE' ? '요청 중 문서가 바뀌었습니다. 최신 내용을 확인한 뒤 다시 선택해 주세요.' : '보완 제안을 만들지 못했습니다. 현재 문서는 유지됐습니다. 다시 시도해 주세요.');
    } finally { setDocumentPatchBusy(false); }
  }

  async function runConsistencyReview() {
    if (!ownerKey || !projectId || consistencyReview?.status==='loading') return;
    setConsistencyReview({status:'loading',findings:[]});
    try {
      await flushProposalAutosave();
      const repository=repositoryFactory();
      const latest=await repository.get(ownerKey,projectId);
      const requirements=latest?.documents.filter((document)=>document.type==='requirements').sort((a,b)=>b.version-a.version)[0];
      const prd=latest?.documents.filter((document)=>document.type==='prd').sort((a,b)=>b.version-a.version)[0];
      if(!latest||!requirements||!prd)throw new Error('DOCUMENTS_MISSING');
      const revision=latest.project.designRevision??0;
      const logicalRequestId=crypto.randomUUID();
      const response=await fetchBlueprintApi('/api/blueprint/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,designRevision:revision,logicalRequestId,attemptId:crypto.randomUUID(),project:{id:projectId,title:latest.project.title,designRevision:revision},requirementsDocumentId:requirements.id,prdDocumentId:prd.id,documents:[requirements,prd],sections:latest.sections.filter((section)=>[requirements.id,prd.id].includes(section.documentId)),designItems:latest.designItems.filter((item)=>!item.archivedAt).map(({id,type,title,description,status,archivedAt})=>({id,type,title,description,status,archivedAt})),requestLedgerEntries:latest.requestLedgerEntries})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.status!=='completed'||!Array.isArray(result.findings))throw new Error(result.error??'CONSISTENCY_REVIEW_FAILED');
      const fresh=await repository.get(ownerKey,projectId);
      if(!fresh||fresh.project.designRevision!==revision||fresh.documents.find((item)=>item.id===requirements.id)?.version!==requirements.version||fresh.documents.find((item)=>item.id===prd.id)?.version!==prd.version)throw new Error('DOCUMENT_REVISION_STALE');
      const findings=result.findings as Record<string,unknown>[];
      const candidates=findings.filter((finding)=>finding.proposal).map((finding)=>finding.proposal as Record<string,unknown>);
      const proposals=[] as BlueprintAggregate['proposals'];
      for(const proposal of candidates){const section=fresh.sections.find((item)=>item.id===proposal.targetId);if(!section)continue;proposals.push(...buildDocumentPatchProposals(fresh,[proposal],{documentId:section.documentId,logicalRequestId,designRevision:revision}));}
      const committed=await commitConsistencyReview({ownerKey,projectId,repository,designRevision:revision,documentVersions:{[requirements.id]:requirements.version,[prd.id]:prd.version},proposals,requestLedgerEntries:result.requestLedgerEntries??[]});
      if(committed.status==='stale')throw new Error('DOCUMENT_REVISION_STALE');
      if(committed.aggregate)applyCommittedAggregate(committed.aggregate);
      setConsistencyReview({status:'completed',findings});
    }catch(error){setConsistencyReview({status:'failed',findings:[],error:error instanceof Error&&error.message==='DOCUMENTS_MISSING'?'요구사항 명세와 PRD를 모두 만든 뒤 검토할 수 있습니다.':error instanceof Error&&error.message==='DOCUMENT_REVISION_STALE'?'검토 중 문서가 바뀌어 결과와 제안을 저장하지 않았습니다. 최신 문서에서 다시 검토해 주세요.':'정합성 검토를 완료하지 못했습니다. 현재 문서는 유지됐습니다. 다시 시도해 주세요.'});}
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
      const currentProposal = latest.proposals.find((proposal) => proposal.id === proposalId);
      const input = { ownerKey, projectId, proposalId, repository };
      if (currentProposal?.documentSnapshot) {
        if (action === "edit") { setProposalError("문서 보완 제안은 제안 내용을 확인한 뒤 승인하거나 거절해 주세요."); return; }
        let result;
        if (action === "reject") result = await rejectDocumentPatch(input);
        else {
          const targetDocument = latest.documents.find((item)=>item.id===currentProposal.documentSnapshot?.documentId);
          let generationArtifact:string|undefined;
          const approvedAt = new Date().toISOString();
          if (targetDocument?.type === 'requirements') {
            if (!targetDocument.generationArtifact) throw new Error('REQUIREMENTS_ATTESTATION_MISSING');
            const prepared = prepareDocumentPatchApproval(latest, proposalId, approvedAt);
            if (!prepared.aggregate) { if (prepared.status === 'stale') { setProposalError('문서 또는 선택 대상이 바뀌었습니다. 문서 내용은 적용하지 않았습니다. 최신 문서에서 다시 검토해 주세요.'); return; } throw new Error('DOCUMENT_PATCH_APPROVAL_FAILED'); }
            const nextDocument = prepared.aggregate.documents.find((item)=>item.id===targetDocument.id);
            if (!nextDocument) throw new Error('DOCUMENT_PATCH_APPROVAL_FAILED');
            const refresh = await fetchBlueprintApi('/api/blueprint/documents/requirements/ready', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'refresh-attestation',approved:true,projectId,beforeDocument:targetDocument,beforeSections:latest.sections.filter((section)=>section.documentId===targetDocument.id),nextDocument,nextSections:prepared.aggregate.sections.filter((section)=>section.documentId===targetDocument.id),generationArtifact:targetDocument.generationArtifact,proposal:currentProposal,logicalRequestId:currentProposal.logicalRequestId,approvedAt}) });
            const refreshed = await refresh.json().catch(()=>({}));
            if (!refresh.ok || typeof refreshed.generationArtifact !== 'string') throw new Error(refreshed.error ?? 'REQUIREMENTS_ATTESTATION_REFRESH_FAILED');
            generationArtifact = refreshed.generationArtifact;
          }
          result = await approveDocumentPatch({...input,generationArtifact,approvedAt});
        }
        if (result.status === "stale") { setProposalError("문서 또는 선택 대상이 바뀌었습니다. 문서 내용은 적용하지 않았습니다. 최신 문서에서 다시 검토해 주세요."); return; }
        if (result.status === "not_found") throw new Error("PROPOSAL_NOT_FOUND");
        if (result.aggregate) applyCommittedAggregate(result.aggregate);
        setConsistencyReview(null);
        setEditingProposalId(null);
        if (nextProposalId) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-proposal-card="${CSS.escape(nextProposalId)}"]`)?.focus());
        return;
      }
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
    const candidateIds = action === "approve" ? classifyDesignProposals(latest).approvalCandidates.map((item) => item.id) : selectedRejectIds.filter((id)=>!latest.proposals.find((proposal)=>proposal.id===id)?.documentSnapshot);
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

  useEffect(() => {
    if (!sourceMessageFocusId) return;
    const target = document.getElementById(`conversation-message-${sourceMessageFocusId}`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'auto' });
    target.focus({ preventScroll: true });
    setSourceMessageFocusId(null);
  }, [sourceMessageFocusId, revealedSourceMessageId, aggregate?.messages.length]);

  useEffect(() => {
    const content = conversationContentRef.current;
    if (!content) return;
    const frame = window.requestAnimationFrame(() => { content.scrollTop = content.scrollHeight; });
    return () => window.cancelAnimationFrame(frame);
  }, [aggregate?.messages.length]);

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
  const baseVisibleMessages = compactedConversation.compacted ? compactedConversation.originalMessages : aggregate.messages;
  const revealedSourceMessage = compactedConversation.compacted && revealedSourceMessageId && !baseVisibleMessages.some((message) => message.id === revealedSourceMessageId)
    ? aggregate.messages.find((message) => message.id === revealedSourceMessageId)
    : undefined;
  const visibleConversationMessages = baseVisibleMessages;
  const firstVisibleUserMessage = visibleConversationMessages.find((message) => message.role === "user");
  const visibleSummary = projectDecisionSummary(aggregate);
  const reopenedAnswer = aggregate.answers.find((answer) => answer.id === reopenedQuestionAnswerId);
  function navigateToSourceMessage(messageId:string) {
    const target = document.getElementById(`conversation-message-${messageId}`);
    if (target) {
      target.scrollIntoView({block:'center',behavior:'auto'});
      target.focus({preventScroll:true});
      return;
    }
    if (!aggregateRef.current?.messages.some((message) => message.id === messageId)) return;
    setRevealedSourceMessageId(messageId);
    setSourceMessageFocusId(messageId);
  }
  const designReadiness = computeDesignReadiness(aggregate);
  const currentProjectId = aggregate.project.id;
  const selectedDesignItem = aggregate.designItems.find((item) => item.id === selectedDesignItemId && !item.archivedAt) ?? null;
  const proposalStageVisible = documentType === "design" && location.hash === "#proposal-review-title";
  const designBoardVisible = (documentType === "design" && !proposalStageVisible) || (documentType === "requirements" && !designReadiness.canGenerateRequirements);
  const currentStage: BlueprintStage = documentType === "requirements" ? "requirements" : documentType === "prd" || documentType === "setup_guide" ? "prd" : documentType === "design" ? location.hash === "#proposal-review-title" ? "proposal" : "design" : "conversation";
  const prdReady = validatePrdAllowed(aggregate).allowed;
  const requirementsDocument = aggregate.documents.filter((document) => document.type === 'requirements').sort((a,b)=>b.version-a.version)[0];
  const requirementsSections = requirementsDocument ? aggregate.sections.filter((section) => section.documentId === requirementsDocument.id) : [];

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
      const repository = repositoryFactory();
      const current = await repository.get(ownerKey, projectId);
      if (!current || current.project.designRevision !== request.snapshot.project.designRevision) {
        requirementsRequestRef.current = null;
        throw new Error('설계가 변경되어 요구사항 명세를 생성하지 않았습니다. 최신 설계를 다시 확인해 주세요.');
      }
      const response = await fetchBlueprintApi('/api/blueprint/documents/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'requirements', projectId: request.snapshot.project.id, designRevision: request.snapshot.project.designRevision, currentDesignRevision: current.project.designRevision,
          logicalRequestId: request.logicalRequestId, attemptId,
          project: { id: request.snapshot.project.id, title: request.snapshot.project.title, designRevision: request.snapshot.project.designRevision },
          designItems: request.snapshot.designItems.filter((item) => item.type !== 'document_section').map(({ id, type, key, title, description, status, priority, archivedAt, attributes, acceptanceCriteria }) => ({ id, type, key, title, description, status, priority, archivedAt, attributes, acceptanceCriteria: acceptanceCriteria.map(({ id: criterionId, text, status: criterionStatus }) => ({ id: criterionId, text, status: criterionStatus })) })),
          proposals: request.snapshot.proposals.map(({ id, operation, targetType, targetId, before, after, affectedItemIds, status }) => ({ id, operation, targetType, targetId, before, after, affectedItemIds, status })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.error === 'REQUIREMENTS_BLOCKED') throw new Error((payload.blockers ?? []).map((item: { reason?:string }) => item.reason).filter(Boolean).join(' '));
        throw new Error(payload.error === 'AI_BUDGET_EXCEEDED' ? '요청 예산을 초과해 생성하지 못했습니다.' : '요구사항 명세를 생성하지 못했습니다. 저장된 설계는 유지됩니다. 다시 시도해 주세요.');
      }
      const committed = await repository.transact(ownerKey, projectId, (current) => ({ status: 'updated', aggregate: commitRequirementsResult(current, payload, current.project.designRevision) }));
      if (!committed.aggregate) throw new Error('저장 결과를 확인하지 못했습니다. 설계는 보존됐으며 다시 시도할 수 있습니다.');
      requirementsRequestRef.current = null;
      aggregateRef.current = committed.aggregate;
      setAggregate(committed.aggregate);
      saverRef.current?.schedule(committed.aggregate);
    } catch (error) {
      setRequirementsError(error instanceof Error ? error.message : '요구사항 명세를 생성하지 못했습니다. 저장된 설계는 유지됩니다. 다시 시도해 주세요.');
    } finally { setRequirementsGenerating(false); }
  }

  async function markRequirementsReady() {
    const latest = aggregateRef.current;
    if (!ownerKey || !projectId || !latest) return;
    setRequirementsReadyError(null);
    try {
      await saverRef.current?.flush();
      const readyAt = new Date().toISOString();
      const repository = repositoryFactory();
      const current = await repository.get(ownerKey, projectId);
      const requirements = current?.documents.filter((document) => document.type === 'requirements').sort((a,b)=>b.version-a.version)[0];
      if (!current || !requirements?.generationArtifact || current.project.designRevision !== latest.project.designRevision) throw new Error('REQUIREMENTS_READY_STALE');
      const sections = current.sections.filter((section) => section.documentId === requirements.id);
      const confirmedSnapshot = JSON.stringify({ document:requirements, sections });
      const attestationResponse = await fetchBlueprintApi('/api/blueprint/documents/requirements/ready', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ confirmed:true, projectId, designRevision:current.project.designRevision, document:requirements, sections, generationArtifact:requirements.generationArtifact }),
      });
      const attestation = await attestationResponse.json().catch(() => ({}));
      if (!attestationResponse.ok || typeof attestation.readyConfirmationArtifact !== 'string') throw new Error('REQUIREMENTS_READY_ATTESTATION_FAILED');
      const committed = await repository.transact(ownerKey, projectId, (current) => {
        const latestRequirements = current.documents.filter((document) => document.type === 'requirements').sort((a,b) => b.version-a.version)[0];
        if (!latestRequirements) throw new Error('REQUIREMENTS_DOCUMENT_MISSING');
        const latestSections = current.sections.filter((section) => section.documentId === latestRequirements.id);
        if (current.project.designRevision !== latest.project.designRevision || JSON.stringify({ document:latestRequirements, sections:latestSections }) !== confirmedSnapshot) throw new Error('REQUIREMENTS_READY_STALE');
        const updated = confirmRequirementsReady(current, latestRequirements.id, { confirmed:true, designRevision:latest.project.designRevision ?? -1, readyConfirmationArtifact:attestation.readyConfirmationArtifact, readyAt });
        const aggregate:BlueprintAggregate = { ...current, documents:current.documents.map((document)=>document.id===updated.id?updated:document), project:{...current.project,processState:'requirements_ready',updatedAt:readyAt}, activityEntries:[...current.activityEntries,{id:crypto.randomUUID(),projectId:current.project.id,action:'requirements_marked_ready',targetType:'document',targetId:updated.id,summary:`요구사항 명세 검토 완료 · 설계 revision ${updated.readyDesignRevision}`,createdAt:readyAt}] };
        return {status:'updated',aggregate};
      });
      if (!committed.aggregate) throw new Error('REQUIREMENTS_READY_SAVE_FAILED');
      aggregateRef.current = committed.aggregate;
      setAggregate(committed.aggregate);
      saverRef.current?.schedule(committed.aggregate);
    } catch (error) {
      setRequirementsReadyError(error instanceof Error ? '확인 중 설계가 바뀌었거나 저장에 실패했습니다. 최신 요구사항 명세를 다시 확인해 주세요.' : '요구사항 명세를 검토 완료로 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  }

  async function generatePrdDraft() {
    const snapshot = aggregateRef.current;
    if (!ownerKey || !projectId || !snapshot || prdGenerating) return;
    const guard = validatePrdAllowed(snapshot);
    if (!guard.allowed) { setPrdError('PRD를 생성할 수 없습니다. 요구사항 명세를 검토하고 최신 설계 revision에서 검토 완료로 확정해 주세요.'); return; }
    setPrdGenerating(true); setPrdError(null);
    try {
      const repository = repositoryFactory();
      const current = await repository.get(ownerKey, projectId);
      if (!current || current.project.designRevision !== snapshot.project.designRevision) throw new Error('DESIGN_REVISION_MISMATCH');
      const requirements = current.documents.filter((document)=>document.type==='requirements').sort((a,b)=>b.version-a.version)[0];
      if (!requirements) throw new Error('REQUIREMENTS_NOT_READY');
      const response = await fetchBlueprintApi('/api/blueprint/documents/generate', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          documentType:'prd', projectId, designRevision:snapshot.project.designRevision, currentDesignRevision:current.project.designRevision,
          logicalRequestId:crypto.randomUUID(), attemptId:crypto.randomUUID(), project:{id:snapshot.project.id,title:snapshot.project.title,designRevision:snapshot.project.designRevision},
          designItems:snapshot.designItems.filter((item)=>item.type!=='document_section').map(({id,type,key,title,description,status,priority,archivedAt,attributes,acceptanceCriteria})=>({id,type,key,title,description,status,priority,archivedAt,attributes,acceptanceCriteria:acceptanceCriteria.map(({id:criterionId,text,status:criterionStatus})=>({id:criterionId,text,status:criterionStatus}))})),
          documents:[{id:requirements.id,projectId:requirements.projectId,type:'requirements',title:requirements.title,status:requirements.status,designRevision:requirements.designRevision,readyDesignRevision:requirements.readyDesignRevision,version:requirements.version,sectionIds:requirements.sectionIds,requirements:requirements.requirements,openIssues:requirements.openIssues??[],reviewIssues:requirements.reviewIssues??[],createdAt:requirements.createdAt,generationArtifact:requirements.generationArtifact,readyConfirmationArtifact:requirements.readyConfirmationArtifact}],
          sections:current.sections.filter((section)=>section.documentId===requirements.id),generationJobs:current.generationJobs.filter((job)=>job.type==='PRD_DRAFT').map(({id,type,logicalRequestId,status})=>({id,type,logicalRequestId,status})),
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error==='PRD_BLOCKED'?'PRD_BLOCKED':payload.error==='AI_BUDGET_EXCEEDED'?'AI_BUDGET_EXCEEDED':'PRD_GENERATION_FAILED');
      const saved=await repository.transact(ownerKey,projectId,(latest)=>({status:'updated',aggregate:commitPrdResult(latest,payload,latest.project.designRevision)}));
      if(!saved.aggregate) throw new Error('PRD_SAVE_FAILED');
      aggregateRef.current=saved.aggregate;setAggregate(saved.aggregate);saverRef.current?.schedule(saved.aggregate);
    } catch {
      setPrdError('PRD를 생성하지 못했습니다. 요구사항 명세와 설계는 유지됩니다. 검토 완료 상태와 최신 revision을 확인한 뒤 다시 시도해 주세요.');
    } finally { setPrdGenerating(false); }
  }

  async function generateSetupGuideDraft() {
    const snapshot=aggregateRef.current;
    if(!ownerKey||!projectId||!snapshot||setupGuideGenerating)return;
    setSetupGuideGenerating(true);setSetupGuideError(null);
    try {
      const repository=repositoryFactory();const current=await repository.get(ownerKey,projectId);
      if(!current||current.project.designRevision!==snapshot.project.designRevision)throw new Error('DESIGN_REVISION_MISMATCH');
      const response=await fetchBlueprintApi('/api/blueprint/documents/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentType:'setup_guide',projectId,designRevision:snapshot.project.designRevision,currentDesignRevision:current.project.designRevision,logicalRequestId:crypto.randomUUID(),attemptId:crypto.randomUUID(),project:{id:snapshot.project.id,title:snapshot.project.title,designRevision:snapshot.project.designRevision},designItems:snapshot.designItems.filter((item)=>['technical_decision','constraint','requirement','risk','open_issue'].includes(item.type)).map(({id,type,key,title,description,status,archivedAt,attributes,evidence})=>({id,type,key,title,description,status,archivedAt,attributes,evidence:evidence.map(({sourceId,excerpt,location})=>({sourceId,...(excerpt?{excerpt}:{}),...(location?{location}:{})}))})),sources:snapshot.sources.map(({id,extractionStatus,extractedText,archivedAt})=>({id,extractionStatus,...(extractedText?{extractedText}:{}),archivedAt}))})});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error('설정 가이드를 생성하지 못했습니다.');
      const saved=await repository.transact(ownerKey,projectId,(latest)=>({status:'updated',aggregate:commitSetupGuideResult(latest,payload,latest.project.designRevision)}));
      if(!saved.aggregate)throw new Error('SETUP_GUIDE_SAVE_FAILED');aggregateRef.current=saved.aggregate;setAggregate(saved.aggregate);saverRef.current?.schedule(saved.aggregate);
    }catch(error){setSetupGuideError(error instanceof Error?error.message:'설정 가이드를 생성하지 못했습니다.');}finally{setSetupGuideGenerating(false);}
  }

  async function approveSetupGuide() {
    if(!ownerKey||!projectId)return;setSetupGuideReadyError(null);
    try {
      const repository=repositoryFactory();const current=await repository.get(ownerKey,projectId);
      const document=current?.documents.filter((item)=>item.type==='setup_guide').sort((a,b)=>b.version-a.version)[0];
      if(!current)throw new Error('project-missing');if(!document)throw new Error('guide-not-found-before');if(!document.generationArtifact)throw new Error('generation-proof-missing');if(document.designRevision!==current.project.designRevision)throw new Error('revision-mismatch');
      const sections=current.sections.filter((section)=>section.documentId===document.id);
      const response=await fetchBlueprintApi('/api/blueprint/documents/setup-guide/ready',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,projectId,designRevision:current.project.designRevision,document,sections,generationArtifact:document.generationArtifact})});
      const attestation=await response.json().catch(()=>({}));if(!response.ok||typeof attestation.readyConfirmationArtifact!=='string')throw new Error('invalid');
      const readyAt=new Date().toISOString();const saved=await repository.transact(ownerKey,projectId,(latest)=>{const currentGuide=latest.documents.find((item)=>item.id===document.id);const latestSections=latest.sections.filter((section)=>section.documentId===document.id);if(latest.project.designRevision!==document.designRevision)throw new Error('revision-mismatch');if(!currentGuide)throw new Error('transaction-guide-missing');if(stableJson({document:currentGuide,sections:latestSections})!==stableJson({document,sections}))throw new Error('guide-content-mismatch');const updated={...currentGuide,status:'ready' as const,readyDesignRevision:latest.project.designRevision,readyAt,readyConfirmationArtifact:attestation.readyConfirmationArtifact,updatedAt:readyAt};return {status:'updated',aggregate:{...latest,documents:latest.documents.map((item)=>item.id===updated.id?updated:item),activityEntries:[...latest.activityEntries,{id:crypto.randomUUID(),projectId,targetType:'document',targetId:updated.id,action:'setup_guide_marked_ready',summary:`설정 가이드 승인 · design revision ${updated.readyDesignRevision}`,createdAt:readyAt}]}};});
      if(!saved.aggregate)throw new Error('save');aggregateRef.current=saved.aggregate;setAggregate(saved.aggregate);saverRef.current?.schedule(saved.aggregate);
    }catch(error){const message=error instanceof Error?error.message:'';setSetupGuideReadyError(message==='revision-mismatch'?'설계가 변경됐습니다. 최신 가이드로 다시 생성해 주세요.':message==='guide-not-found-before'?'저장된 설정 가이드가 없습니다. 새 가이드를 생성해 주세요.':message==='transaction-guide-missing'?'승인 저장 중 설정 가이드가 사라졌습니다. 최신 상태를 다시 확인해 주세요.':message==='generation-proof-missing'?'생성 확인이 없어 설정 가이드를 승인할 수 없습니다. 다시 생성해 주세요.':message==='project-missing'?'프로젝트를 찾을 수 없습니다.':message==='guide-content-mismatch'?'승인 요청 후 설정 가이드가 변경됐습니다. 최신 내용을 다시 검토해 주세요.':message==='invalid'?'설정 가이드 승인 확인이 유효하지 않습니다. 다시 검토해 주세요.':message==='save'?'설정 가이드를 저장하지 못했습니다. 다시 시도해 주세요.':`설정 가이드를 ready로 저장하지 못했습니다 (${message}).`);}
  }

  async function completeProject() {
    if(!ownerKey||!projectId)return;const saved=await repositoryFactory().transact(ownerKey,projectId,(latest)=>{if(setupGuideCompletionBlockers(latest).length)throw new Error('SETUP_GUIDE_COMPLETION_BLOCKED');return {status:'updated',aggregate:{...latest,project:{...latest.project,status:'completed',updatedAt:new Date().toISOString()}}};});if(saved.aggregate){aggregateRef.current=saved.aggregate;setAggregate(saved.aggregate);saverRef.current?.schedule(saved.aggregate);}
  }

  return (
    <main className="workspace-shell" style={{ "--workspace-conversation-width": `${conversationWidth}px` } as CSSProperties} data-mobile-mode={mobileMode} data-stage={currentStage}>
      <header className="workspace-appbar">
        <Link to="/" className="workspace-home-link" aria-label="홈으로">⌂</Link>
        <label className="workspace-title-wrap" title={titleDraft}>
          <span className="workspace-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z" /></svg></span>
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
          {saveState.status === "failed" ? <div id="project-save-state" className="workspace-save-state is-failed" role="alert"><span>저장 실패</span><button type="button" onClick={() => { void saverRef.current?.retry(); }}>다시 시도</button></div> : <span id="project-save-state" className={`workspace-save-state is-${saveState.status}${saveState.status === "saved" ? " workspace-sr-only" : ""}`} role="status">{saveState.status === "saving" ? "저장 중" : `저장됨${formatSavedTime(saveState.savedAt ?? aggregate.project.updatedAt) ? ` · ${formatSavedTime(saveState.savedAt ?? aggregate.project.updatedAt)}` : ""}`}</span>}
        </div>
        <button className="workspace-export" type="button" disabled title="내보내기는 다음 단계에서 제공됩니다">내보내기</button>
      </header>
      {documentType === 'requirements' ? <RequirementsPageHeader aggregate={aggregate} document={requirementsDocument} sections={requirementsSections} /> : null}
      <BlueprintStageNav projectId={aggregate.project.id} current={currentStage} requirementsReady={designReadiness.canGenerateRequirements} prdReady={prdReady} />
      <span className="workspace-sr-only">{aggregate.project.title}</span>
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
      <div className="workspace-panels" data-stage={currentStage} data-inspector-active={currentStage === "design" ? String(inspectorOpen) : undefined}>
        <ConversationWorkspace summary={visibleSummary} availableMessageIds={aggregate.messages.map((message) => message.id)} onNavigateSource={navigateToSourceMessage}>
        <section ref={conversationRef} id="workspace-conversation-panel" className="workspace-panel workspace-conversation" role={modeTabsVisible ? "tabpanel" : "region"} aria-labelledby={modeTabsVisible ? "workspace-mode-tab-conversation" : undefined} aria-label={modeTabsVisible ? undefined : "대화"}>
          <header className="workspace-panel-heading"><h1>대화</h1><span>초기 아이디어</span></header>
          <div ref={conversationContentRef} className="workspace-conversation-content" role="region" aria-label="대화 기록" tabIndex={0} onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
            const movement = event.key === "PageDown" ? clientHeight * 0.8 : event.key === "PageUp" ? -clientHeight * 0.8 : event.key === "ArrowDown" ? 48 : event.key === "ArrowUp" ? -48 : 0;
            if (movement) { event.preventDefault(); event.currentTarget.scrollBy({ top: movement }); }
            else if (event.key === "Home") { event.preventDefault(); event.currentTarget.scrollTo({ top: 0 }); }
            else if (event.key === "End") { event.preventDefault(); event.currentTarget.scrollTo({ top: scrollHeight }); }
          }}>
            {revealedSourceMessage ? <section className="conversation-source-reveal" aria-label="접힌 대화에서 연 원본 메시지"><p className="conversation-source-reveal-label" role="status">접힌 대화에서 연 원본 메시지</p><div id={`conversation-message-${revealedSourceMessage.id}`} tabIndex={-1} className={`conversation-message-row conversation-message-row-${revealedSourceMessage.role} conversation-source-revealed-row`}>{revealedSourceMessage.role === "assistant" ? <ConversationAvatar role="assistant" /> : null}<article className={`workspace-message workspace-message-${revealedSourceMessage.role}`}><span className="workspace-message-label">{revealedSourceMessage.role === "assistant" ? "Agent" : revealedSourceMessage.role === "system" ? "작업 상태" : "나"}</span><p>{revealedSourceMessage.content}</p></article></div></section> : null}
            <div id={firstVisibleUserMessage ? `conversation-message-${firstVisibleUserMessage.id}` : undefined} tabIndex={firstVisibleUserMessage ? -1 : undefined} className="conversation-message-row conversation-message-row-user"><ConversationAvatar role="user" /><article className="workspace-first-message"><span className="workspace-message-label">내 아이디어</span><p>{firstVisibleUserMessage?.content ?? (compactedConversation.compacted ? "요약 아래에 최근 대화가 표시됩니다." : "아직 대화가 없습니다.")}</p></article>{firstVisibleUserMessage?.createdAt ? <time className="conversation-message-time" dateTime={firstVisibleUserMessage.createdAt}>{formatConversationTime(firstVisibleUserMessage.createdAt)}</time> : null}</div>
            {visibleConversationMessages.filter((message) => message.id !== firstVisibleUserMessage?.id).map((message) => <div id={`conversation-message-${message.id}`} tabIndex={-1} key={message.id} className={`conversation-message-row conversation-message-row-${message.role}`}>
              {message.role === "assistant" ? <ConversationAvatar role="assistant" /> : null}
              <article className={`workspace-message workspace-message-${message.role}`}><span className="workspace-message-label">{message.role === "assistant" ? "Agent" : message.role === "system" ? "작업 상태" : "나"}</span>{message.blocks ? <DisplayBlocks blocks={message.blocks} questionCatalog={QUESTION_CATALOG} proposalIds={aggregate.proposals.map((proposal) => proposal.id)} messages={aggregate.messages} messageId={message.id} onNavigateSource={navigateToSourceMessage} onContextualSubmit={(response)=>void contextualSubmitRef.current?.(response)} onQuestionSubmit={(question,answer,mode)=>saveQuestionAnswer(question,answer,mode)} /> : <p>{message.content}</p>}</article>
              {message.createdAt ? <time className="conversation-message-time" dateTime={message.createdAt}>{formatConversationTime(message.createdAt)}</time> : null}
            </div>)}
            {aggregate.generationJobs.filter((job) => job.status === "queued" || job.status === "running").map((job) => <GenerationJobStatus key={job.id} job={job} onCancel={cancelGenerationJob} />)}
            <p className="workspace-next-hint">이 대화에서 요구사항을 구체화할 수 있습니다.</p>
            {aggregate.answers.length ? <section className="question-answer-history" aria-label="질문 답변 이력"><h2>이전 답변</h2>{aggregate.answers.map((answer) => {
              const question = QUESTION_CATALOG.find((item) => item.id === answer.questionId);
              const reviewRequired = getAnswerReviewState(aggregate, answer).reviewRequired;
              const value = answer.action === "defer" ? "나중에 결정" : answer.action === "skip" ? "건너뜀" : answer.action === "unknown" ? "잘 모르겠어요 · 설명 요청" : answer.action === "recommend" ? "추천 요청 · 검토 전" : [answer.customText, ...(answer.selectedValues ?? []).map((selected) => question?.options?.find((option) => option.value === selected)?.label ?? selected), answer.numberValue === undefined ? "" : String(answer.numberValue), answer.rangeValue ? `${answer.rangeValue.start}–${answer.rangeValue.end}` : "", ...(answer.rankedValues ?? []).map((ranked) => question?.options?.find((option) => option.value === ranked)?.label ?? ranked)].filter(Boolean).join(", ");
              return <article key={answer.id}><h3>{question?.prompt ?? answer.questionId}</h3><p>{value}</p>{reviewRequired ? <p role="status">선행 답변 변경으로 다시 검토가 필요합니다.</p> : null}{answer.action === "defer" ? <button className="question-answer-edit" type="button" onClick={() => setReopenedQuestionAnswerId(answer.id)}>다시 결정</button> : answer.action === "answer" ? <button className="question-answer-edit" type="button" onClick={() => setReopenedQuestionAnswerId(answer.id)}>수정</button> : null}</article>;
            })}</section> : null}
            <p className="question-complete-state" role="status">대화에 답하면 필요한 선택지가 여기 표시됩니다.</p>
            <AiTurnComposer aggregate={aggregate} projectId={aggregate.project.id} onAggregateChange={applyAggregate} persistAggregate={persistAggregateNow} activeTurnCancellationRef={activeTurnCancellationRef} contextualSubmitRef={contextualSubmitRef} />
          </div>
        </section>
        </ConversationWorkspace>
        <button className="workspace-resizer" type="button" role="separator" aria-orientation="vertical" aria-label="대화 패널 너비" aria-valuemin={320} aria-valuemax={420} aria-valuenow={conversationWidth} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); resizeConversation(conversationWidth - 16); }
          if (event.key === "ArrowRight") { event.preventDefault(); resizeConversation(conversationWidth + 16); }
        }} onPointerDown={(event) => { isResizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (isResizing.current) resizeConversation(event.clientX); }} onPointerUp={() => { isResizing.current = false; }} />
        <section id="workspace-work-panel" className="workspace-panel workspace-work" role={modeTabsVisible ? "tabpanel" : "region"} aria-labelledby={modeTabsVisible ? "workspace-mode-tab-work" : undefined} aria-label={modeTabsVisible ? undefined : "작업 영역"} tabIndex={0}>
          {documentType !== "requirements" && documentType !== "prd" ? <header className={`workspace-panel-heading workspace-work-heading${proposalStageVisible ? " is-proposal-stage" : ""}`}><div><p className="workspace-eyebrow">{documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)}</p><h1>{proposalStageVisible ? "제안 검토" : documentType === "setup_guide" ? "설정 안내" : "설계"}</h1></div>{!proposalStageVisible ? <button ref={inspectorTriggerRef} type="button" className="workspace-inspector-trigger" onClick={() => setInspectorOpen(true)}>상세 보기</button> : null}</header> : null}
          <div className="workspace-work-content">
            {proposalStageVisible ? <ProposalReviewPanel aggregate={aggregate}>{aggregate.proposals.some((proposal) => proposal.status === "pending") ? <section className="proposal-review" aria-labelledby="proposal-review-title">
              <header className="proposal-review-heading"><div><p className="workspace-eyebrow">검토가 필요한 변경</p><h2 id="proposal-review-title" tabIndex={-1}>제안 {aggregate.proposals.filter((proposal) => proposal.status === "pending").length}개</h2></div><p>승인한 값만 확정 설계에 반영됩니다.</p></header>
              {(() => { const review = classifyDesignProposals(aggregate); return <div className="proposal-bulk-controls"><p>안전하게 승인 가능 {review.approvalCandidates.length}개 · 제외 {review.excluded.length}개{review.excluded.length ? ` (${review.excluded.map(({proposal,reason}) => `${proposal.id}: ${reason}`).join("; ")})` : ""}</p><button type="button" disabled={!review.approvalCandidates.length || Boolean(proposalBusyId)} onClick={(event) => { proposalBulkTriggerRef.current = event.currentTarget; setProposalBulkAction("approve"); }}>가능한 제안 일괄 승인</button><button type="button" disabled={!selectedRejectIds.length || Boolean(proposalBusyId)} onClick={(event) => { proposalBulkTriggerRef.current = event.currentTarget; setProposalBulkAction("reject"); }}>선택한 제안 일괄 거절 ({selectedRejectIds.length})</button></div>; })()}
              {proposalBulkAction ? <dialog ref={proposalBulkDialogRef} className="proposal-bulk-confirm" aria-labelledby="proposal-bulk-title" onCancel={(event) => { event.preventDefault(); closeBulkDialog(); }}><h3 id="proposal-bulk-title">{proposalBulkAction === "approve" ? "충돌 없는 제안을 승인할까요?" : "선택한 제안을 거절할까요?"}</h3><p>{proposalBulkAction === "approve" ? `${classifyDesignProposals(aggregate).approvalCandidates.length}개 승인, ${classifyDesignProposals(aggregate).excluded.length}개 제외` : `${selectedRejectIds.length}개 제안 거절`}. 한 번의 저장 transaction으로 처리합니다.</p>{proposalError ? <p role="alert">{proposalError}</p> : null}<button type="button" onClick={closeBulkDialog}>취소</button><button type="button" disabled={Boolean(proposalBusyId)} onClick={() => void resolveBulk(proposalBulkAction)}>{proposalBulkAction === "approve" ? "승인" : "거절"} 확인</button></dialog> : null}
              {proposalError ? <p className="proposal-review-error" role="alert">{proposalError}</p> : null}
              <ol className="proposal-review-list">{aggregate.proposals.filter((proposal) => proposal.status === "pending").map((proposal, index) => {
                const value = (proposal.after ?? proposal.before ?? {}) as Record<string, unknown>;
                const editing = editingProposalId === proposal.id && proposal.operation !== "delete";
                const isConflict = proposal.documentSnapshot ? false : classifyDesignProposals(aggregate).conflictIds.includes(proposal.id);
                const conflictComparison = isConflict ? proposalConflictComparison(aggregate, proposal) : null;
                return <li key={proposal.id} className="proposal-review-item" tabIndex={-1} data-proposal-card={proposal.id}>
                  <label className="proposal-bulk-select"><input type="checkbox" disabled={Boolean(proposal.documentSnapshot)} checked={selectedRejectIds.includes(proposal.id)} onChange={(event) => setSelectedRejectIds((ids) => event.target.checked ? [...ids, proposal.id] : ids.filter((id) => id !== proposal.id))} /> {proposal.documentSnapshot ? "문서 제안은 개별 처리" : "일괄 거절 대상으로 선택"}</label>
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
            </ProposalReviewPanel> : null}
            {!proposalStageVisible && designBoardVisible ? <DesignBoard aggregate={aggregate} readiness={designReadiness} selectedItemId={selectedDesignItemId} onSelectItem={openDesignItem} onContinueDeciding={continueDeciding} onOpenRequirements={openRequirements} /> : documentType === 'requirements' ? (() => { const saved = requirementsDocument; const readySummary=saved?assessRequirementsReady(aggregate,saved):undefined; return <RequirementsDocument aggregate={aggregate} document={saved} sections={requirementsSections} generating={requirementsGenerating} error={requirementsError} readySummary={readySummary} readyError={requirementsReadyError} patching={documentPatchBusy} patchError={documentPatchError} impactPreview={(targets)=>saved?previewDocumentImpact(aggregate,saved.id,targets):{targetIds:[],itemIds:[],documentIds:[]}} onRequestPatch={(targets)=>requestDocumentPatch(targets,'requirements')} onDirectEdit={saveDirectDocumentEdit} onGenerate={() => void generateRequirementsDraft()} onMarkReady={() => void markRequirementsReady()} onOpenPrd={() => navigate(`/blueprints/${encodeURIComponent(aggregate.project.id)}/prd`)} />; })() : documentType === 'prd' ? (() => { const saved = aggregate.documents.filter((item) => item.type === 'prd').sort((a,b)=>b.version-a.version)[0]; const sections = saved ? aggregate.sections.filter((section) => section.documentId === saved.id) : []; return <PrdDocument aggregate={aggregate} document={saved} sections={sections} generating={prdGenerating} error={prdError} patching={documentPatchBusy} patchError={documentPatchError} impactPreview={(targets)=>saved?previewDocumentImpact(aggregate,saved.id,targets):{targetIds:[],itemIds:[],documentIds:[]}} onRequestPatch={(targets)=>requestDocumentPatch(targets,'prd')} onDirectEdit={saveDirectDocumentEdit} onGenerate={() => void generatePrdDraft()} />; })() : documentType==='setup_guide'? (()=>{const saved=aggregate.documents.filter((item)=>item.type==='setup_guide').sort((a,b)=>b.version-a.version)[0];return <SetupGuideDocument aggregate={aggregate} document={saved} sections={saved?aggregate.sections.filter((section)=>section.documentId===saved.id):[]} generating={setupGuideGenerating} error={setupGuideError} readyError={setupGuideReadyError} onGenerate={()=>void generateSetupGuideDraft()} onApprove={()=>void approveSetupGuide()} onComplete={()=>void completeProject()}/>;})():null}
            {documentType === 'design' && !proposalStageVisible ? <SourceDocuments aggregate={aggregate} repository={repositoryFactory()} onAggregate={applyCommittedAggregate} beforeMutation={flushProposalAutosave} initialMessage={(location.state as { sourceNotice?: string } | null)?.sourceNotice ?? ''} /> : null}
            {!proposalStageVisible && documentType !== 'design' ? <details className="document-support-flows">
              <summary>자료와 정합성 지원</summary>
              <SourceDocuments aggregate={aggregate} repository={repositoryFactory()} onAggregate={applyCommittedAggregate} beforeMutation={flushProposalAutosave} initialMessage={(location.state as { sourceNotice?: string } | null)?.sourceNotice ?? ''} />
              {['requirements','prd'].includes(documentType??'')&&aggregate.documents.some((document)=>document.type==='requirements')&&aggregate.documents.some((document)=>document.type==='prd')?<section className="requirements-ready-review" aria-labelledby="consistency-review-title"><h2 id="consistency-review-title">요구사항 명세 · PRD 정합성</h2><p>확정 설계와 두 문서의 목표, 범위, 근거와 최신 상태를 비교합니다. 결과는 검토용이며 자동 수정하지 않습니다.</p><button type="button" disabled={consistencyReview?.status==='loading'} onClick={()=>void runConsistencyReview()}>{consistencyReview?.status==='loading'?'문서 정합성 검토 중…':'문서 정합성 검토'}</button>{consistencyReview?.status==='failed'?<p role="alert">{consistencyReview.error}</p>:null}{consistencyReview?.status==='completed'?consistencyReview.findings.length?<ol aria-label="정합성 검토 결과">{consistencyReview.findings.map((finding,index)=><li key={`${String(finding.type)}-${index}`}><strong>{String(finding.severity==='error'?'필수 확인':'확인 권장')} · {String(finding.type)}</strong><p>{String(finding.location)} · 관련 항목: {((finding.sourceItemIds as string[])??[]).join(', ')}</p><p>{String(finding.nextAction)}</p>{finding.proposal?<p>수정 제안을 생성했습니다. 제안 목록에서 승인하거나 거절할 수 있습니다.</p>:null}</li>)}</ol>:<p role="status">정합성 검토 완료 · 발견 사항 0개</p>:null}</section>:null}
            </details> : null}
            {!proposalStageVisible && aggregate.designItems.some((item) => item.status === "review_required" && !item.archivedAt) ? <section className="proposal-review-required" aria-labelledby="review-required-title"><h2 id="review-required-title">선행 변경으로 재검토가 필요한 항목</h2><ul>{aggregate.designItems.filter((item) => item.status === "review_required" && !item.archivedAt).map((item) => <li key={item.id}><strong>{item.title}</strong><p>{String(item.attributes.reviewRequiredReason ?? "선행 결정 변경으로 확인이 필요합니다.")}</p></li>)}</ul></section> : null}
          </div>
        </section>
      <aside ref={inspectorPanelRef} id="workspace-review-panel" className={`workspace-panel workspace-inspector ${inspectorOpen ? "is-open" : ""}`} aria-label="상세 정보" aria-hidden={!inspectorOpen && inspectorOverlay && mobileMode !== "review"} aria-modal={inspectorOpen && inspectorOverlay ? true : undefined} role={inspectorOpen && inspectorOverlay ? "dialog" : modeTabsVisible && mobileMode === "review" ? "tabpanel" : "complementary"} aria-labelledby={modeTabsVisible && mobileMode === "review" && !inspectorOpen ? "workspace-mode-tab-review" : undefined}>
          <header className="workspace-panel-heading"><h2>프로젝트 상세</h2><button ref={inspectorCloseRef} className="workspace-drawer-close" type="button" aria-label="상세 닫기" onClick={closeInspector}>×</button></header>
          <div className="workspace-inspector-content">{selectedDesignItem ? <div className="design-inspector">
            <p className="workspace-readiness-label">설계 항목 · {designReadiness.blockers.some((blocker) => blocker.key === "conflicts" && blocker.itemIds.includes(selectedDesignItem.id)) ? "충돌" : selectedDesignItem.status === "confirmed" ? "확정" : selectedDesignItem.status === "review_required" ? "재검토 필요" : selectedDesignItem.status === "not_applicable" ? "해당 없음" : selectedDesignItem.status === "deferred" ? "미정 · 오픈 이슈" : "제안 검토"}</p>
            <h3>{selectedDesignItem.title}</h3><p>{selectedDesignItem.description || "설명 없음"}</p>
            <section className="design-inspector-block"><h4>근거</h4>{selectedDesignItem.evidence.length ? selectedDesignItem.evidence.map((evidence) => <EvidencePreview key={evidence.id} evidence={evidence} sources={aggregate.sources} />) : <p>연결된 근거가 없습니다.</p>}</section>
            <section className="design-inspector-block"><h4>관련 항목</h4>{selectedDesignItem.relatedItemIds.length ? <ul>{selectedDesignItem.relatedItemIds.map((id) => <li key={id}>{aggregate.designItems.find((item) => item.id === id)?.title ?? id}</li>)}</ul> : <p>연결된 항목이 없습니다.</p>}</section>
            {selectedDesignItem.acceptanceCriteria.length ? <section className="design-inspector-block"><h4>수용 기준</h4><ul>{selectedDesignItem.acceptanceCriteria.map((criterion) => <li key={criterion.id}>{criterion.text} · {criterion.status === "confirmed" ? "확정" : "재검토 필요"}{criterion.evidence.length ? <div className="design-criterion-evidence" aria-label={`${criterion.text} 근거`}>{criterion.evidence.map((evidence) => <EvidencePreview key={evidence.id} evidence={evidence} sources={aggregate.sources} />)}</div> : null}</li>)}</ul></section> : null}
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
  if (type === "requirements") return "요구사항 명세";
  if (type === "prd") return "PRD";
  if (type === "setup_guide") return "설정 가이드";
  return "문서";
}

function readinessLabel(state: string) {
  if (state === "ready") return "문서 준비 완료";
  if (state === "workable") return "작업 진행 가능";
  return "정보 수집 중";
}
