import crypto from 'node:crypto';

function secret() {
  const value = process.env.APP_SESSION_SECRET;
  if (!value) throw new Error('APP_SESSION_SECRET_NOT_CONFIGURED');
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
export function requirementsDigest(document, sections) {
  const copy = structuredClone({ document, sections });
  for (const key of ['status', 'readyAt', 'readyDesignRevision', 'readyConfirmationArtifact', 'generationArtifact', 'updatedAt']) delete copy.document[key];
  return crypto.createHash('sha256').update(JSON.stringify(canonical(copy))).digest('hex');
}
function actor(user) { return crypto.createHmac('sha256', secret()).update(`${user.issuer}\0${user.subject}`).digest('hex'); }
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
function verify(token, kind) {
  if (typeof token !== 'string' || token.length > 12000) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = Buffer.from(crypto.createHmac('sha256', secret()).update(body).digest('base64url'));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try { const payload = JSON.parse(Buffer.from(body, 'base64url').toString()); return payload.kind === kind ? payload : null; } catch { return null; }
}
function payload(user, projectId, document, sections, kind) {
  return { kind, projectId, documentId: document.id, designRevision: document.designRevision, digest: requirementsDigest(document, sections), actor: actor(user), issuedAt: Date.now() };
}
function matches(proof, user, projectId, document, sections, kind) {
  if (!proof || proof.kind !== kind || proof.projectId !== projectId || proof.documentId !== document.id || proof.designRevision !== document.designRevision || proof.digest !== requirementsDigest(document, sections) || proof.actor !== actor(user) || Date.now() - proof.issuedAt > 24 * 60 * 60 * 1000) return false;
  return true;
}
export function issueRequirementsGenerationArtifact(user, projectId, document, sections) { return sign(payload(user, projectId, document, sections, 'requirements-generation')); }
export function verifyRequirementsGenerationArtifact(user, projectId, document, sections, token) { return matches(verify(token, 'requirements-generation'), user, projectId, document, sections, 'requirements-generation'); }
export function issueRequirementsReadyArtifact(user, projectId, document, sections, generationArtifact) {
  if (!verifyRequirementsGenerationArtifact(user, projectId, document, sections, generationArtifact)) return null;
  return sign(payload(user, projectId, document, sections, 'requirements-ready-confirmation'));
}
export function verifyRequirementsReadyArtifact(user, projectId, document, sections, generationArtifact, readyArtifact) {
  return verifyRequirementsGenerationArtifact(user, projectId, document, sections, generationArtifact) && matches(verify(readyArtifact, 'requirements-ready-confirmation'), user, projectId, document, sections, 'requirements-ready-confirmation');
}

function proposalDigest(proposal) {
  const evidence = (proposal.evidence ?? []).map(({ sourceType, sourceId, excerpt, location }) => ({ sourceType, sourceId, ...(excerpt === undefined ? {} : { excerpt }), ...(location === undefined ? {} : { location }) }));
  const value = { operation: proposal.operation, targetType: proposal.targetType, targetId: proposal.targetId, before: proposal.before, after: proposal.after, rationale: proposal.rationale, evidence, affectedItemIds: proposal.affectedItemIds };
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function issueDocumentPatchProposalArtifact(user, projectId, document, proposal, logicalRequestId) {
  return sign({ kind: 'document-patch-proposal', projectId, documentId: document.id, documentVersion: document.version, designRevision: document.designRevision, logicalRequestId, digest: proposalDigest(proposal), actor: actor(user), issuedAt: Date.now() });
}
export function verifyDocumentPatchProposalArtifact(user, projectId, document, proposal, logicalRequestId, token) {
  const proof = verify(token, 'document-patch-proposal');
  return Boolean(proof && proof.projectId === projectId && proof.documentId === document.id && proof.documentVersion === document.version
    && proof.designRevision === document.designRevision && proof.logicalRequestId === logicalRequestId && proof.digest === proposalDigest(proposal)
    && proof.actor === actor(user) && Date.now() - proof.issuedAt <= 24 * 60 * 60 * 1000);
}
