import { useState } from 'react';
import type { ConversationSummary as Summary } from '../../domain/blueprint/types.js';

export function ConversationSummary({ summary, onNavigateSource, onClose }: { summary?: Summary; onNavigateSource?:(messageId:string)=>void; onClose?:()=>void }) {
  const [expanded, setExpanded] = useState(true);
  const entries = summary ? [
    ['확정 내용', summary.confirmedFacts, 'confirmed'], ['남은 결정', [...summary.explicitUnknowns, ...summary.unresolvedQuestions], 'pending'],
    ['제외한 방향', summary.rejectedDirections, 'neutral'],
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
        <h3><span className={`conversation-summary-icon is-${icon}`} aria-hidden="true">{icon === 'confirmed' ? <svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg> : icon === 'pending' ? <svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> : '·'}</span>{label}</h3>
        {facts.length ? <ul>{facts.map((fact, index) => <li key={`${label}-${index}`}>{fact.text}{fact.sourceMessageIds[0] && onNavigateSource ? <button type="button" className="summary-source-link" onClick={()=>onNavigateSource(fact.sourceMessageIds[0])}>대화 보기</button> : null}</li>)}</ul> : <p>{label==='확정 내용' ? '아직 확정된 내용이 없습니다.' : label==='남은 결정' ? '대화에서 필요한 결정을 확인합니다.' : '제외한 방향이 없습니다.'}</p>}
      </section>) : <>
        <section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-confirmed" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg></span>확정 내용</h3><p>아직 확정된 내용이 없습니다.</p></section>
        <section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-pending" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>남은 결정</h3><p>대화에서 필요한 결정을 확인합니다.</p></section>
      </>}
    </div>
  </section>;
}
