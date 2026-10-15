import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequirementsPlan, validateRequirementsPlan } from '../../src/features/documents/document-plan.js';

const item = (id, type, status = 'confirmed', extra = {}) => ({
  id, type, title: id, description: `${id} 설명`, status, priority: 'must', acceptanceCriteria: [],
  relatedItemIds: [], attributes: {}, ...extra,
});
const ready = {
  project: { id: 'p', title: '제품', designRevision: 3 },
  designItems: [
    item('product', 'product_definition'), item('problem', 'problem'), item('goal', 'goal'), item('user', 'user_role'), item('scenario', 'scenario'),
    item('feature', 'requirement', 'confirmed', { acceptanceCriteria: [{ id: 'ac-1', text: '결과가 표시된다', status: 'confirmed' }] }),
    item('scope', 'scope'), item('exclusions', 'out_of_scope'), item('success', 'success_metric'), item('risk', 'risk'),
    item('deferred', 'technical_decision', 'deferred'), item('proposed', 'goal', 'proposed'), item('rejected', 'risk', 'rejected'),
  ],
  proposals: [{ id: 'pending', status: 'pending', after: { title: '절대 포함하지 않음' } }],
};

test('builds every required section and traces confirmed core acceptance criteria while preserving explicit deferrals', () => {
  const plan = buildRequirementsPlan(ready);
  assert.equal(plan.designRevision, 3);
  assert.equal(plan.sections.length, 11);
  assert.ok(plan.requirements.some((entry) => entry.sourceItemIds.includes('feature') && entry.acceptanceCriteria.includes('ac-1')));
  assert.ok(plan.openIssues.some((issue) => issue.sourceItemIds.includes('deferred')));
  assert.equal(plan.requirements.some((entry) => entry.sourceItemIds.includes('proposed')), false);
  assert.equal(plan.requirements.some((entry) => entry.sourceItemIds.includes('rejected')), false);
  assert.equal(plan.requirements.some((entry) => entry.sourceItemIds.includes('exclusions')), false);
  assert.ok(plan.sections.find((section) => section.key === 'exclusions').sourceItemIds.includes('exclusions'));
  assert.equal(plan.openIssues.some((issue) => issue.sourceItemIds.includes('pending')), false);
  assert.equal(validateRequirementsPlan(plan, ready).valid, true);
});

test('out of scope items are preserved only in exclusions and cannot become P0 requirements', () => {
  const outOfScope = item('excluded-feature', 'out_of_scope', 'confirmed', { priority: 'must', acceptanceCriteria: [{ id: 'excluded-ac', text: '금지', status: 'confirmed' }] });
  const aggregate = { ...ready, designItems: [...ready.designItems, outOfScope] };
  const plan = buildRequirementsPlan(aggregate);
  assert.equal(plan.requirements.some((requirement) => requirement.sourceItemIds.includes(outOfScope.id)), false);
  assert.equal(plan.acceptanceCriterionIds.includes('excluded-ac'), false);
  assert.deepEqual(plan.sections.find((section) => section.key === 'exclusions').sourceItemIds, ['exclusions', outOfScope.id]);
  assert.equal(validateRequirementsPlan(plan, aggregate).valid, true);
});

test('rejects plan coverage gaps before a draft can be requested', () => {
  const plan = buildRequirementsPlan(ready);
  const broken = { ...plan, requirements: plan.requirements.filter((entry) => !entry.acceptanceCriteria.includes('ac-1')) };
  const result = validateRequirementsPlan(broken, ready);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /ac-1/);
});
