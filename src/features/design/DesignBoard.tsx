import { useEffect, useState } from 'react';
import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
import { DESIGN_SECTIONS } from './readiness.js';
import type { DesignReadiness } from './readiness.js';
import { buildReadinessPresentationGroups } from './readiness-presentation.js';

type Props = {
  aggregate: BlueprintAggregate;
  readiness: DesignReadiness;
  selectedItemId: string | null;
  onSelectItem: (item: BlueprintAggregate['designItems'][number]) => void;
  onContinueDeciding: () => void;
  onOpenRequirements: () => void;
};

const stateLabels: Record<string, string> = {
  confirmed: '확정', proposed: '제안', deferred: '미정 · 오픈 이슈', not_applicable: '해당 없음',
  review_required: '재검토 필요', conflict: '충돌', rejected: '거절됨',
};

const areaStatusLabels: Record<string, string> = {
  conflict: '충돌', review_required: '재검토 필요', missing: '부족', proposed: '제안 검토',
  deferred: '보류', confirmed: '확정', not_applicable: '해당 없음', not_required: '관련 결정 없음',
};

function groupStatusLabel(status: string) {
  if (status === 'not_required') return '관련 결정 없음';
  if (status === 'not_applicable') return '해당 없음';
  return areaStatusLabels[status] ?? '부족';
}

function groupSummary(statuses: string[]) {
  const needsAttention = statuses.filter((status) => ['conflict', 'review_required', 'missing', 'proposed'].includes(status)).length;
  const deferred = statuses.filter((status) => status === 'deferred').length;
  const confirmed = statuses.filter((status) => status === 'confirmed').length;
  const notApplicable = statuses.filter((status) => status === 'not_applicable').length;
  const notRequired = statuses.filter((status) => status === 'not_required').length;
  return [
    needsAttention ? `확인 필요 ${needsAttention}` : '',
    deferred ? `보류 ${deferred}` : '',
    confirmed ? `확정 ${confirmed}` : '',
    notApplicable ? `해당 없음 ${notApplicable}` : '',
    notRequired ? `관련 결정 없음 ${notRequired}` : '',
  ].filter(Boolean).join(' · ') || '아직 확인할 영역이 없습니다.';
}

function readinessMessage(readiness: DesignReadiness) {
  if (readiness.state === 'ready') return '핵심 설계와 수용 기준이 준비되었습니다.';
  if (readiness.state === 'workable') return '명시적으로 미룬 항목은 오픈 이슈로 포함됩니다.';
  if (readiness.conflictCount) return `충돌 ${readiness.conflictCount}개를 먼저 해결해야 합니다.`;
  const missingCount = readiness.blockers.filter((blocker) => blocker.key !== 'proposals' && blocker.key !== 'conflicts').length;
  if (readiness.pendingProposalCount) return `검토하지 않은 제안 ${readiness.pendingProposalCount}개를 먼저 처리해야 합니다.`;
  return `필수 항목 ${missingCount}개를 결정해야 합니다.`;
}

