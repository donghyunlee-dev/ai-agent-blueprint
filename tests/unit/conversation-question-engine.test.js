import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuestionAnswerRecord, QUESTION_CATALOG, getAnswerReviewState, getQuestionCandidates, rankQuestionCandidates, resolveQuestionForDisplay, selectNextQuestion, validateQuestionAnswer } from '../../src/features/conversation/questionEngine.js';

const aggregate = (overrides = {}) => ({
  project: { readiness: { pendingProposalCount: 0 } }, answers: [], designItems: [],
  ...overrides,
});

test('catalog covers 12 design areas and all seven answer modes', () => {
  assert.equal(new Set(QUESTION_CATALOG.map((item) => item.area)).size, 12);
  assert.deepEqual(new Set(QUESTION_CATALOG.map((item) => item.answerMode)), new Set(['single', 'multiple', 'text', 'number', 'range', 'rank', 'confirm']));
  assert.ok(QUESTION_CATALOG.every((item) => item.targetItemTypes.length && item.allowedAnswerModes.includes(item.answerMode)));
});

test('selection is deterministic, excludes answered meanings, and prioritizes required high impact questions', () => {
  const first = selectNextQuestion(aggregate());
  assert.equal(first.id, 'problem');
  assert.deepEqual(selectNextQuestion(aggregate()), first);
  assert.notEqual(selectNextQuestion(aggregate({ answers: [{ questionId: 'problem', action: 'answer', customText: '중복 예약' }] })).id, 'problem');
});

test('confirmed semantic target suppresses only its matching question, not a sibling topic', () => {
  const candidates = getQuestionCandidates(aggregate({ designItems: [
    { status: 'confirmed', key: 'data.persistence', attributes: {} },
  ] }));
  assert.ok(!candidates.some(({ id }) => id === 'data-needed'));
  assert.ok(candidates.some(({ id }) => id === 'database-type') === false);
  const topicSibling = getQuestionCandidates(aggregate({
    answers: [{ questionId: 'data-needed', action: 'answer', selectedValues: ['yes'] }],
    designItems: [{ status: 'confirmed', key: 'data.persistence', attributes: {} }],
  }));
  assert.ok(!topicSibling.some(({ id }) => id === 'data-needed'));
  assert.ok(topicSibling.some(({ id }) => id === 'database-type'));
});

test('recent message context ranks matching areas and fatigue lowers recently repeated areas', () => {
  const problem = QUESTION_CATALOG.find(({ id }) => id === 'problem');
  const user = QUESTION_CATALOG.find(({ id }) => id === 'user-role');
  const goal = QUESTION_CATALOG.find(({ id }) => id === 'goal');
  assert.deepEqual(rankQuestionCandidates([goal, problem, user], aggregate()).map(({ id }) => id), ['problem', 'user-role', 'goal']);
  assert.equal(rankQuestionCandidates([problem, user, goal], aggregate({ messages: [{ role: 'user', content: '고객 사용자 역할을 알려드립니다.' }] }))[0].id, 'user-role');
  const priority = QUESTION_CATALOG.find(({ id }) => id === 'feature-priority');
  const integrations = QUESTION_CATALOG.find(({ id }) => id === 'integrations');
  assert.equal(rankQuestionCandidates([priority, integrations], aggregate({ answers: [{ questionId: 'core-features', action: 'answer' }] }))[0].id, 'integrations');
});

test('conditional login and database questions only appear when needed', () => {
  assert.ok(!getQuestionCandidates(aggregate()).some(({ id }) => ['login-method', 'database-type'].includes(id)));
  const yes = aggregate({ answers: [
    { questionId: 'login-needed', action: 'answer', selectedValues: ['yes'] },
    { questionId: 'data-needed', action: 'answer', selectedValues: ['yes'] },
  ] });
  assert.ok(getQuestionCandidates(yes).some(({ id }) => id === 'login-method'));
  assert.ok(getQuestionCandidates(yes).some(({ id }) => id === 'database-type'));
  const noLogin = aggregate({ answers: [{ questionId: 'login-needed', action: 'answer', selectedValues: ['no'] }] });
  assert.ok(!getQuestionCandidates(noLogin).some(({ id }) => id === 'login-method'));
  const latestDeferredLogin = aggregate({ answers: [
    { questionId: 'login-needed', action: 'answer', selectedValues: ['yes'] },
    { questionId: 'login-needed', action: 'defer' },
  ] });
  assert.ok(!getQuestionCandidates(latestDeferredLogin).some(({ id }) => id === 'login-method'));
});

test('prerequisite changes preserve dependent answers and reoffer an active dependent question for review', () => {
  const now = new Date().toISOString();
  const aggregateWithDependency = aggregate({ answers: [
    { id: 'login-answer-old', questionId: 'login-needed', action: 'answer', selectedValues: ['yes'], createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'login-method-old', questionId: 'login-method', action: 'answer', selectedValues: ['google'], createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'login-answer-new', questionId: 'login-needed', action: 'answer', selectedValues: ['no'], createdAt: now },
  ] });
  assert.equal(getAnswerReviewState(aggregateWithDependency, aggregateWithDependency.answers[1]).reviewRequired, true);
  assert.equal(aggregateWithDependency.answers.length, 3);
  assert.ok(!getQuestionCandidates(aggregateWithDependency).some(({ id }) => id === 'login-method'));
  aggregateWithDependency.answers.push({ id: 'login-answer-latest', questionId: 'login-needed', action: 'answer', selectedValues: ['yes'], createdAt: new Date(Date.now() + 1000).toISOString() });
  assert.equal(getAnswerReviewState(aggregateWithDependency, aggregateWithDependency.answers[1]).reviewRequired, true);
  assert.ok(getQuestionCandidates(aggregateWithDependency).some(({ id }) => id === 'login-method'));
  assert.equal(selectNextQuestion(aggregateWithDependency).id, 'login-method');
  const unchangedPrerequisite = aggregate({ answers: [
    { questionId: 'login-needed', action: 'answer', selectedValues: ['yes'] },
    { questionId: 'login-method', action: 'answer', selectedValues: ['google'] },
    { questionId: 'login-needed', action: 'answer', selectedValues: ['yes'] },
  ] });
  assert.equal(getAnswerReviewState(unchangedPrerequisite, unchangedPrerequisite.answers[1]).reviewRequired, false);
});

