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
  const outcomes = files.map((file) => ({ file, validation: validateSourceFile(file) }));
  const accepted = outcomes.filter((item) => item.validation.valid);
  const rejected = outcomes.filter((item) => !item.validation.valid).map(({ file, validation }) => ({ fileName: file.name, status: 'rejected', errorCode: validation.errorCode, message: SOURCE_ERROR_MESSAGES[validation.errorCode] }));
  const reservation = await repository.transact(ownerKey, projectId, (latest) => {
    const slots = Math.max(0, MAX_ACTIVE_SOURCES - countActiveSources(latest.sources));
    const reservedFiles = accepted.slice(0, slots);
    const overflow = accepted.slice(slots).map(({ file }) => ({ fileName: file.name, status: 'rejected', errorCode: 'SOURCE_LIMIT', message: SOURCE_ERROR_MESSAGES.SOURCE_LIMIT }));
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

  for (let index = 0; index < reservation.rows.length; index += 1) results.push(await extractAndPersist({
    ownerKey, projectId, row: reservation.rows[index], ...reservation.reservedFiles[index], repository, onAggregate, extract,
  }));
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

export async function removeSource({ ownerKey, projectId, sourceId, repository, onAggregate }) {
  const result = await repository.transact(ownerKey, projectId, (latest) => ({
    status: 'removed',
    aggregate: { ...latest, sources: latest.sources.filter((source) => source.id !== sourceId) },
  }));
  if (!result?.aggregate) throw new Error('SOURCE_REMOVE_FAILED');
  onAggregate?.(result.aggregate);
  return result.aggregate;
}
