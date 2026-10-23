import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BlueprintAggregate } from "../../domain/blueprint/types.js";
import { classifyProposalConflicts } from "../../features/proposals/dsg-pr-02-commands.js";

export function ProposalReviewPanel({ aggregate, children }: { aggregate: BlueprintAggregate; children: ReactNode }) {
  const pending = aggregate.proposals.filter((proposal) => proposal.status === "pending");
  const conflicts = classifyProposalConflicts({ ...aggregate, proposals: aggregate.proposals.filter((proposal) => !proposal.documentSnapshot) }).conflictIds;
  const confirmed = aggregate.designItems.filter((item) => item.status === "confirmed" && !item.archivedAt);
  return <div className="proposal-stage-layout">
    <section className="proposal-stage-main" aria-labelledby="proposal-stage-title">
      <header className="proposal-stage-header"><p className="workspace-eyebrow">제안 검토</p><h2 id="proposal-stage-title">이해한 내용을 확인해 주세요</h2><p>확정할 내용과 수정이 필요한 제안을 검토합니다.</p></header>
      {pending.length ? children : <div className="proposal-stage-empty" role="status"><h3>검토할 제안이 없습니다</h3><p>새 제안이 만들어지면 이곳에서 근거와 영향을 확인할 수 있습니다.</p></div>}
    </section>
    <aside className="proposal-stage-summary" aria-label="제안 검토 요약">
      <section><h3><span className="conversation-summary-icon is-confirmed" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m5 12.5 4.5 4.5L19 7" /></svg></span>확정 내용</h3><p className="proposal-stage-count">{confirmed.length}개</p>{confirmed.length ? <ul>{confirmed.slice(0, 4).map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.description || "설명 없음"}</span></li>)}</ul> : <p>아직 확정된 설계 내용이 없습니다.</p>}</section>
      <section><h3><span className="conversation-summary-icon is-pending" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>남은 검토</h3><p className="proposal-stage-count">{pending.length}개</p><p>충돌 {conflicts.length}개 · 일반 검토 {Math.max(0, pending.length - conflicts.length)}개</p>{pending.length ? <ul aria-label="남은 제안">{pending.map((proposal) => { const value = (proposal.after ?? proposal.before ?? {}) as Record<string, unknown>; return <li key={proposal.id}><strong>{String(value.title ?? value.text ?? "제안된 변경")}</strong><span>{String(value.description ?? value.markdown ?? proposal.rationale)}</span></li>; })}</ul> : null}</section>
    </aside>
    <footer className="proposal-stage-actions"><Link to={`/blueprints/${encodeURIComponent(aggregate.project.id)}`} className="proposal-stage-back"><svg className="proposal-stage-back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m7 7-7-7 7-7" /></svg>이전으로</Link>{pending.length === 0 && conflicts.length === 0 ? <Link to={`/blueprints/${encodeURIComponent(aggregate.project.id)}/design`} className="proposal-stage-complete">검토 완료 <span aria-hidden="true">→</span></Link> : <button type="button" className="proposal-stage-complete" disabled aria-describedby="proposal-stage-gate">검토 완료 <span aria-hidden="true">→</span><span id="proposal-stage-gate" className="workspace-sr-only">남은 제안과 충돌을 모두 검토해야 합니다.</span></button>}</footer>
  </div>;
}
