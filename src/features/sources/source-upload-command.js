import { extractSourceFile } from './source-extraction.js';
import { countActiveSources, MAX_ACTIVE_SOURCES, SOURCE_ERROR_MESSAGES, validateSourceFile } from './source-validation.js';

function createId() { return globalThis.crypto.randomUUID(); }

function setSourceStatus(aggregate, sourceId, changes) {
  const found = aggregate.sources.some((source) => source.id === sourceId);
  if (!found) return { status: 'missing_source' };
  return {
    status: 'updated',
    aggregate: {
      ...aggregate,
      project: { ...aggregate.project, updatedAt: new Date().toISOString() },
      sources: aggregate.sources.map((source) => source.id === sourceId ? { ...source, ...changes } : source),
    },
  };
}

async function extractAndPersist({ ownerKey, projectId, row, file, validation, repository, onAggregate, extract }) {
  try {
    const extracting = await repository.transact(ownerKey, projectId, (latest) => setSourceStatus(latest, row.id, { extractionStatus: 'extracting', errorCode: undefined }));
    if (!extracting?.aggregate) throw new Error('STORAGE_FAILED');
    onAggregate?.(extracting.aggregate);
    const extracted = await extract(file, validation.extension);
    const persisted = await repository.transact(ownerKey, projectId, (latest) => setSourceStatus(latest, row.id, extracted));
    if (!persisted?.aggregate) throw new Error('STORAGE_FAILED');
    onAggregate?.(persisted.aggregate);
    const saved = persisted.aggregate.sources.find((source) => source.id === row.id);
    return { ...saved, message: SOURCE_ERROR_MESSAGES[saved.errorCode] ?? '' };
  } catch {
    return { ...row, extractionStatus: 'failed', errorCode: 'STORAGE_FAILED', message: SOURCE_ERROR_MESSAGES.STORAGE_FAILED };
  }
}

export async function addSourceFiles({ ownerKey, projectId, files, repository, onAggregate, extract = extractSourceFile }) {
  if (!ownerKey || !projectId || !repository) throw new Error('SOURCE_CONTEXT_REQUIRED');
  const outcomes = files.map((file, fileIndex) => ({ file, fileIndex, validation: validateSourceFile(file) }));
  const accepted = outcomes.filter((item) => item.validation.valid);
  const rejected = outcomes.filter((item) => !item.validation.valid).map(({ file, fileIndex, validation }) => ({ fileName: file.name, fileIndex, status: 'rejected', errorCode: validation.errorCode, message: SOURCE_ERROR_MESSAGES[validation.errorCode] }));
  const reservation = await repository.transact(ownerKey, projectId, (latest) => {
    const slots = Math.max(0, MAX_ACTIVE_SOURCES - countActiveSources(latest.sources));
    const reservedFiles = accepted.slice(0, slots);
    const overflow = accepted.slice(slots).map(({ file, fileIndex }) => ({ fileName: file.name, fileIndex, status: 'rejected', errorCode: 'SOURCE_LIMIT', message: SOURCE_ERROR_MESSAGES.SOURCE_LIMIT }));
    const now = new Date().toISOString();
    const rows = reservedFiles.map(({ file, validation }) => ({
      id: createId(), projectId, fileName: file.name, mediaType: validation.mediaType, size: file.size,
      extractionStatus: 'queued', createdAt: now,
    }));
    return { status: 'reserved', aggregate: { ...latest, sources: [...latest.sources, ...rows] }, rows, reservedFiles, overflow };
  });
  if (!reservation?.aggregate) throw new Error(reservation?.status === 'not_found' ? 'PROJECT_NOT_FOUND' : 'SOURCE_RESERVATION_FAILED');
  onAggregate?.(reservation.aggregate);
  const results = [];

  for (let index = 0; index < reservation.rows.length; index += 1) {
    const result = await extractAndPersist({
      ownerKey, projectId, row: reservation.rows[index], ...reservation.reservedFiles[index], repository, onAggregate, extract,
    });
    results.push({ ...result, fileIndex: reservation.reservedFiles[index].fileIndex });
  }
  return [...rejected, ...reservation.overflow, ...results];
}

export async function retrySourceFile({ ownerKey, projectId, sourceId, file, repository, onAggregate, extract = extractSourceFile }) {
  const validation = validateSourceFile(file);
  if (!validation.valid) return { fileName: file.name, extractionStatus: 'failed', errorCode: validation.errorCode, message: SOURCE_ERROR_MESSAGES[validation.errorCode] };
  const reservation = await repository.transact(ownerKey, projectId, (latest) => {
    const source = latest.sources.find((item) => item.id === sourceId && !item.archivedAt);
    if (!source) return { status: 'missing_source' };
    const { extractedText, textHash, preview, errorCode, ...base } = source;
    const row = { ...base, extractionStatus: 'queued' };
    return { status: 'retry', aggregate: { ...latest, sources: latest.sources.map((item) => item.id === sourceId ? row : item) }, row };
  });
  if (!reservation?.aggregate) throw new Error('SOURCE_RETRY_FAILED');
  onAggregate?.(reservation.aggregate);
  return extractAndPersist({ ownerKey, projectId, row: reservation.row, file, validation, repository, onAggregate, extract });
}

function sourceRefersToSource(ref, sourceId) {
  return ref?.sourceType === 'file' && ref.sourceId === sourceId;
}

export function sourceRemovalImpact(aggregate, sourceId) {
  return new Set((aggregate.designItems ?? []).filter((item) => !item.archivedAt && (
    (item.evidence ?? []).some((ref) => sourceRefersToSource(ref, sourceId))
    || (item.acceptanceCriteria ?? []).some((criterion) => (criterion.evidence ?? []).some((ref) => sourceRefersToSource(ref, sourceId)))
  )).map((item) => item.id)).size;
}

function removeSourceAndReferences(latest, sourceId) {
  return {
    ...latest,
    project: { ...latest.project, updatedAt:new Date().toISOString() },
    sources: latest.sources.filter((source) => source.id !== sourceId),
    designItems: latest.designItems.map((item) => ({
      ...item,
      evidence: (item.evidence ?? []).filter((ref) => !sourceRefersToSource(ref, sourceId)),
      acceptanceCriteria: (item.acceptanceCriteria ?? []).map((criterion) => ({
        ...criterion,
        evidence: (criterion.evidence ?? []).filter((ref) => !sourceRefersToSource(ref, sourceId)),
      })),
    })),
  };
}

export async function removeSource({ ownerKey, projectId, sourceId, repository, onAggregate, expectedImpactCount }) {
  const result = await repository.transact(ownerKey, projectId, (latest) => {
    const impactCount = sourceRemovalImpact(latest, sourceId);
    if (expectedImpactCount !== undefined && expectedImpactCount !== impactCount) return { status: 'impact_changed', impactCount, currentAggregate: latest };
    return { status: 'removed', impactCount, aggregate: removeSourceAndReferences(latest, sourceId) };
  });
  if (result?.status === 'impact_changed') {
    const error = new Error('SOURCE_REMOVAL_IMPACT_CHANGED');
    error.impactCount = result.impactCount;
    error.currentAggregate = result.currentAggregate;
    throw error;
  }
  if (!result?.aggregate) throw new Error('SOURCE_REMOVE_FAILED');
  onAggregate?.(result.aggregate);
  return result.aggregate;
}
