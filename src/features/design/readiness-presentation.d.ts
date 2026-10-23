import type { DesignReadiness, DesignReadinessArea, DesignReadinessBlocker } from './readiness.js';

export type ReadinessGroupKey =
  | 'product_and_problem'
  | 'users'
  | 'features_and_scope'
  | 'data_and_integrations'
  | 'security_and_operations';

export interface ReadinessPresentationGroup {
  key: ReadinessGroupKey;
  title: string;
  areaKeys: string[];
  status: DesignReadinessArea['status'];
  itemIds: string[];
  blockers: DesignReadinessBlocker[];
}

export function buildReadinessPresentationGroups(readiness: DesignReadiness): ReadinessPresentationGroup[];
