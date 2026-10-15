import type { BlueprintAggregate } from '../../domain/blueprint/types.js';
export const DESIGN_SECTIONS: readonly { key: string; title: string; itemTypes: string[]; requiredTypes?: string[]; conditional?: boolean }[];
export interface DesignReadinessBlocker { key: string; title: string; itemIds: string[]; reason: string }
export interface DesignReadinessArea { key: string; title: string; itemTypes: string[]; status: 'missing' | 'deferred' | 'not_applicable' | 'confirmed' | 'review_required' | 'proposed' | 'conflict' | 'not_required'; itemIds: string[]; blockers: DesignReadinessBlocker[] }
export interface DesignReadiness { state: 'insufficient' | 'workable' | 'ready'; areas: DesignReadinessArea[]; blockers: DesignReadinessBlocker[]; pendingProposalCount: number; conflictCount: number; deferredCount: number; canGenerateRequirements: boolean }
export function computeDesignReadiness(aggregate: BlueprintAggregate): DesignReadiness;
