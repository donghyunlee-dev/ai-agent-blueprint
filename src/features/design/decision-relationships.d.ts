import type { BlueprintAggregate } from '../../domain/blueprint/types.js';

export function setDecisionRelationship(
  aggregate: BlueprintAggregate,
  sourceId: string,
  targetId: string,
  linked: boolean,
  now: string,
): { status: 'updated' | 'unchanged' | 'invalid_target'; aggregate: BlueprintAggregate };
