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
import { NotFoundPage } from "./NotFoundPage";
import { ProjectNotFoundPage } from "./ProjectNotFoundPage";
import "../styles/workspace-shell.css";

const documentTypes = new Set(["design", "requirements", "prd", "setup_guide"]);
const visibleDocumentTypes = ["design", "requirements", "prd"] as const;
type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';
type ProjectSaver = ReturnType<typeof createDebouncedProjectSaver<BlueprintAggregate>>;

export function ProjectPage({ repositoryFactory = getIndexedDbProjectRepository }: { repositoryFactory?: () => ProjectRepository }) {
  const { projectId, documentType } = useParams();
  const navigate = useNavigate();
  const { ownerKey } = useAuth();
  const [aggregate, setAggregate] = useState<BlueprintAggregate | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleInvalid, setTitleInvalid] = useState(false);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveState, setSaveState] = useState<ProjectSaveState>({ status: 'saved', savedAt: null });
  const [attempt, setAttempt] = useState(0);
  const [conversationWidth, setConversationWidthState] = useState(() => getConversationWidth(projectId ?? "") ?? 360);
  const [mobileMode, setMobileMode] = useState<"conversation" | "work" | "review">("work");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorOverlay, setInspectorOverlay] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches);
  const [modeTabsVisible, setModeTabsVisible] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches);
  const [mobileLayout, setMobileLayout] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const operationGeneration = useRef(0);
  const ownerRef = useRef(ownerKey);
  const projectIdRef = useRef(projectId);
  const attemptRef = useRef(attempt);
  const saverRef = useRef<ProjectSaver | null>(null);
  const conversationRef = useRef<HTMLElement | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorCloseRef = useRef<HTMLButtonElement | null>(null);
  const isResizing = useRef(false);
  ownerRef.current = ownerKey;
  projectIdRef.current = projectId;
  attemptRef.current = attempt;

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
    void repository.get(activeOwner, activeProjectId).then((result) => {
      if (!isCurrent()) return;
      if (!result) { setAggregate(null); setLoadStatus('missing'); return; }
      if (result.project.ownerKey !== activeOwner || result.project.id !== activeProjectId) {
        setAggregate(null);
        setLoadStatus('missing');
        return;
      }

      result.project.lastOpenedAt = new Date().toISOString();
      setLastProjectId(result.project.id);
      setAggregate(result);
      setTitleDraft(result.project.title);
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
      saver.schedule(result);
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
  }

  function editTitle(value: string) {
    setTitleDraft(value);
    if (!aggregate || !value.trim()) { setTitleInvalid(true); return; }
    setTitleInvalid(false);
    const updated: BlueprintAggregate = {
      ...aggregate,
      project: { ...aggregate.project, title: value, updatedAt: new Date().toISOString() },
    };
    setAggregate(updated);
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

  return (
    <main className="workspace-shell" style={{ "--workspace-conversation-width": `${conversationWidth}px` } as CSSProperties} data-mobile-mode={mobileMode}>
      <header className="workspace-appbar">
        <Link to="/" className="workspace-home-link" aria-label="홈으로">⌂</Link>
        <label className="workspace-title-wrap" title={titleDraft}>
          <span className="workspace-sr-only">프로젝트 제목</span>
          <input className="workspace-title-input" value={titleDraft} maxLength={100} aria-invalid={titleInvalid} aria-label="프로젝트 제목" aria-describedby={titleInvalid ? 'project-title-error project-save-state' : 'project-save-state'} onChange={(event) => editTitle(event.target.value)} />
        </label>
        <nav className="workspace-document-nav" aria-label="문서">
          {visibleDocumentTypes.map((type) => <Link key={type} to={`/blueprints/${encodeURIComponent(aggregate.project.id)}/${type}`} aria-current={documentType === type ? "page" : undefined} className={documentType === type ? "is-active" : ""}>{documentTypeLabel(type)}</Link>)}
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
            <article className="workspace-first-message"><span className="workspace-message-label">내 아이디어</span><p>{aggregate.messages.find((message) => message.role === "user")?.content ?? "아직 대화가 없습니다."}</p></article>
            <p className="workspace-next-hint">이 대화에서 요구사항을 구체화할 수 있습니다.</p>
          </div>
        </section>
        <button className="workspace-resizer" type="button" role="separator" aria-orientation="vertical" aria-label="대화 패널 너비" aria-valuemin={320} aria-valuemax={420} aria-valuenow={conversationWidth} onKeyDown={(event) => {
          if (event.key === "ArrowLeft") { event.preventDefault(); resizeConversation(conversationWidth - 16); }
          if (event.key === "ArrowRight") { event.preventDefault(); resizeConversation(conversationWidth + 16); }
        }} onPointerDown={(event) => { isResizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (isResizing.current) resizeConversation(event.clientX); }} onPointerUp={() => { isResizing.current = false; }} />
        <section id="workspace-work-panel" className="workspace-panel workspace-work" role={modeTabsVisible ? "tabpanel" : "region"} aria-labelledby={modeTabsVisible ? "workspace-mode-tab-work" : undefined} aria-label={modeTabsVisible ? undefined : "작업 영역"} tabIndex={0}>
          <header className="workspace-panel-heading workspace-work-heading"><div><p className="workspace-eyebrow">{documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)}</p><h1>{documentType === "requirements" ? "요구사항" : documentType === "prd" ? "제품 요구사항 문서" : documentType === "setup_guide" ? "설정 안내" : "설계"}</h1></div><button ref={inspectorTriggerRef} type="button" className="workspace-inspector-trigger" onClick={() => setInspectorOpen(true)}>상세 보기</button></header>
          <div className="workspace-work-content">
            <div className="workspace-empty-state"><div className="workspace-empty-mark" aria-hidden="true">✦</div><h2>{documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)} 작업을 시작해 보세요</h2><p>첫 아이디어를 바탕으로 내용을 정리하고 필요한 결정을 이어갈 수 있습니다.</p><span>현재 문서: {documentTypeLabel(documentType ?? aggregate.project.activeDocumentType)}</span></div>
          </div>
        </section>
        <aside id="workspace-review-panel" className={`workspace-panel workspace-inspector ${inspectorOpen ? "is-open" : ""}`} aria-label="상세 정보" aria-hidden={!inspectorOpen && inspectorOverlay && mobileMode !== "review"} aria-modal={inspectorOpen && inspectorOverlay ? true : undefined} role={inspectorOpen && inspectorOverlay ? "dialog" : modeTabsVisible && mobileMode === "review" ? "tabpanel" : "complementary"} aria-labelledby={modeTabsVisible && mobileMode === "review" && !inspectorOpen ? "workspace-mode-tab-review" : undefined}>
          <header className="workspace-panel-heading"><h2>프로젝트 상세</h2><button ref={inspectorCloseRef} className="workspace-drawer-close" type="button" aria-label="상세 닫기" onClick={closeInspector}>×</button></header>
          <div className="workspace-inspector-content"><p className="workspace-readiness-label">진행 상태</p><p className="workspace-readiness-value">{readinessLabel(aggregate.project.readiness.state)}</p><p>확인할 제안 {aggregate.project.readiness.pendingProposalCount}개 · 충돌 {aggregate.project.readiness.conflictCount}개</p><div className="workspace-inspector-next"><strong>다음 단계</strong><p>아이디어를 대화에서 구체화한 뒤 문서 작업을 이어가세요.</p></div><button type="button" onClick={closeInspector}>닫기</button></div>
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
