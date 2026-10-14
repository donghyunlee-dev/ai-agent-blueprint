import type { ConversationSummary as Summary } from '../../domain/blueprint/types.js';

export function ConversationSummary({ summary }: { summary: Summary }) {
  const entries = [
    ['확정된 내용', summary.confirmedFacts], ['아직 정하지 않은 내용', summary.explicitUnknowns],
    ['제외한 방향', summary.rejectedDirections], ['남은 질문', summary.unresolvedQuestions],
  ] as const;
  return <aside className="conversation-summary" aria-label="이전 대화 요약"><h2>이전 대화 요약</h2><p>원문 대화를 대신해 표시하는 구조화 요약입니다. 근거 대화 {summary.sourceMessageIds.length}개</p>{entries.map(([label, facts]) => facts.length ? <section key={label}><h3>{label}</h3><ul>{facts.map((fact, index) => <li key={`${label}-${index}`}>{fact.text}</li>)}</ul></section> : null)}</aside>;
}
