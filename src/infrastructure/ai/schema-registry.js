import { schemas } from './schemas/index.js';

const entries = Object.entries(schemas.tasks).flatMap(([task, schema]) => {
  const id = `${task.toLowerCase().replaceAll('_', '.')}.v1`;
  if (task === 'TURN_ANALYZE') return [
    ['turn.analyze.v1:v1', Object.freeze({ id: 'turn.analyze.v1', version: 'v1', task, schema: schemas.turnAnalyzeV2 })],
    ['turn.analyze.v2:v2', Object.freeze({ id: 'turn.analyze.v2', version: 'v2', task, schema: schemas.turnAnalyzeV2 })],
    ['turn.analyze.v3:v3', Object.freeze({ id: 'turn.analyze.v3', version: 'v3', task, schema: schemas.turnAnalyzeV4 })],
    ['turn.analyze.v4:v4', Object.freeze({ id: 'turn.analyze.v4', version: 'v4', task, schema: schemas.turnAnalyzeV4 })],
    ['turn.analyze.v5:v5', Object.freeze({ id: 'turn.analyze.v5', version: 'v5', task, schema })],
  ];
  if (task === 'OPTION_RECOMMEND') return [
    ['option.recommend.v1:v1', Object.freeze({ id: 'option.recommend.v1', version: 'v1', task, schema: schemas.optionRecommendV1 })],
    ['option.recommend.v2:v2', Object.freeze({ id: 'option.recommend.v2', version: 'v2', task, schema: schemas.optionRecommendV2 })],
    ['option.recommend.v3:v3', Object.freeze({ id: 'option.recommend.v3', version: 'v3', task, schema: schemas.optionRecommendV3 })],
    ['option.recommend.v4:v4', Object.freeze({ id: 'option.recommend.v4', version: 'v4', task, schema: schemas.optionRecommendV4 })],
    ['option.recommend.v5:v5', Object.freeze({ id: 'option.recommend.v5', version: 'v5', task, schema })],
  ];
  if (task === 'PRD_REVIEW') return [[`${id}:v1`, Object.freeze({ id, version: 'v1', task, schema: schemas.tasks.REQUIREMENTS_REVIEW })], ['prd.review.v2:v2', Object.freeze({ id: 'prd.review.v2', version: 'v2', task, schema })]];
  if (task === 'CONSISTENCY_REVIEW') {
    const legacy = { type: 'array', items: { type: 'object', properties: { type: { type: 'string', minLength: 1 }, location: { type: 'string', minLength: 1 }, sourceItemIds: { type: 'array', items: { type: 'string', minLength: 1 } }, proposal: { type: 'object' } }, required: ['type', 'location', 'sourceItemIds'], additionalProperties: false } };
    return [[`${id}:v1`, Object.freeze({ id, version: 'v1', task, schema: legacy })], ['consistency.review.v2:v2', Object.freeze({ id: 'consistency.review.v2', version: 'v2', task, schema })]];
  }
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
