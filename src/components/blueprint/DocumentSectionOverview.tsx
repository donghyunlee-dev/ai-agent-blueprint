import { useEffect, useRef } from 'react';
import type { DocumentSection } from '../../domain/blueprint/types.js';

function sectionStatus(section:DocumentSection) {
  if (section.syncStatus === 'conflict') return '충돌 검토';
  if (section.syncStatus === 'stale') return '최신 설계와 다름';
  return '현재 설계 기준';
}

export function DocumentSectionOverview({sections,onSelect,focusHeading=false}:{sections:DocumentSection[];onSelect:(section:DocumentSection)=>void;focusHeading?:boolean}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{ if (focusHeading) headingRef.current?.focus(); },[focusHeading]);
  return <section className="document-section-overview" aria-labelledby="document-section-overview-title">
    <header><h3 id="document-section-overview-title" ref={headingRef} tabIndex={-1}>문서 섹션</h3><p>{sections.length}개 항목</p></header>
    {sections.length ? <div className="document-section-overview-list">{sections.map((section)=><article className="document-section-overview-card" key={section.id}>
      <div><p className="workspace-eyebrow">{section.order+1}. {sectionStatus(section)}</p><h4>{section.title}</h4><p className="document-section-overview-summary">{section.markdown.trim()||'내용을 검토하고 필요한 사항을 보완하세요.'}</p></div>
      <button type="button" onClick={()=>onSelect(section)} aria-label={`${section.title} 내용 보기`}>내용 보기 <span aria-hidden="true">›</span></button>
    </article>)}</div> : <p className="document-section-overview-empty">문서 섹션이 없습니다. 문서를 다시 생성해 주세요.</p>}
  </section>;
}
