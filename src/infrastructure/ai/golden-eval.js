import { validateReferences } from './context-manifest.js';
import { getSchemaDefinition } from './schema-registry.js';
import { validateSchema } from './schemas/index.js';

export function evaluateGoldenFixture(fixture) {
  const errors = [];
  if (!fixture || typeof fixture.id !== 'string' || typeof fixture.task !== 'string') return { pass: false, errors: ['fixture id and task are required'] };
  const schemaId = `${fixture.task.toLowerCase().replaceAll('_', '.')}.v1`;
  let schema;
  try { schema = getSchemaDefinition(schemaId, fixture.schemaVersion); }
  catch { return { pass: false, errors: [`unknown task/schema version: ${fixture.task} ${fixture.schemaVersion}`] }; }
  const schemaResult = validateSchema(schema, fixture.response);
  if (!schemaResult.valid) errors.push(...schemaResult.errors.map((error) => `schema: ${error}`));
  const referenceResult = validateReferences(fixture.response, fixture.manifest, fixture.targetContext);
  errors.push(...referenceResult.errors);
  errors.push(...inspectProhibitedOutcomes(fixture.response, fixture.targetContext));
  return { pass: errors.length === 0, errors };
}

export function inspectProhibitedOutcomes(response, targetContext = {}) {
  const errors = [];
  const canonicalQuestion = targetContext.question ?? targetContext.currentQuestion;
  const canonicalOptionValues = canonicalQuestion?.options?.map((option) => option.value);
  const visit = (value, path = '$') => {
    if (Array.isArray(value)) { value.forEach((item, index) => visit(item, `${path}[${index}]`)); return; }
    if (!value || typeof value !== 'object') return;
    if (value.type === 'readiness_notice' || Object.hasOwn(value, 'readiness')) errors.push(`${path}: model output cannot determine readiness`);
    if (value.canComplete === true) errors.push(`${path}.canComplete: model output cannot determine completion`);
    if (value.status === 'confirmed' || value.status === 'accepted' || value.status === 'edited_and_accepted') {
      errors.push(`${path}.status: model output cannot assign ${value.status} status`);
    }
    if (value.action === 'mark_requirements_ready' || value.action === 'download_document') {
      errors.push(`${path}.action: model output cannot approve readiness or document release`);
    }
    if (value.type === 'assistant_text' && typeof value.content === 'string' && assertsConfirmation(value.content)) {
      errors.push(`${path}.content: assistant text claims confirmation or approval`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'answerMode' && canonicalQuestion?.answerMode && child !== canonicalQuestion.answerMode) errors.push(`${path}.answerMode: model output changed the stable answer mode`);
      if ((key === 'value' || key === 'recommendedValue') && canonicalOptionValues && !canonicalOptionValues.includes(child)) errors.push(`${path}.${key}: model output introduced a non-canonical stable value`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(response);
  return errors;
}

function assertsConfirmation(text) {
  const withoutQuotedText = text
    .replace(/“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|«[^»]*»|"[^"\n]*"|'[^'\n]*'|`[^`]*`/gs, ' ')
    .replace(/^\s*>.*$/gm, ' ');
  const koreanClaim = /(?:확정(?:되었|됐)(?:습니다|어요|다)?|확정입니다|승인(?:되었|됐)(?:습니다|어요|다)?|승인되었습니다|승인됐습니다)/u;
  const englishClaim = /\b(?:(?:this|that|the\s+(?:item|requirement|proposal|design|feature|content))\s+)?(?:is|was|has been|has now been)\s+(?:confirmed|approved|finalized)\b/i;
  return koreanClaim.test(withoutQuotedText) || englishClaim.test(withoutQuotedText);
}
