import { useEffect, useRef, useState } from 'react';
import type { GeneratedDocument, DocumentSection } from '../../domain/blueprint/types.js';
import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
import { DocumentSectionEditor } from './DocumentSectionEditor.js';
import '../../styles/blueprint-workspace.css';

type Requirement = NonNullable<GeneratedDocument['requirements']>[number];
type ReadySummary = { eligible:boolean; blockers:string[]; p0RequirementCount:number; acceptanceCriteriaCount:number; openIssueCount:number; designRevision:number|null };
type Props = { aggregate:BlueprintAggregate; document?:GeneratedDocument; sections:DocumentSection[]; generating:boolean; error?:string|null; readySummary?:ReadySummary; readyError?:string|null; patching?:boolean; patchError?:string|null; impactPreview?:(targets:{sectionIds:string[];requirementIds:string[]})=>{targetIds:string[];itemIds:string[];documentIds:string[]}; onRequestPatch?:(targets:{sectionIds:string[];requirementIds:string[]})=>void; onDirectEdit:(edit:{documentId:string;sectionId:string;baseVersion:number;baseDesignRevision:number;title:string;markdown:string;excludedImpactIds:string[]})=>Promise<{status:'updated'}|{status:'conflict';latest:{title:string;markdown:string;version:number;designRevision:number};draft:{title:string;markdown:string}}> ; onGenerate:()=>void; onMarkReady?:()=>void; onOpenPrd?:()=>void };

function ImpactSummary({preview}:{preview:{targetIds:string[];itemIds:string[];documentIds:string[]}}) {
  return <div className="document-impact-preview" aria-label="변경 대상과 예상 영향"><strong>변경 대상과 예상 영향</strong><dl><dt>선택 대상 ID</dt><dd>{preview.targetIds.join(', ')||'없음'}</dd><dt>연결 설계 항목 ID</dt><dd>{preview.itemIds.join(', ')||'없음'}</dd><dt>영향 문서 ID</dt><dd>{preview.documentIds.join(', ')||'없음'}</dd></dl></div>;
}

function blockerMessage(code:string) {
  const sectionNames:Record<string,string>={overview:'제품 개요',functional:'기능 요구사항',non_functional:'비기능 요구사항',data:'데이터 요구사항',integration:'연동 요구사항',permissions:'권한과 보안',exceptions:'예외 처리',deployment:'배포 요구사항',operations:'운영 요구사항',exclusions:'제외 범위',open_issues:'오픈 이슈'};
  if(code.startsWith('REQUIREMENTS_SECTION_MISSING:')) return `필수 ${sectionNames[code.split(':')[1]]??'문서'} 섹션이 없습니다.`;
  if(code.startsWith('P0_ACCEPTANCE_CRITERION_MISSING:')) return `P0 요구사항 ${code.split(':')[1]}에 관찰 가능한 수용 기준이 필요합니다.`;
  if(code.startsWith('REQUIREMENTS_SECTION_STALE:')) return `${sectionNames[code.split(':')[1]]??'문서'} 섹션이 설계 변경으로 오래됐습니다. 최신 근거로 다시 확인해 주세요.`;
  if(code.startsWith('REQUIREMENTS_SECTION_CONFLICT:')) return `${sectionNames[code.split(':')[1]]??'문서'} 섹션에 설계와 충돌이 있습니다. 충돌을 먼저 해결해 주세요.`;
  if(code==='REQUIREMENTS_REVIEW_ISSUES_UNRESOLVED') return '남은 검토 문제를 먼저 해결해 주세요.';
  if(code==='REQUIREMENTS_DESIGN_REVISION_MISMATCH') return 'Requirements와 현재 설계 revision이 다릅니다. 최신 설계에서 다시 생성해 주세요.';
  if(code==='REQUIREMENTS_NOT_REVIEWABLE') return '현재 문서 상태에서는 Requirements를 ready로 확정할 수 없습니다.';
  if(code==='REQUIREMENTS_DOCUMENT_MISSING') return '먼저 Requirements 문서를 생성해 주세요.';
  return code;
}

