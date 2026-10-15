import type { BlueprintAggregate, ChangeProposal } from '../../domain/blueprint/types.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';
type Input = { ownerKey: string; projectId: string; repository: ProjectRepository; now?: () => string; idFactory?: () => string };
export function proposalCurrentSnapshot(aggregate: BlueprintAggregate, proposal: ChangeProposal): Record<string, unknown> | null;
export function classifyProposalConflicts(aggregate: BlueprintAggregate): { approvalCandidates: ChangeProposal[]; excluded: { proposal: ChangeProposal; reason: string }[]; conflictIds: string[] };
export function getBulkApprovalCandidates(aggregate: BlueprintAggregate): ReturnType<typeof classifyProposalConflicts>;
export function resolveProposalConflict(input: Input & { proposalId: string; choice: 'keep_current' | 'accept_proposed' | 'edit'; expectedCurrent: Record<string, unknown> | null; editedValue?: Record<string, unknown> }): Promise<{ status: string; aggregate?: BlueprintAggregate; proposal?: ChangeProposal }>;
export function bulkApproveProposals(input: Input & { proposalIds: string[] }): Promise<{ status: string; aggregate?: BlueprintAggregate; appliedIds: string[] }>;
export function bulkRejectProposals(input: Input & { proposalIds: string[] }): Promise<{ status: string; aggregate?: BlueprintAggregate; appliedIds: string[] }>;
