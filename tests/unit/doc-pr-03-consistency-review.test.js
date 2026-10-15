import test from 'node:test';
import assert from 'node:assert/strict';
import { commitConsistencyReview } from '../../src/features/documents/consistency-review.js';

function aggregate() {
  return { project: { id: 'p1', designRevision: 4, readiness: { pendingProposalCount: 0 } }, documents: [{ id: 'req1', version: 2 }, { id: 'prd1', version: 1 }], proposals: [], requestLedgerEntries: [] };
}

test('consistency result racing with document revision change stores neither findings proposals nor ledger', async () => {
  const current = aggregate();
  current.documents[0].version = 3; // Changed after the captured review snapshot and before the storage transaction.
  let mutationResult;
  const repository = { async transact(_owner, _project, mutate) { mutationResult = mutate(current); return mutationResult; } };
  const result = await commitConsistencyReview({
    ownerKey: 'owner', projectId: 'p1', repository, designRevision: 4,
    documentVersions: { req1: 2, prd1: 1 },
    proposals: [{ id: 'proposal-1', status: 'pending' }],
    requestLedgerEntries: [{ id: 'ledger-1' }],
  });
  assert.equal(result.status, 'stale');
  assert.equal(result.aggregate, undefined);
  assert.equal(mutationResult.aggregate, undefined);
  assert.deepEqual(current.proposals, []);
  assert.deepEqual(current.requestLedgerEntries, []);
});

test('consistency findings and ledger are committed atomically when the captured snapshot is still current', async () => {
  const current = aggregate();
  const repository = { async transact(_owner, _project, mutate) { return mutate(current); } };
  const result = await commitConsistencyReview({
    ownerKey: 'owner', projectId: 'p1', repository, designRevision: 4,
    documentVersions: { req1: 2, prd1: 1 },
    proposals: [{ id: 'proposal-1', status: 'pending' }],
    requestLedgerEntries: [{ id: 'ledger-1' }],
  });
  assert.equal(result.status, 'updated');
  assert.deepEqual(result.aggregate.proposals.map((proposal) => proposal.id), ['proposal-1']);
  assert.deepEqual(result.aggregate.requestLedgerEntries.map((entry) => entry.id), ['ledger-1']);
});
