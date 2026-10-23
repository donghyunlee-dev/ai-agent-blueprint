import type { ConversationSummary as Summary } from '../../domain/blueprint/types.js';

export function ConversationSummary({ summary }: { summary?: Summary }) {
  if (!summary) return <aside className="conversation-summary" aria-label="요약"><h2>요약</h2><section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-confirmed" aria-hidden="true">✓</span>확정 내용</h3><p>아직 확정된 내용이 없습니다.</p></section><section className="conversation-summary-group"><h3><span className="conversation-summary-icon is-pending" aria-hidden="true">◷</span>남은 결정</h3><p>대화에서 필요한 결정을 확인합니다.</p></section></aside>;
  const entries = [
    ['확정 내용', summary.confirmedFacts, 'confirmed'], ['남은 결정', [...summary.explicitUnknowns, ...summary.unresolvedQuestions], 'pending'],
    ['제외한 방향', summary.rejectedDirections, 'neutral'],
  ] as const;
  return <section className="conversation-summary" aria-label="요약"><h2>요약</h2>{entries.map(([label, facts, icon]) => facts.length ? <section className="conversation-summary-group" key={label}><h3><span className={`conversation-summary-icon is-${icon ?? 'neutral'}`} aria-hidden="true">{icon === 'confirmed' ? <svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg> : icon === 'pending' ? <svg viewBox="0 0 24 24" focusable="false"><path d="M12 7v5l3 2" /></svg> : '·'}</span>{label}</h3><ul>{facts.map((fact, index) => <li key={`${label}-${index}`}>{fact.text}</li>)}</ul></section> : null)}</section>;
}