test('pending proposals gate system question selection', () => {
  assert.equal(selectNextQuestion(aggregate({ project: { readiness: { pendingProposalCount: 1 } } })), null);
});

test('each answer mode accepts valid values and rejects missing, invalid, or out-of-range values', () => {
  const base = QUESTION_CATALOG.find(({ id }) => id === 'problem');
  assert.equal(validateQuestionAnswer(base, { action: 'answer' }).valid, false);
  assert.equal(validateQuestionAnswer(base, { action: 'answer', customText: '  중복 예약 문제 ' }).valid, true);
  const single = QUESTION_CATALOG.find(({ id }) => id === 'data-needed');
  assert.equal(validateQuestionAnswer(single, { action: 'answer', selectedValues: ['yes'] }).valid, true);
  assert.equal(validateQuestionAnswer(single, { action: 'answer', selectedValues: ['unknown'] }).valid, false);
  const multiple = QUESTION_CATALOG.find(({ id }) => id === 'core-features');
  assert.equal(validateQuestionAnswer(multiple, { action: 'answer', selectedValues: ['chart', 'table'] }).valid, true);
  assert.equal(validateQuestionAnswer(multiple, { action: 'answer', selectedValues: ['chart', 'table', 'upload', 'report', 'alert', 'auto'] }).valid, false);
  const number = QUESTION_CATALOG.find(({ id }) => id === 'usage-volume');
  assert.equal(validateQuestionAnswer(number, { action: 'answer', numberValue: 1 }).valid, true);
  assert.equal(validateQuestionAnswer(number, { action: 'answer', numberValue: 10000001 }).valid, false);
  assert.equal(validateQuestionAnswer(number, { action: 'answer', numberValue: 0 }).valid, false);
  const rank = QUESTION_CATALOG.find(({ id }) => id === 'feature-priority');
  assert.equal(validateQuestionAnswer(rank, { action: 'answer', rankedValues: ['chart', 'table'] }).valid, true);
  assert.equal(validateQuestionAnswer(rank, { action: 'answer', rankedValues: ['chart'] }).valid, false);
  assert.equal(validateQuestionAnswer(rank, { action: 'answer', rankedValues: ['a', 'a'] }).valid, false);
  const range = QUESTION_CATALOG.find(({ id }) => id === 'volume-range');
  assert.equal(validateQuestionAnswer(range, { action: 'answer', rangeValue: { start: 0, end: 100 } }).valid, true);
  assert.equal(validateQuestionAnswer(range, { action: 'answer', rangeValue: { start: 10, end: 2 } }).valid, false);
  const confirm = QUESTION_CATALOG.find(({ id }) => id === 'scope');
  assert.ok(!confirm.options.some(({ label }) => label.includes('결정하지 않음')));
  assert.equal(validateQuestionAnswer(confirm, { action: 'answer', selectedValues: ['핵심 업무만'] }).valid, true);
  assert.equal(validateQuestionAnswer(confirm, { action: 'answer' }).valid, false);
  assert.equal(validateQuestionAnswer(base, { action: 'unknown' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'recommend' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'defer' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'skip' }).valid, false);
  const optional = QUESTION_CATALOG.find(({ id }) => id === 'usage-volume');
  assert.equal(validateQuestionAnswer(optional, { action: 'skip' }).valid, true);
  assert.throws(() => getQuestionCandidates(aggregate(), { answerMode: 'agent_custom' }), /QUESTION_SCHEMA_INVALID/);
  assert.throws(() => resolveQuestionForDisplay({ ...base, answerMode: 'agent_custom' }), /QUESTION_SCHEMA_INVALID/);
  const staleMultiple = QUESTION_CATALOG.find(({ id }) => id === 'core-features');
  const staleFallback = resolveQuestionForDisplay({ ...staleMultiple, catalogVersion: 'old' });
  assert.equal(staleFallback.answerMode, 'text');
  assert.deepEqual(staleFallback.allowedAnswerModes, ['text']);
  assert.equal(validateQuestionAnswer(staleFallback, { action: 'answer', customText: '안전한 직접 입력' }).valid, true);
  assert.equal(staleMultiple.answerMode, 'multiple');
  const savedFallbackAnswer = createQuestionAnswerRecord({
    id: 'answer-fallback', projectId: 'project-1', threadId: 'thread-1', question: staleMultiple,
    answer: { action: 'answer', selectedValues: [], customText: '  안전한 직접 입력  ' },
    effectiveAnswerMode: staleFallback.answerMode, createdAt: '2026-10-14T00:00:00.000Z',
  });
  assert.deepEqual(savedFallbackAnswer, {
    id: 'answer-fallback', projectId: 'project-1', threadId: 'thread-1', questionId: 'core-features',
    logicalRequestId: 'answer-fallback', answerMode: 'text', action: 'answer',
    createdAt: '2026-10-14T00:00:00.000Z', customText: '안전한 직접 입력',
  });
});
