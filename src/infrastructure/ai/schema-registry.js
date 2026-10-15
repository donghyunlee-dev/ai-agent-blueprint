import { schemas } from './schemas/index.js';

const entries = Object.entries(schemas.tasks).flatMap(([task, schema]) => {
  const id = `${task.toLowerCase().replaceAll('_', '.')}.v1`;
  if (task === 'PRD_REVIEW') return [[`${id}:v1`, Object.freeze({ id, version: 'v1', task, schema: schemas.tasks.REQUIREMENTS_REVIEW })], ['prd.review.v2:v2', Object.freeze({ id: 'prd.review.v2', version: 'v2', task, schema })]];
  return [[`${id}:v1`, Object.freeze({ id, version: 'v1', task, schema })]];
});
const definitions = Object.freeze(Object.fromEntries(entries));

export function getSchemaDefinition(id, version = 'v1') {
  const definition = definitions[`${id}:${version}`];
  if (!definition) throw new Error(`Unknown AI schema version: ${id} ${version}`);
  return definition.schema;
}

export function getSchemaDefinitionAtVersion(id, version) {
  return getSchemaDefinition(id, version);
}

export function getSchemaRegistry() {
  return definitions;
}