export function DesignBoard({ aggregate, readiness, selectedItemId, onSelectItem, onContinueDeciding, onOpenRequirements }: Props) {
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [filterItemIds, setFilterItemIds] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(null);
  const [pendingFocusAreaKey, setPendingFocusAreaKey] = useState<string | null>(null);
  const presentationGroups = buildReadinessPresentationGroups(readiness);
  const activeItems = aggregate.designItems.filter((item) => !item.archivedAt && item.status !== 'rejected');
  const sectionReviewItems = activeItems.filter((item) => item.type === 'document_section' && item.status === 'review_required');
  const selectedGroup = presentationGroups.find((group) => group.key === activeGroupKey);
  const visibleAreas = readiness.areas.filter((area) => {
    if (filterKey) return area.key === filterKey || (filterKey === 'conflicts' && area.status === 'conflict');
    return !selectedGroup || selectedGroup.areaKeys.includes(area.key);
  });

  useEffect(() => {
    if (!pendingFocusItemId) return;
    const target = document.querySelector<HTMLElement>(`[data-design-item-id="${CSS.escape(pendingFocusItemId)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest' });
    target.focus();
    setPendingFocusItemId(null);
  }, [pendingFocusItemId, visibleAreas, filterItemIds, collapsed]);

  useEffect(() => {
    if (!pendingFocusAreaKey) return;
    const target = document.querySelector<HTMLElement>(`[data-design-section="${CSS.escape(pendingFocusAreaKey)}"] h3`);
    if (!target) return;
    target.scrollIntoView({ block: 'nearest' });
    target.focus();
    setPendingFocusAreaKey(null);
  }, [pendingFocusAreaKey, visibleAreas]);

  function focusBlocker(key: string, itemIds: string[]) {
    if (key === 'proposals' || (key === 'conflicts' && !itemIds.length)) {
      document.querySelector<HTMLElement>('#proposal-review-title')?.focus();
      document.querySelector<HTMLElement>('.proposal-review')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (itemIds.length) {
      const itemId = itemIds[0];
      const itemArea = readiness.areas.find((area) => area.itemIds.includes(itemId));
      if (itemArea && collapsed[itemArea.key]) setCollapsed((value) => ({ ...value, [itemArea.key]: false }));
      setPendingFocusItemId(itemId);
      return;
    }
    const selector = `[data-design-section="${key}"] h3`;
    const target = document.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({ block: 'nearest' });
    target?.focus();
  }

  return <section className="design-board" aria-label="설계 준비 영역" data-testid="design-board">
    <section className={`design-readiness design-readiness-${readiness.state}`} aria-labelledby="design-readiness-title">
      <div className="design-readiness-topline"><h3 id="design-readiness-title">설계 준비 상태</h3><span className="design-readiness-badge">{readiness.state === 'ready' ? '준비 완료' : readiness.state === 'workable' ? '작업 가능' : '부족'}</span></div>
      <p>{readinessMessage(readiness)}</p>
      {readiness.state === 'workable' ? <p className="design-open-issues">열린 이슈 {readiness.deferredCount}개</p> : null}
    </section>

    <section className="design-readiness-overview" aria-labelledby="design-readiness-overview-title">
      <div className="design-readiness-overview-heading">
        <div><p className="workspace-eyebrow">주요 설계 영역</p><h3 id="design-readiness-overview-title">설계 준비 한눈에 보기</h3></div>
        <div className="design-readiness-overview-actions">
          <p>카드를 선택하면 관련 영역과 원인을 확인할 수 있습니다.</p>
          {filterKey || activeGroupKey ? <button type="button" className="design-filter-clear" onClick={() => { setFilterKey(null); setActiveGroupKey(null); setFilterItemIds([]); }}>전체 영역 보기</button> : null}
        </div>
      </div>
      <div className="design-readiness-groups">
        {presentationGroups.map((group) => {
          const childAreas = group.areaKeys.map((key) => readiness.areas.find((area) => area.key === key)).filter((area): area is DesignReadiness['areas'][number] => Boolean(area));
          return <button
            key={group.key}
            type="button"
            className={`design-readiness-group${activeGroupKey === group.key ? ' is-selected' : ''}`}
            data-readiness-group={group.key}
            aria-pressed={activeGroupKey === group.key}
            onClick={() => {
              setActiveGroupKey(group.key);
              setFilterKey(null);
              setFilterItemIds([]);
              setPendingFocusAreaKey(group.areaKeys[0]);
            }}
          >
            <span className="design-readiness-group-heading"><strong>{group.title}</strong><span className={`design-section-status status-${group.status}`}>{groupStatusLabel(group.status)}</span></span>
            <span className="design-readiness-group-areas">{childAreas.map((area) => `${area.title} · ${areaStatusLabels[area.status]}`).join(' / ')}</span>
            <span className="design-readiness-group-summary">{groupSummary(childAreas.map((area) => area.status))}</span>
          </button>;
        })}
      </div>
    </section>

    <div className="design-readiness-action">
      {readiness.canGenerateRequirements
        ? <button type="button" className={readiness.state === 'ready' ? 'design-requirements-action is-primary' : 'design-requirements-action'} onClick={onOpenRequirements}>Requirements 열기</button>
        : <button type="button" disabled onClick={() => undefined}>Requirements 열기 · 준비 항목 확인 필요</button>}
    </div>
    {readiness.blockers.length ? <section aria-label="준비 부족 원인">
      <h3 className="design-blocker-heading">해결할 항목</h3>
      <ul className="design-blocker-list">{readiness.blockers.map((blocker, index) => <li key={`${blocker.key}-${index}`}><button type="button" onClick={() => { setActiveGroupKey(null); setFilterKey(blocker.key); setFilterItemIds(blocker.itemIds); window.requestAnimationFrame(() => focusBlocker(blocker.key, blocker.itemIds)); }}>{blocker.title} · {blocker.reason}</button></li>)}</ul>
    </section> : null}

    <nav className="design-section-nav" aria-label="설계 영역 바로가기">{DESIGN_SECTIONS.map((section) => <button key={section.key} type="button" onClick={() => { setActiveGroupKey(null); setFilterKey(section.key); setFilterItemIds([]); window.requestAnimationFrame(() => focusBlocker(section.key, [])); }}>{section.title}</button>)}</nav>

    <div className="design-section-list">{visibleAreas.map((area) => {
      const section = DESIGN_SECTIONS.find((entry) => entry.key === area.key)!;
      const sectionItems = activeItems.filter((item) => area.itemIds.includes(item.id) && (!filterItemIds.length || filterItemIds.includes(item.id)));
      const isCollapsed = collapsed[area.key] ?? false;
      return <section key={area.key} className="design-section" data-design-section={area.key} aria-labelledby={`design-section-${area.key}`}>
        <header className="design-section-heading">
          <h3 id={`design-section-${area.key}`} tabIndex={-1}>{section.title}</h3>
          <span className={`design-section-status status-${area.status}`}>{area.status === 'not_required' ? '관련 결정 없음' : area.status === 'confirmed' ? '확정' : area.status === 'deferred' ? '미정' : area.status === 'not_applicable' ? '해당 없음' : area.status === 'review_required' ? '재검토 필요' : area.status === 'proposed' ? '제안 검토' : area.status === 'conflict' ? '충돌' : '필수 정보 부족'}</span>
          <button type="button" aria-expanded={!isCollapsed} aria-controls={`design-items-${area.key}`} onClick={() => setCollapsed((value) => ({ ...value, [area.key]: !isCollapsed }))}>{isCollapsed ? '펼치기' : '접기'}</button>
        </header>
        {!isCollapsed ? <div id={`design-items-${area.key}`} className="design-items-list">
          {sectionItems.map((item) => {
            const itemState = readiness.areas.find((entry) => entry.key === area.key)?.status === 'conflict' && readiness.blockers.some((blocker) => blocker.key === 'conflicts' && blocker.itemIds.includes(item.id)) ? 'conflict' : item.status;
            return <button key={item.id} type="button" className={`design-item-row${selectedItemId === item.id ? ' is-selected' : ''}`} data-design-item-id={item.id} aria-pressed={selectedItemId === item.id} onClick={() => onSelectItem(item)}>
              <span className="design-item-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
              <span className={`design-item-state status-${itemState}`}>{stateLabels[itemState] ?? '미정'}</span>
              {item.relatedItemIds.length ? <span className="design-item-related">관계 {item.relatedItemIds.length}</span> : null}
            </button>;
          })}
          {!sectionItems.length ? <div className="design-section-empty"><p>{area.status === 'not_required' ? '이 영역에 필요한 조건부 결정이 없습니다.' : '아직 이 영역의 설계가 없습니다.'}</p>{area.status !== 'not_required' ? <button type="button" onClick={onContinueDeciding}>대화에서 결정</button> : null}</div> : null}
        </div> : null}
      </section>;
    })}</div>
    {sectionReviewItems.length ? <section className="design-section" aria-labelledby="document-section-review-title">
      <header className="design-section-heading"><h3 id="document-section-review-title">문서 편집 정합성 검토</h3><span className="design-section-status status-review_required">검토 필요 · {sectionReviewItems.length}</span></header>
      <p>편집된 문서 섹션을 관련된 개별 설계 항목에 반영할지 검토하세요.</p>
      <div className="design-items-list">{sectionReviewItems.map((item) => <button key={item.id} type="button" className={`design-item-row${selectedItemId === item.id ? ' is-selected' : ''}`} data-design-item-id={item.id} aria-pressed={selectedItemId === item.id} onClick={() => onSelectItem(item)}>
        <span className="design-item-copy"><strong>{item.title}</strong><span>{item.description}</span></span><span className="design-item-state status-review_required">상세 및 관련 항목 확인</span>
      </button>)}</div>
    </section> : null}
  </section>;
}
