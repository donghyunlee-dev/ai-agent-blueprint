import type { BlueprintAggregate, ProjectSummary } from '../../domain/blueprint/types.js';

export function createBlueprintAggregate(bundle: { project: BlueprintAggregate['project']; thread: BlueprintAggregate['thread']; message: BlueprintAggregate['messages'][number] }): BlueprintAggregate;
export function projectSummaryFromAggregate(aggregate: BlueprintAggregate): ProjectSummary;
export function projectSummaryFromProject(project: BlueprintAggregate['project']): ProjectSummary;
export function validateBlueprintAggregate(ownerKey: string, aggregate: BlueprintAggregate): true;
export function sortRecentProjectSummaries(summaries: ProjectSummary[]): ProjectSummary[];
export function recentProjectPage(summaries: ProjectSummary[], expanded?: boolean): { items: ProjectSummary[]; hasMore: boolean; total: number };
export function projectLimitDecision(summaries: ProjectSummary[], currentProjectId?: string | null): { action: 'create' } | { action: 'confirm_delete'; project: ProjectSummary };
