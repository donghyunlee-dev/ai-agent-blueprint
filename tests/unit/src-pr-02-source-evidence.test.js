import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSourceExcerpts } from '../../src/features/sources/source-excerpt-selection.js';
import { removeSource, sourceRemovalImpact } from '../../src/features/sources/source-upload-command.js';
import { normalizeProposals } from '../../src/features/proposals/normalize-proposals.js';

const source = (id, extractedText, overrides = {}) => ({ id, projectId:'p1', fileName:`${id}.txt`, extractionStatus:'ready', extractedText, createdAt:'2026-01-01T00:00:00Z', ...overrides });

test('selects relevant intact paragraphs with deterministic source locations and approved bounds', () => {
  const long = '예약 관리 '.repeat(121).trim();
  const excerpts = selectSourceExcerpts({ projectId:'p1', query:'예약 취소', idFactory:(() => { let id=0; return () => `excerpt-${++id}`; })(), sources:[
    source('a', `예약 관리를 제공한다.\n\n${long}\n\n취소 예약을 처리한다.`),
    source('b', '예약 취소 규칙을 확인한다.'),
    source('not-ready', '예약 취소', { extractionStatus:'failed' }),
    source('foreign', '예약 취소', { projectId:'p2' }),
    source('archived', '예약 취소', { archivedAt:'2026-10-20T00:00:00Z' }),
  ] });

  assert.deepEqual(excerpts.map(({ sourceId, location }) => [sourceId, location]), [['a','문단 1'], ['a','문단 3'], ['b','문단 1']]);
  assert.equal(excerpts.every((entry) => entry.text.length <= 1200), true);
  assert.equal(excerpts.find((entry) => entry.location === '문단 3').text, '취소 예약을 처리한다.');
  assert.equal(excerpts.some((entry) => entry.sourceId === 'not-ready' || entry.sourceId === 'foreign'), false);
});

test('limits the request to 6000 excerpt-text characters and omits a paragraph that cannot fit intact', () => {
  const sources = Array.from({ length: 6 }, (_, index) => source(`s${index + 1}`, '가'.repeat(1200)));
  const excerpts = selectSourceExcerpts({ projectId:'p1', query:'가', idFactory:(() => { let id=0; return () => `id-${++id}`; })(), sources });
  assert.equal(excerpts.length, 5);
  assert.equal(excerpts.reduce((sum, excerpt) => sum + excerpt.text.length, 0), 6000);
  assert.deepEqual(excerpts.map((excerpt) => excerpt.sourceId), ['s1','s2','s3','s4','s5']);
});

test('counts Unicode code points as characters for excerpt bounds', () => {
  const text = '🗓️'.repeat(600);
  const excerpts = selectSourceExcerpts({ projectId:'p1', query:'', sources:[source('emoji', text)], idFactory:()=> 'emoji-excerpt' });
  assert.equal(Array.from(excerpts[0].text).length, 1200);
});

test('omits a whole paragraph that exceeds the remaining per-source limit and keeps later fitting text', () => {
  const excerpts = selectSourceExcerpts({ projectId:'p1', query:'', sources:[source('bounded', `${'가'.repeat(700)}\n\n${'나'.repeat(700)}\n\n${'다'.repeat(100)}`)], idFactory:(() => { let id=0; return () => `bound-${++id}`; })() });
  assert.deepEqual(excerpts.map(({ location, text }) => [location, text.length]), [['문단 1',700],['문단 3',100]]);
});

