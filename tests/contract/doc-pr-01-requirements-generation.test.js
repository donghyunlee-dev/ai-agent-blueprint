import test from 'node:test';
import assert from 'node:assert/strict';
import { commitRequirementsResult, generateRequirements } from '../../src/features/documents/requirements-generation.js';
import { buildRequirementsPlan } from '../../src/features/documents/document-plan.js';

const at = '2026-10-15T00:00:00.000Z';
const item = (id, type, extra = {}) => ({ id, projectId: 'p', type, title: id, description: `${id} 설명`, status: 'confirmed', priority: 'must', attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: at, updatedAt: at, ...extra });
const aggregate = {
  project: { id: 'p', title: '제품', designRevision: 1 }, proposals: [], documents: [], sections: [], generationJobs: [], activityEntries: [], designItems: [
    item('product', 'product_definition'), item('problem', 'problem'), item('goal', 'goal'), item('user', 'user_role'), item('scenario', 'scenario'),
    item('feature', 'requirement', { acceptanceCriteria: [{ id: 'ac', text: '결과 표시', status: 'confirmed' }] }),
    item('scope', 'scope'), item('out', 'out_of_scope'), item('metric', 'success_metric'), item('risk', 'risk'),
  ],
};
function envelope(task, payload) { return { task, promptVersion: task === 'REQUIREMENTS_DRAFT' ? 'v2' : 'v1', schemaVersion: 'v1', designRevision: 1, payload, referencedItemIds: aggregate.designItems.map(({id}) => id), referencedSourceIds: [], warnings: [] }; }
const plan = buildRequirementsPlan(aggregate);
const sections = () => plan.sections.map(({ key, title, sourceItemIds }) => ({ key, title, markdown: key === 'functional' ? '기능' : '', sourceItemIds }));
const draft = () => envelope('REQUIREMENTS_DRAFT', { sections: sections(), requirements: plan.requirements.map(({ id, category, title, description, priority, sourceItemIds, acceptanceCriteria }) => ({ id,category,title,description,priority,sourceItemIds,acceptanceCriteria:priority === 'P0' ? [{ text:'결과 표시',sourceItemIds }] : [],openIssueIds:[] })) });
const review = (verdict, issues = []) => envelope('REQUIREMENTS_REVIEW', { verdict, issues, coverage: [{targetId:'feature',status:'covered'}] });

test('runs deterministic plan then Mini draft/review and returns review_required without automatic ready', async () => {
  const calls = [];
  const result = await generateRequirements({ aggregate, runTask: async (task, input) => { calls.push(task); return task === 'REQUIREMENTS_DRAFT' ? draft() : review('pass'); } });
  assert.deepEqual(calls, ['REQUIREMENTS_DRAFT','REQUIREMENTS_REVIEW']);
  assert.equal(result.document.status, 'review_required');
  assert.equal(result.document.designRevision, 1);
  assert.equal(result.sections.length, 11);
  assert.equal(result.job.promptVersion, 'v2');
  assert.equal(result.job.schemaVersion, 'v1');
});

test('repairs at most once and leaves user-review issues unresolved after final review', async () => {
  const calls = [];
  const result = await generateRequirements({ aggregate, runTask: async (task) => {
    calls.push(task);
    if (task === 'REQUIREMENTS_DRAFT') return draft();
    if (task === 'REQUIREMENTS_REVIEW') return review(calls.filter((name) => name === task).length === 1 ? 'repairable' : 'user_review_required', [{ code:'NEEDS_CONTEXT',severity:'warning',sectionKey:'functional',relatedItemIds:['feature'],description:'추가 결정 필요', ...(calls.filter((name) => name === task).length === 1 ? { repairInstruction:'기능을 명확히 표현' } : {}) }]);
    return envelope('REQUIREMENTS_REPAIR', { sections: sections().filter((section) => section.key === 'functional'), resolvedIssueIds: [] });
  }});
  assert.deepEqual(calls, ['REQUIREMENTS_DRAFT','REQUIREMENTS_REVIEW','REQUIREMENTS_REPAIR','REQUIREMENTS_REVIEW']);
  assert.equal(result.document.status, 'review_required');
  assert.equal(result.reviewIssues.length, 1);
});

