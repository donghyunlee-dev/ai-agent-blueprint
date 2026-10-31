import test from 'node:test';
import assert from 'node:assert/strict';
import { documentGenerationErrorMessage } from '../../src/features/documents/document-generation-error.js';

test('shows a specific safe message for request-store outages', () => {
  assert.equal(
    documentGenerationErrorMessage('AUTH_STORE_UNAVAILABLE', 'requirements'),
    '요청 상태 저장소에 연결할 수 없어 요구사항 명세를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  );
});

test('shows distinct safe messages for rate limits and incomplete output', () => {
  assert.match(documentGenerationErrorMessage('AI_RATE_LIMITED', 'prd'), /요청 한도/);
  assert.match(documentGenerationErrorMessage('AI_OUTPUT_INCOMPLETE', 'prd'), /응답이 끝까지 생성되지 않았습니다/);
});

test('uses a generic message for unknown server codes without echoing them', () => {
  const message = documentGenerationErrorMessage('private-provider-detail', 'requirements');
  assert.match(message, /요구사항 명세를 생성하지 못했습니다/);
  assert.doesNotMatch(message, /private-provider-detail/);
});