export function RequirementsDocument({ aggregate, document, sections, generating, error, readySummary, readyError, patching=false, patchError, impactPreview, onRequestPatch, onDirectEdit, onGenerate, onMarkReady, onOpenPrd }:Props) {
  const [selectedKey, setSelectedKey] = useState(sections[0]?.key ?? 'overview');
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>([]);
  const [sectionTargetSelected, setSectionTargetSelected] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const readyTriggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const currentSections = [...sections].sort((a,b)=>a.order-b.order);
  const selected = currentSections.find((section)=>section.key===selectedKey) ?? currentSections[0];
  const requirements = (document?.requirements ?? []).filter((item)=>selected?.sourceItemIds.some((id)=>item.sourceItemIds.includes(id)));
  const issueCount = document?.reviewIssues?.length ?? 0;
  const wasOpen = useRef(false);
  useEffect(()=>{
    if (!contentsOpen) {
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    closeRef.current?.focus();
    const onKey = (event:KeyboardEvent) => {
      if (event.key==='Escape') { setContentsOpen(false); return; }
      if (event.key !== 'Tab') return;
      const drawer = window.document.querySelector<HTMLElement>('.requirements-contents.is-open');
      const controls = drawer ? [...drawer.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')].filter((element)=>element.offsetParent!==null) : [];
      if (!controls.length) return;
      if (event.shiftKey && window.document.activeElement===controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && window.document.activeElement===controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    window.document.addEventListener('keydown',onKey);
    return ()=>window.document.removeEventListener('keydown',onKey);
  },[contentsOpen]);
  function select(key:string) { setSelectedKey(key); setSelectedRequirementIds([]); setSectionTargetSelected(false); setContentsOpen(false); }
  return <section className="requirements-document" aria-labelledby="requirements-document-title">
    <header className="requirements-document-header">
      <div><p className="workspace-eyebrow">문서 · {document ? `rev. ${document.designRevision} · ${document.status === 'review_required' ? '검토 필요' : document.status}` : '초안'}</p><h2 id="requirements-document-title">Requirements</h2></div>
      {document ? <span role="status">사용자 검토 전</span> : null}
    </header>
    {generating ? <div className="requirements-generation-status" role="status" aria-live="polite"><strong>Requirements를 만들고 있습니다</strong><ol><li>설계 계획 검증</li><li>요구사항 작성</li><li>품질 검토</li></ol><p>현재 설계와 기존 문서는 생성이 끝날 때까지 유지됩니다.</p></div> : null}
    {error ? <div className="requirements-generation-error" role="alert"><p>{error}</p><button type="button" onClick={onGenerate}>같은 요청 다시 시도</button></div> : null}
    {!document && !generating ? <div className="requirements-empty-state"><h3>확정된 설계에서 Requirements를 만들 수 있습니다</h3><p>생성된 문서는 자동으로 완료 처리되지 않으며, 근거와 수용 기준을 직접 검토할 수 있습니다.</p><button type="button" className="design-requirements-action is-primary" onClick={onGenerate}>Requirements 생성</button></div> : null}
    {document ? <>
      <div className="requirements-document-layout">
        <aside className={`requirements-contents ${contentsOpen ? 'is-open' : ''}`} aria-label="문서 목차">
          <header><strong>목차</strong><button ref={closeRef} type="button" className="requirements-contents-close" onClick={()=>setContentsOpen(false)}>닫기</button></header>
          <nav>{currentSections.map((section)=><button key={section.id} type="button" aria-current={selected?.id===section.id?'location':undefined} onClick={()=>select(section.key)}>{section.title}</button>)}</nav>
        </aside>
        {contentsOpen ? <button className="requirements-contents-backdrop" aria-label="목차 닫기" onClick={()=>setContentsOpen(false)} /> : null}
        <div className="requirements-content-main">
          <button ref={triggerRef} type="button" className="requirements-contents-trigger" aria-expanded={contentsOpen} onClick={()=>setContentsOpen(true)}>목차 열기</button>
          {selected ? <article aria-labelledby="requirements-section-title"><p className="workspace-eyebrow">섹션 {selected.order+1} / {currentSections.length}</p><h3 id="requirements-section-title">{selected.title}</h3>{selected.markdown ? <p className="requirements-section-copy">{selected.markdown}</p> : null}{document?<DocumentSectionEditor aggregate={aggregate} document={document} section={selected} onSave={onDirectEdit}/>:null}
            <label><input type="checkbox" checked={sectionTargetSelected} onChange={(event)=>setSectionTargetSelected(event.target.checked)} /> 이 섹션을 보완 대상으로 선택</label>
            {requirements.map((requirement:Requirement)=><section className="requirements-item" key={requirement.id}><header><strong>{requirement.id}</strong><span>{requirement.priority}</span></header><h4>{requirement.title}</h4><p>{requirement.description}</p><p className="requirements-item-meta">근거: {requirement.sourceItemIds.join(', ') || '연결된 설계 없음'}</p><label><input type="checkbox" checked={selectedRequirementIds.includes(requirement.id)} onChange={(event)=>setSelectedRequirementIds((ids)=>event.target.checked?[...ids,requirement.id]:ids.filter((id)=>id!==requirement.id))} /> 이 요구사항을 보완 대상으로 선택</label>{requirement.acceptanceCriteria.length ? <div><strong>수용 기준</strong><ul>{requirement.acceptanceCriteria.map((criterion,index)=><li key={`${requirement.id}-${index}`}>{criterion.text} <span>(근거: {criterion.sourceItemIds.join(', ')})</span></li>)}</ul></div> : null}</section>)}
          </article> : null}
          {onRequestPatch ? <section className="requirements-ready-review" aria-labelledby="requirements-patch-title"><h3 id="requirements-patch-title">선택 항목 부분 보완</h3><p>선택한 문서 내용과 연결 근거만 요청에 포함합니다. 승인 전에는 저장 문서가 바뀌지 않습니다.</p>{selected ? <p>대상: {[...(sectionTargetSelected?[selected.title]:[]),...requirements.filter((item)=>selectedRequirementIds.includes(item.id)).map((item)=>item.id)].join(', ')||'선택 없음'}</p> : null}{impactPreview?<ImpactSummary preview={impactPreview({sectionIds:sectionTargetSelected&&selected?[selected.id]:[],requirementIds:selectedRequirementIds})}/>:null}{patchError?<p role="alert">{patchError}</p>:null}<button type="button" disabled={patching||(!sectionTargetSelected&&!selectedRequirementIds.length)} onClick={()=>onRequestPatch?.({sectionIds:sectionTargetSelected&&selected?[selected.id]:[],requirementIds:selectedRequirementIds})}>{patching?'보완 제안 작성 중…':'선택 항목 보완 제안 받기'}</button></section>:null}
          {selected?.key==='open_issues' && document.openIssues?.length ? <section aria-labelledby="requirements-open-issues"><h3 id="requirements-open-issues">미뤄 둔 결정</h3><ul>{document.openIssues.map((issue)=><li key={issue.id}><strong>{issue.title}</strong><p>{issue.description}</p><span>설계 항목: {issue.sourceItemIds.join(', ')}</span></li>)}</ul></section> : null}
          {issueCount ? <section className="requirements-review-issues" aria-labelledby="requirements-review-issues-title"><h3 id="requirements-review-issues-title">검토할 문제 {issueCount}개</h3><ul>{document.reviewIssues?.map((issue,index)=><li key={`${issue.code}-${index}`}><strong>{issue.severity==='error'?'필수 확인':'확인 권장'} · {currentSections.find((section)=>section.key===issue.sectionKey)?.title ?? issue.sectionKey}</strong><p>{issue.description}</p>{issue.relatedItemIds.length ? <span>관련 설계: {issue.relatedItemIds.join(', ')}</span> : null}</li>)}</ul><p>설계 근거만으로 해결하기 어렵다면 관련 결정을 대화에서 다시 확인해 주세요.</p></section> : null}
        </div>
      </div>
      {document.status === 'review_required' ? <section className="requirements-ready-review" aria-labelledby="requirements-ready-title">
        <h3 id="requirements-ready-title">Requirements 검토 완료</h3>
        {readySummary?.eligible ? <><p>P0 요구사항 {readySummary.p0RequirementCount}개 · 수용 기준 {readySummary.acceptanceCriteriaCount}개 · 오픈 이슈 {readySummary.openIssueCount}개 · 설계 revision {readySummary.designRevision}</p><button ref={readyTriggerRef} type="button" className="design-requirements-action is-primary" onClick={() => confirmRef.current?.showModal()}>검토 완료 확인</button></> : <><p>완료 처리 전에 아래 항목을 해결해야 합니다.</p><ul>{readySummary?.blockers.map((blocker) => <li key={blocker}>{blockerMessage(blocker)}</li>)}</ul><button type="button" disabled aria-describedby="requirements-ready-blocked">검토 완료 확인</button><span id="requirements-ready-blocked" className="workspace-sr-only">Requirements에 미해결 검토 조건이 있습니다.</span></>}
        {readyError ? <p role="alert">{readyError}</p> : null}
        <dialog ref={confirmRef} aria-labelledby="requirements-ready-confirm-title" onClose={() => readyTriggerRef.current?.focus()}>
          <h3 id="requirements-ready-confirm-title">Requirements 검토를 완료할까요?</h3>
          <p>P0 요구사항 {readySummary?.p0RequirementCount ?? 0}개, 수용 기준 {readySummary?.acceptanceCriteriaCount ?? 0}개, 오픈 이슈 {readySummary?.openIssueCount ?? 0}개를 설계 revision {readySummary?.designRevision ?? '—'} 기준으로 확정합니다. 이 동작은 PRD 생성을 허용하며 PRD 자체를 승인하지 않습니다.</p>
          <button type="button" onClick={() => confirmRef.current?.close()}>취소</button>
          <button type="button" className="design-requirements-action is-primary" onClick={() => { confirmRef.current?.close(); onMarkReady?.(); }}>Requirements 검토 완료</button>
        </dialog>
      </section> : document.status === 'ready' ? <section className="requirements-ready-review"><p role="status">Requirements ready · 설계 revision {document.readyDesignRevision ?? document.designRevision}</p><button type="button" onClick={onOpenPrd}>PRD 열기</button></section> : null}
    </> : null}
  </section>;
}
