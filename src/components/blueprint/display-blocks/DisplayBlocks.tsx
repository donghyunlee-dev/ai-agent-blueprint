import type { DisplayBlock, QuestionSpec } from '../../../domain/blueprint/types.js';
import { prepareDisplayBlocks } from '../../../features/conversation/block-renderer.js';

export function DisplayBlocks({ blocks, questionCatalog = [], proposalIds = [] }: { blocks: unknown[]; questionCatalog?: QuestionSpec[]; proposalIds?: string[] }) {
  const result = prepareDisplayBlocks(blocks, { questionCatalog, proposalIds });
  if (!result.valid) return <p role="alert">AI 응답을 표시할 수 없습니다. (AI_INVALID_OUTPUT)</p>;
  return <div className="ai-display-blocks">{result.blocks.map((block, index) => <article className={`ai-block ai-block-${block.type}`} key={`${block.type}-${index}`}>
    {block.type === 'assistant_text' ? <p>{block.content}</p> : null}
    {block.type === 'question' ? <section aria-label="다음 질문"><h2>{block.prompt}</h2>{block.help ? <p>{block.help}</p> : null}{block.options?.map((option) => <p key={option.value}>{option.label}</p>)}</section> : null}
    {block.type === 'explanation' ? <section><h2>{block.title}</h2><p>{block.summary}</p>{block.comparisons.map((item) => <p key={item.label}><strong>{item.label}</strong> {item.description}</p>)}{block.example ? <p>{block.example}</p> : null}</section> : null}
    {block.type === 'recommendation' ? <section><h2>추천</h2><p>{block.recommendedValue} — {block.rationale}</p><ul>{block.tradeoffs.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
    {block.type === 'proposal_summary' || block.type === 'conflict_notice' ? <p>{block.type === 'conflict_notice' ? '검토할 충돌이 있습니다.' : '검토할 변경 제안이 있습니다.'} ({block.proposalIds.length})</p> : null}
    {block.type === 'readiness_notice' ? <p>준비 상태: {block.readiness.state}</p> : null}
    {block.type === 'next_action' ? <p>다음 단계: {block.action}</p> : null}
  </article>)}</div>;
}