test('blocks readiness and invalid coverage before provider call', async () => {
  let count = 0;
  const blocked = structuredClone(aggregate); blocked.designItems.find((entry) => entry.type === 'scenario').status = 'review_required';
  await assert.rejects(() => generateRequirements({ aggregate: blocked, runTask: async () => { count += 1; } }), /REQUIREMENTS_BLOCKED/);
  await assert.rejects(() => generateRequirements({ aggregate, runTask: async () => { count += 1; return { ...draft(), payload: { sections: [], requirements: [] } }; } }), /DOCUMENT_OUTPUT_INVALID/);
  assert.equal(count, 1);
});

test('classifies an unknown provider reference as a task response validation failure', async () => {
  await assert.rejects(
    generateRequirements({ aggregate, runTask: async () => ({ ...draft(), referencedItemIds: ['missing-item'] }) }),
    (error) => error.diagnostic?.task === 'REQUIREMENTS_DRAFT'
      && error.diagnostic?.category === 'references_invalid'
      && error.diagnostic?.details?.includes('$.referencedItemIds:unknown_item_reference'),
  );
});

test('rejects an acceptance criterion linked to a design item outside its planned requirement sources', async () => {
  const output = draft();
  const featureRequirement = output.payload.requirements.find((requirement) => requirement.sourceItemIds.includes('feature'));
  featureRequirement.acceptanceCriteria[0].sourceItemIds = ['problem'];
  await assert.rejects(
    generateRequirements({ aggregate, runTask: async (task) => task === 'REQUIREMENTS_DRAFT' ? output : review('pass') }),
    (error) => error.diagnostic?.task === 'REQUIREMENTS_DRAFT'
      && error.diagnostic?.category === 'requirements_draft_contract_invalid',
  );
});

test('keeps confirmed out of scope items only in the exclusions section', async () => {
  const scoped = structuredClone(aggregate);
  scoped.designItems.find((entry) => entry.id === 'out').acceptanceCriteria = [{ id:'excluded-ac', text:'제외 기능 완료', status:'confirmed' }];
  const result = await generateRequirements({ aggregate:scoped, runTask:async (task) => task === 'REQUIREMENTS_DRAFT' ? draft() : review('pass') });
  assert.equal(result.document.requirements.some((requirement)=>requirement.sourceItemIds.includes('out')),false);
  assert.ok(result.sections.find((section)=>section.key==='exclusions').sourceItemIds.includes('out'));
  assert.ok(result.sections.filter((section)=>section.key!=='exclusions').every((section)=>!section.sourceItemIds.includes('out')));
});


test('commits document, sections, job, ledger and activity atomically while marking revision drift stale', async () => {
  const result = await generateRequirements({ aggregate, logicalRequestId:'logical-request-0001', attemptId:'attempt-0001', runTask: async (task) => task === 'REQUIREMENTS_DRAFT' ? draft() : review('pass') });
  result.requestLedgerEntries = [{ id:'ledger-1', projectId:'p', task:'REQUIREMENTS_DRAFT' }];
  const priorDocument = { id:'prior', projectId:'p', type:'prd', title:'기존 PRD', status:'draft', designRevision:1, version:1, sectionIds:[], createdAt:at, updatedAt:at };
  const latest = { ...aggregate, documents:[priorDocument], sections:[], generationJobs:[], requestLedgerEntries:[], activityEntries:[] };
  const committed = commitRequirementsResult(latest, result, 2);
  assert.deepEqual(committed.documents.map(({id})=>id), ['prior', result.document.id]);
  assert.equal(committed.documents[1].status, 'review_required');
  assert.ok(committed.sections.every((section)=>section.syncStatus==='stale'));
  assert.equal(committed.generationJobs[0].status, 'succeeded');
  assert.equal(committed.requestLedgerEntries[0].id, 'ledger-1');
  assert.equal(committed.activityEntries[0].action, 'requirements_generated');
});
