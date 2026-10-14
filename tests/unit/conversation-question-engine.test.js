import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_CATALOG, getQuestionCandidates, resolveQuestionForDisplay, selectNextQuestion, validateQuestionAnswer } from '../../src/features/conversation/questionEngine.js';

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
  assert.equal(validateQuestionAnswer(confirm, { action: 'answer', selectedValues: ['핵심 업무만'] }).valid, true);
  assert.equal(validateQuestionAnswer(confirm, { action: 'answer' }).valid, false);
  assert.equal(validateQuestionAnswer(base, { action: 'unknown' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'recommend' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'defer' }).valid, true);
  assert.equal(validateQuestionAnswer(base, { action: 'skip' }).valid, false);
  assert.throws(() => getQuestionCandidates(aggregate(), { answerMode: 'agent_custom' }), /QUESTION_SCHEMA_INVALID/);
  assert.throws(() => resolveQuestionForDisplay({ ...base, answerMode: 'agent_custom' }), /QUESTION_SCHEMA_INVALID/);
  assert.equal(resolveQuestionForDisplay({ ...base, catalogVersion: 'old' }).answerMode, 'text');
});
