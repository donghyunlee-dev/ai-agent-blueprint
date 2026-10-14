import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateGoldenFixture } from '../../../src/infrastructure/ai/golden-eval.js';

const validFixture = {
  id: 'turn-analyze-basic', task: 'TURN_ANALYZE', schemaVersion: 'v1',
  response: { blocks: [{ type: 'assistant_text', content: '확인했습니다.' }], proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } },
  manifest: { designItemIds: ['i1'], sourceExcerptIds: ['s1'], recentMessageIds: ['m1'], summaryIds: [] },
};

test('synthetic golden fixtures pass deterministic schema, reference, and forbidden-result gates', () => {
  assert.deepEqual(evaluateGoldenFixture(validFixture), { pass: true, errors: [] });
});

test('every task has a passing synthetic fixture without provider calls', async () => {
  const fixtures = JSON.parse(await readFile(new URL('../../eval/golden/core.fixture.json', import.meta.url), 'utf8'));
  assert.equal(fixtures.length, 13);
  for (const fixture of fixtures) assert.deepEqual(evaluateGoldenFixture(fixture), { pass: true, errors: [] }, fixture.id);
});

test('golden gate rejects invalid schema, unknown references, and model-authored confirmation outcomes', () => {
  const result = evaluateGoldenFixture({
    ...validFixture,
    response: { ...validFixture.response, unexpected: true, proposals: [{ operation: 'create', targetType: 'design_item', rationale: '근거', evidence: [], affectedItemIds: ['missing'], status: 'confirmed' }] },
  });
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.includes('schema')));
  assert.ok(result.errors.some((error) => error.includes('affectedItemIds: unknown item missing')));
  assert.ok(result.errors.some((error) => error.includes('confirmed status')));
});

test('golden gate validates nested Requirements and PRD source IDs', () => {
  const requirements = evaluateGoldenFixture({
    id: 'requirements-nested-reference', task: 'REQUIREMENTS_DRAFT', schemaVersion: 'v1',
    response: {
      sections: [{ key: 'scope', title: '범위', markdown: '설명', sourceItemIds: ['missing-section-item'] }],
      requirements: [{ id: 'REQ-1', category: 'functional', title: '기능', description: '설명', priority: 'P1', sourceItemIds: ['item-1'], acceptanceCriteria: [{ text: '검증', sourceItemIds: ['missing-ac-item'] }], openIssueIds: [] }],
    },
    manifest: { designItemIds: ['item-1'], sourceExcerptIds: [], recentMessageIds: [], summaryIds: [] }, targetContext: {},
  });
  assert.equal(requirements.pass, false);
  assert.ok(requirements.errors.some((error) => error.includes('sections[0].sourceItemIds')));
  assert.ok(requirements.errors.some((error) => error.includes('acceptanceCriteria[0].sourceItemIds')));
  const prd = evaluateGoldenFixture({
    id: 'prd-nested-reference', task: 'PRD_DRAFT', schemaVersion: 'v1',
    response: {
      sections: [{ key: 'goal', title: '목표', markdown: '설명', sourceItemIds: ['item-1'] }],
      requirementLinks: [{ sectionKey: 'goal', requirementIds: ['missing-requirement'] }],
      goals: [{ text: '목표', sourceItemIds: ['missing-goal-source'] }], successMetrics: [], risks: [],
    },
    manifest: { designItemIds: ['item-1'], sourceExcerptIds: [], recentMessageIds: [], summaryIds: [] },
    targetContext: { requirements: [{ id: 'REQ-1' }] },
  });
  assert.equal(prd.pass, false);
  assert.ok(prd.errors.some((error) => error.includes('unknown requirement')));
  assert.ok(prd.errors.some((error) => error.includes('goals[0].sourceItemIds')));
});

test('golden gate rejects readiness decisions in model output', () => {
  const result = evaluateGoldenFixture({
    ...validFixture,
    response: { blocks: [{ type: 'readiness_notice', readiness: { state: 'ready' } }], proposals: [], answerInterpretation: { additionalFacts: [], ambiguities: [] } },
  });
  assert.equal(result.pass, false);
  assert.ok(result.errors.some((error) => error.includes('readiness')));
});

test('golden gate rejects changes to canonical answer mode and stable option values', () => {
  const errors = evaluateGoldenFixture({
    ...validFixture,
    response: { ...validFixture.response, blocks: [{ type: 'question', id: 'q1', topic: '저장', prompt: '저장 방식?', answerMode: 'multiple', options: [{ value: 'redis', label: 'Redis' }], allowCustomAnswer: false, allowUnknown: true, allowDefer: true, required: true, targetItemTypes: ['technical_decision'] }] },
    manifest: { ...validFixture.manifest, currentQuestionId: 'q1' },
    targetContext: { question: { answerMode: 'single', options: [{ value: 'local', label: '로컬' }] } },
  });
  assert.equal(errors.pass, false);
  assert.ok(errors.errors.some((error) => error.includes('stable answer mode')));
  assert.ok(errors.errors.some((error) => error.includes('non-canonical stable value')));
});

test('golden gate rejects assistant-authored confirmation language but ignores quoted source text', () => {
  const response = {
    ...validFixture.response,
    blocks: [{ type: 'assistant_text', content: '이 내용은 확정되었습니다.' }],
    proposals: [{ operation: 'create', targetType: 'design_item', rationale: '요청을 검토합니다.', evidence: [{ sourceType: 'message', sourceId: 'm1', excerpt: '이 내용은 확정되었습니다.' }], affectedItemIds: [] }],
  };
  const prohibited = evaluateGoldenFixture({ ...validFixture, response });
  assert.equal(prohibited.pass, false);
  assert.ok(prohibited.errors.some((error) => error.includes('assistant text claims confirmation')));

  const quoted = evaluateGoldenFixture({
    ...validFixture,
    response: { ...response, blocks: [{ type: 'assistant_text', content: '원문에는 “이 내용은 확정되었습니다”라고 적혀 있지만, 아직 사용자 확인이 필요합니다.' }] },
  });
  assert.equal(quoted.pass, true);

  const english = evaluateGoldenFixture({
    ...validFixture,
    response: { ...validFixture.response, blocks: [{ type: 'assistant_text', content: 'This requirement is approved.' }] },
  });
  assert.equal(english.pass, false);
  assert.ok(english.errors.some((error) => error.includes('assistant text claims confirmation')));
});

test('golden runner is wired into the repository CI gate', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../../../package.json', import.meta.url), 'utf8'));
  assert.match(packageJson.scripts['test:ci'], /test:golden/);
  assert.equal(packageJson.scripts['test:golden'], 'node scripts/run-golden-eval.mjs');
});

test('golden fixtures reject unknown tasks and versions', () => {
  assert.equal(evaluateGoldenFixture({ ...validFixture, task: 'UNKNOWN' }).pass, false);
  assert.equal(evaluateGoldenFixture({ ...validFixture, schemaVersion: 'v9' }).pass, false);
});
