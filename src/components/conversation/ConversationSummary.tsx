import { useState } from 'react';
import type { ConversationSummary as Summary } from '../../domain/blueprint/types.js';

export function ConversationSummary({ summary, availableMessageIds = [], onNavigateSource, onClose }: { summary?: Summary; availableMessageIds?:string[]; onNavigateSource?:(messageId:string)=>void; onClose?:()=>void }) {
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<'list' | 'diagram'>('list');
  const availableSources = new Set(availableMessageIds);
  const entries = summary ? [
    ['확정 내용', summary.confirmedFacts, 'confirmed'], ['남은 결정', [...summary.explicitUnknowns, ...summary.unresolvedQuestions], 'pending'],
    ...(summary.rejectedDirections.length ? [['제외한 방향', summary.rejectedDirections, 'neutral'] as const] : []),
  ] as const : [];

  return <section className="conversation-summary" aria-label="요약">
    <header className="conversation-summary-heading">
      <h2 id="conversation-summary-title">요약</h2>
      {onClose ? <button type="button" className="conversation-summary-mobile-close" onClick={onClose}>요약 닫기</button> : null}
      <button type="button" className="conversation-summary-toggle" aria-label={expanded ? '요약 접기' : '요약 펼치기'} aria-expanded={expanded} aria-controls="conversation-summary-content" onClick={() => setExpanded((current) => !current)}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 14 6-6 6 6" /></svg>
      </button>
    </header>
    <div id="conversation-summary-content" className="conversation-summary-content" hidden={!expanded}>
      {summary ? entries.map(([label, facts, icon]) => <section className={`conversation-summary-group is-${icon}`} key={label}>
        <div className="conversation-summary-group-heading"><h3><span className={`conversation-summary-icon is-${icon}`} aria-hidden="true">{icon === 'confirmed' ? <svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg> : icon === 'pending' ? <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> : '·'}</span>{label}</h3>
          {label === '확정 내용' && summary.diagram ? <div className="conversation-summary-view-toggle" role="group" aria-label="요약 보기">
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>목록 보기</button>
            <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')}>도식 보기</button>
          </div> : null}
        </div>
        {facts.length ? label === '확정 내용' && view === 'diagram' && summary.diagram ? <div className="conversation-decision-diagram">
          <ol className="conversation-decision-nodes" aria-label="확정 결정 도식">{summary.diagram.nodes.map((node) => {
            const sourceMessageId = node.sourceMessageIds.find((id) => availableSources.has(id));
            return <li className="conversation-decision-node" key={node.id}><strong>{node.title}</strong>{sourceMessageId && onNavigateSource ? <button type="button" className="summary-source-link" aria-label={`대화 보기: ${node.title}`} onClick={() => onNavigateSource(sourceMessageId)}>대화 보기</button> : <span className="summary-source-unavailable" role="status">원본 대화를 찾을 수 없습니다.</span>}</li>;
          })}</ol>
          <ul className="conversation-decision-edges" aria-label="결정 관계">{summary.diagram.edges.map((edge) => {
            const source = summary.diagram?.nodes.find((node) => node.id === edge.source);
            const target = summary.diagram?.nodes.find((node) => node.id === edge.target);
            if (!source || !target) return null;
            return <li key={`${edge.source}-${edge.target}`}><span>{source.title}</span><span className="conversation-decision-edge-label">↔ 관련 결정 ↔</span><span>{target.title}</span></li>;
          })}</ul>
        </div> : <ul>{facts.map((fact, index) => {const sourceMessageId=fact.sourceMessageIds.find((id)=>availableSources.has(id));return <li key={`${label}-${index}`}>{fact.text}{sourceMessageId&&onNavigateSource?<button type="button" className="summary-source-link" onClick={()=>onNavigateSource(sourceMessageId)}>대화 보기</button>:fact.sourceMessageIds.length?<span className="summary-source-unavailable" role="status">원본 대화를 찾을 수 없습니다.</span>:null}</li>;})}</ul> : <p>{label==='확정 내용' ? '아직 확정된 내용이 없습니다.' : label==='남은 결정' ? '대화에서 필요한 결정을 확인합니다.' : '제외한 방향이 없습니다.'}</p>}
      </section>) : <>
        <section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-confirmed" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg></span>확정 내용</h3><p>아직 확정된 내용이 없습니다.</p></section>
        <section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-pending" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>남은 결정</h3><p>대화에서 필요한 결정을 확인합니다.</p></section>
      </>}
    </div>
  </section>;
}
