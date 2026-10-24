import { useEffect, useRef } from 'react';
import type { DocumentSection } from '../../domain/blueprint/types.js';
import type { GeneratedDocument } from '../../domain/blueprint/types.js';

const sectionLabels:Record<string,string>={
  overview:'개요',functional:'기능 요구사항',non_functional:'비기능 요구사항',data:'데이터',integration:'연동',permissions:'권한',exceptions:'예외',deployment:'배포',operations:'운영',exclusions:'제외 범위',open_issues:'미결정·열린 이슈',
  problem_goals:'문제와 목표',users_scenarios:'사용자와 시나리오',scope:'범위와 제외 범위',features:'핵심 기능',success_metrics:'성공 지표',risks:'위험',release_plan:'출시 계획',
};

export function documentSectionLabel(section:DocumentSection) {
  if(section.title===section.key) return sectionLabels[section.key] ?? section.title;
  return section.title.replace(/requirements?/gi,'요구사항');
}

function sectionSummary(section:DocumentSection) {
  const markdown=section.markdown.trim();
  const withoutCanonicalKey=markdown.startsWith(`${section.key} `)?markdown.slice(section.key.length).trimStart():markdown;
  return withoutCanonicalKey.replace(/requirements?/gi,'요구사항').split(/\r?\n/).map((line)=>line.trim()).filter((line)=>line&&!line.startsWith('#')).map((line)=>line.replace(/^[-*+]\s+/,'')).join('\n');
}

function sectionStatus(section:DocumentSection) {
  if (section.syncStatus === 'conflict') return {label:'충돌 검토',className:'is-conflict'};
  if (section.syncStatus === 'stale') return {label:'최신 설계와 다름',className:'is-stale'};
  return {label:'현재 설계 기준',className:'is-current'};
}

export function DocumentSectionOverview({sections,onSelect,focusHeading=false,requirements=[]}:{sections:DocumentSection[];onSelect:(section:DocumentSection)=>void;focusHeading?:boolean;requirements?:NonNullable<GeneratedDocument['requirements']>}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{ if (focusHeading) headingRef.current?.focus(); },[focusHeading]);
  return <section className="document-section-overview" aria-labelledby="document-section-overview-title">
    <h2 className={focusHeading?'document-section-overview-title is-focus-target':'workspace-sr-only'} id="document-section-overview-title" ref={headingRef} tabIndex={-1}>문서 섹션</h2>
    {sections.length ? <div className="document-section-overview-list">{sections.map((section)=>{
      const linkedRequirements=requirements.filter((item)=>item.sourceItemIds.some((id)=>section.sourceItemIds.includes(id)));
      const label=documentSectionLabel(section);
      const lines=sectionSummary(section).split('\n').filter(Boolean);
      const status=sectionStatus(section);
      return <article className="document-section-overview-card" key={section.id}>
      <div className="document-section-overview-copy"><span className="document-section-overview-icon" aria-hidden="true">▤</span><div className="document-section-overview-heading"><p className="workspace-eyebrow">{section.order+1}. <span className={`document-section-overview-status ${status.className}`}>{status.label}</span></p><h3>{label}</h3><p className="document-section-overview-summary">{lines[0] ?? '작성된 내용이 없습니다.'}</p></div></div>
      <div className="document-section-overview-content" aria-label={`${label} 문서 내용`}>
        {lines.length>1 ? <ul>{lines.slice(1,4).map((line,index)=><li key={`${index}-${line}`}>{line}</li>)}</ul> : null}
        <div className="document-section-overview-linked" aria-label={`${label} 연결 요구사항`}>{linkedRequirements.length ? <ul>{linkedRequirements.map((item)=><li key={item.id}><strong>{item.id}</strong><span>{item.title}</span></li>)}</ul> : null}</div>
        {lines.length<=1&&!linkedRequirements.length?<p className="document-section-overview-no-details">연결된 항목 없음</p>:null}
      </div>
      <button type="button" onClick={()=>onSelect(section)} aria-label={`${label} 내용 보기`}>내용 보기 <span aria-hidden="true">›</span></button>
    </article>})}</div> : <p className="document-section-overview-empty">문서 섹션이 없습니다. 문서를 다시 생성해 주세요.</p>}
  </section>;
}
