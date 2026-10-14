import { schemas } from './schemas/index.js';

const definitions = Object.freeze(Object.fromEntries(Object.entries(schemas.tasks).map(([task, schema]) => {
  const id = `${task.toLowerCase().replaceAll('_', '.')}.v1`;
  return [`${id}:v1`, Object.freeze({ id, version: 'v1', task, schema })];
})));

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
