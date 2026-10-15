import { useEffect, useRef, useState } from 'react';
import type { GeneratedDocument, DocumentSection } from '../../domain/blueprint/types.js';
import '../../styles/blueprint-workspace.css';

type Requirement = NonNullable<GeneratedDocument['requirements']>[number];
type Props = { document?:GeneratedDocument; sections:DocumentSection[]; generating:boolean; error?:string|null; onGenerate:()=>void };

export function RequirementsDocument({ document, sections, generating, error, onGenerate }:Props) {
  const [selectedKey, setSelectedKey] = useState(sections[0]?.key ?? 'overview');
  const [contentsOpen, setContentsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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
  function select(key:string) { setSelectedKey(key); setContentsOpen(false); }
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
          {selected ? <article aria-labelledby="requirements-section-title"><p className="workspace-eyebrow">섹션 {selected.order+1} / {currentSections.length}</p><h3 id="requirements-section-title">{selected.title}</h3>{selected.markdown ? <p className="requirements-section-copy">{selected.markdown}</p> : null}
            {requirements.map((requirement:Requirement)=><section className="requirements-item" key={requirement.id}><header><strong>{requirement.id}</strong><span>{requirement.priority}</span></header><h4>{requirement.title}</h4><p>{requirement.description}</p><p className="requirements-item-meta">근거: {requirement.sourceItemIds.join(', ') || '연결된 설계 없음'}</p>{requirement.acceptanceCriteria.length ? <div><strong>수용 기준</strong><ul>{requirement.acceptanceCriteria.map((criterion,index)=><li key={`${requirement.id}-${index}`}>{criterion.text} <span>(근거: {criterion.sourceItemIds.join(', ')})</span></li>)}</ul></div> : null}</section>)}
          </article> : null}
          {selected?.key==='open_issues' && document.openIssues?.length ? <section aria-labelledby="requirements-open-issues"><h3 id="requirements-open-issues">미뤄 둔 결정</h3><ul>{document.openIssues.map((issue)=><li key={issue.id}><strong>{issue.title}</strong><p>{issue.description}</p><span>설계 항목: {issue.sourceItemIds.join(', ')}</span></li>)}</ul></section> : null}
          {issueCount ? <section className="requirements-review-issues" aria-labelledby="requirements-review-issues-title"><h3 id="requirements-review-issues-title">검토할 문제 {issueCount}개</h3><ul>{document.reviewIssues?.map((issue,index)=><li key={`${issue.code}-${index}`}><strong>{issue.severity==='error'?'필수 확인':'확인 권장'} · {currentSections.find((section)=>section.key===issue.sectionKey)?.title ?? issue.sectionKey}</strong><p>{issue.description}</p>{issue.relatedItemIds.length ? <span>관련 설계: {issue.relatedItemIds.join(', ')}</span> : null}</li>)}</ul><p>설계 근거만으로 해결하기 어렵다면 관련 결정을 대화에서 다시 확인해 주세요.</p></section> : null}
        </div>
      </div>
    </> : null}
  </section>;
}
