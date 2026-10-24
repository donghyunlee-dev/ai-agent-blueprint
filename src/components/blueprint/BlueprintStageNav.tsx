import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";

export type BlueprintStage = "conversation" | "proposal" | "design" | "requirements" | "prd";

const stages: { id: BlueprintStage; label: string }[] = [
  { id: "conversation", label: "대화" },
  { id: "proposal", label: "제안 검토" },
  { id: "design", label: "설계" },
  { id: "requirements", label: "요구사항 명세" },
  { id: "prd", label: "PRD" },
];

export function BlueprintStageNav({
  projectId,
  current,
  requirementsReady,
  prdReady,
}: {
  projectId: string;
  current: BlueprintStage;
  requirementsReady: boolean;
  prdReady: boolean;
}) {
  const navRef = useRef<HTMLElement>(null);
  const base = `/blueprints/${encodeURIComponent(projectId)}`;
  const href: Record<BlueprintStage, string> = {
    conversation: base,
    proposal: `${base}/design#proposal-review-title`,
    design: `${base}/design`,
    requirements: `${base}/requirements`,
    prd: `${base}/prd`,
  };
  useLayoutEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const navBounds = nav.getBoundingClientRect();
    const activeBounds = active.getBoundingClientRect();
    const activeCenter = nav.scrollLeft + activeBounds.left - navBounds.left + activeBounds.width / 2;
    const nextScrollLeft = Math.max(0, Math.min(nav.scrollWidth - nav.clientWidth, activeCenter - nav.clientWidth / 2));
    nav.scrollTo({ left: nextScrollLeft, behavior: 'auto' });
  }, [current]);

  return <nav ref={navRef} className="blueprint-stage-nav" aria-label="프로젝트 단계">
    <ol>{stages.map((stage, index) => {
      const locked = stage.id === "requirements" && !requirementsReady;
      return <li key={stage.id} className={`blueprint-stage blueprint-stage-${stage.id}${current === stage.id ? " is-current" : ""}${locked ? " is-locked" : ""}`}>
        {locked
          ? <button type="button" className="blueprint-stage-locked" disabled aria-describedby="blueprint-stage-requirements-reason"><span className="blueprint-stage-number">{index + 1}</span>{stage.label}</button>
          : <Link to={href[stage.id]} aria-current={current === stage.id ? "step" : undefined} aria-describedby={stage.id === "prd" && !prdReady ? "blueprint-stage-prd-reason" : undefined}><span className="blueprint-stage-number">{index + 1}</span>{stage.label}</Link>}
        {index < stages.length - 1 ? <span className="blueprint-stage-connector" aria-hidden="true" /> : null}
      </li>;
    })}</ol>
    {!requirementsReady ? <div id="blueprint-stage-requirements-reason" className="blueprint-stage-gate"><span>요구사항 명세는 설계 준비 조건을 충족한 뒤 열 수 있습니다.</span><Link to={href.design}>설계에서 준비 상태 확인</Link></div> : null}
    {!prdReady ? <span id="blueprint-stage-prd-reason" className="workspace-sr-only">같은 revision의 요구사항 명세 검토 완료가 필요합니다. 선택하면 잠금 이유와 이동 방법을 확인합니다.</span> : null}
    {prdReady && current === 'prd' ? <Link className="workspace-post-prd-link" to={`${base}/setup_guide`}>설정 가이드</Link> : null}
  </nav>;
}
