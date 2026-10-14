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
  if (fixture.manifest) {
    const referenceResult = validateReferences(fixture.response, fixture.manifest, fixture.targetContext);
    errors.push(...referenceResult.errors);
  }
  for (const forbidden of fixture.forbiddenResults ?? []) errors.push(`forbidden result: ${forbidden}`);
  return { pass: errors.length === 0, errors };
}