test('normalizes request-local citations to canonical source IDs with exact quote and location', () => {
  const excerpts = [{ id:'request-excerpt', sourceId:'source-1', text:'예약은 두 시간 전에 취소할 수 있습니다.', location:'문단 2' }];
  const result = normalizeProposals({ projectId:'p1', logicalRequestId:'request-1', sources:[source('source-1','')], sourceExcerpts:excerpts, idFactory:()=> 'generated', proposals:[{
    operation:'create', targetType:'design_item', after:{ type:'constraint', title:'취소 정책', description:'두 시간 전까지 취소' }, rationale:'자료에 명시됨', affectedItemIds:[], evidence:[{ sourceType:'file', sourceId:'request-excerpt', location:'모델이 꾸민 위치' }],
  }] });
  assert.deepEqual(result.proposals[0].evidence[0], { sourceType:'file', sourceId:'source-1', excerpt:'예약은 두 시간 전에 취소할 수 있습니다.', location:'문단 2', id:'generated', createdAt:result.proposals[0].createdAt });
  assert.throws(() => normalizeProposals({ projectId:'p1', logicalRequestId:'request-2', sources:[source('source-1','')], sourceExcerpts:excerpts, proposals:[{ operation:'create', targetType:'design_item', after:{ type:'constraint', title:'x' }, rationale:'자료', affectedItemIds:[], evidence:[{ sourceType:'file', sourceId:'unsent-excerpt' }] }] }), /PROPOSAL_EVIDENCE_INVALID/);
  assert.throws(() => normalizeProposals({ projectId:'p1', logicalRequestId:'request-3', sources:[source('source-1','')], proposals:[{ operation:'create', targetType:'design_item', after:{ type:'constraint', title:'x' }, rationale:'자료', affectedItemIds:[], evidence:[{ sourceType:'file', sourceId:'source-1' }] }] }), /PROPOSAL_EVIDENCE_INVALID/);
  assert.throws(() => normalizeProposals({ projectId:'p1', logicalRequestId:'request-4', sources:[source('source-1','')], sourceExcerpts:excerpts, proposals:[{ operation:'create', targetType:'design_item', after:{ type:'constraint', title:'x' }, rationale:'자료', affectedItemIds:[], evidence:[{ sourceType:'file', sourceId:'request-excerpt', excerpt:'예약은 시작 30일 전에 취소됩니다.' }] }] }), /PROPOSAL_EVIDENCE_INVALID/);
});

const fileRef = (id, sourceId, sourceType='file') => ({ id, sourceType, sourceId, excerpt:id, createdAt:'2026-01-01T00:00:00Z' });
const baseAggregate = () => ({ project:{ id:'p1', ownerKey:'owner', updatedAt:'old' }, sources:[source('source-1','')], designItems:[
  { id:'item-1', archivedAt:undefined, evidence:[fileRef('one','source-1'),fileRef('two','source-1')], acceptanceCriteria:[{ id:'criterion-1', evidence:[fileRef('three','source-1'),fileRef('keep','source-2')] }] },
  { id:'item-2', evidence:[fileRef('message','message-1','message')], acceptanceCriteria:[] },
  { id:'archived', archivedAt:'2026-01-02', evidence:[fileRef('archived-ref','source-1')], acceptanceCriteria:[] },
] });

test('counts unique active impacted items and atomically removes only matching file refs', async () => {
  const state = baseAggregate();
  const repository = { transact: async (_owner, _projectId, mutate) => { const result=mutate(structuredClone(state)); if(result.aggregate) Object.assign(state,result.aggregate); return result; } };
  assert.equal(sourceRemovalImpact(state, 'source-1'), 1);
  await removeSource({ ownerKey:'owner', projectId:'p1', sourceId:'source-1', expectedImpactCount:1, repository });
  assert.deepEqual(state.sources, []);
  assert.equal(state.designItems.length, 3);
  assert.deepEqual(state.designItems[0].evidence, []);
  assert.deepEqual(state.designItems[0].acceptanceCriteria[0].evidence.map((ref) => ref.sourceId), ['source-2']);
  assert.deepEqual(state.designItems[1].evidence.map((ref) => ref.sourceId), ['message-1']);
  assert.equal(state.designItems[2].evidence.length, 0);
});

test('source removal aborts if the latest unique impact count differs from displayed count', async () => {
  const state = baseAggregate();
  const repository = { transact: async (_owner, _projectId, mutate) => mutate(structuredClone(state)) };
  await assert.rejects(removeSource({ ownerKey:'owner', projectId:'p1', sourceId:'source-1', expectedImpactCount:0, repository }), /SOURCE_REMOVAL_IMPACT_CHANGED/);
});

test('counts five unique items despite duplicate direct and nested evidence references', () => {
  const aggregate = baseAggregate();
  aggregate.designItems = Array.from({ length:5 }, (_, index) => ({
    id:`item-${index + 1}`, evidence:index === 0 ? [fileRef('one','source-1'),fileRef('duplicate','source-1')] : [],
    acceptanceCriteria:[{ id:`criterion-${index + 1}`, evidence:[fileRef(`nested-${index + 1}`,'source-1')] }],
  }));
  assert.equal(sourceRemovalImpact(aggregate, 'source-1'), 5);
});

test('a failed source removal transaction leaves persisted source and evidence untouched', async () => {
  const state = baseAggregate();
  const before = structuredClone(state);
  let notifications = 0;
  const repository = { transact: async () => { throw new Error('STORAGE_FAILED'); } };
  await assert.rejects(removeSource({ ownerKey:'owner', projectId:'p1', sourceId:'source-1', expectedImpactCount:1, repository, onAggregate:()=>notifications++ }), /STORAGE_FAILED/);
  assert.deepEqual(state, before);
  assert.equal(notifications, 0);
});
