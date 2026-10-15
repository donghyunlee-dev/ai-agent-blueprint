import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { BlueprintAggregate, SourceDocument } from '../../domain/blueprint/types.js';
import { addSourceFiles, removeSource, retrySourceFile } from '../../features/sources/source-upload-command.js';
import { countActiveSources, MAX_ACTIVE_SOURCES, SOURCE_ERROR_MESSAGES, validateSourceFile } from '../../features/sources/source-validation.js';
import type { ProjectRepository } from '../../infrastructure/storage/indexeddb-project-repository.js';
import '../../styles/source-documents.css';

const statusLabel: Record<SourceDocument['extractionStatus'], string> = {
  queued: '대기 중', extracting: '추출 중', ready: '미리보기 가능', unsupported: '지원하지 않음', failed: '실패',
};

function formatSize(size: number) { return `${(size / (1024 * 1024)).toFixed(size >= 1024 * 1024 ? 1 : 2)} MiB`; }

export function SourceDocuments({ aggregate, repository, onAggregate, beforeMutation, initialMessage = '' }: {
  aggregate: BlueprintAggregate;
  repository: ProjectRepository;
  onAggregate: (aggregate: BlueprintAggregate) => void;
  beforeMutation: () => Promise<void>;
  initialMessage?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const retryFiles = useRef(new Map<string, File>());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [localRejected, setLocalRejected] = useState<{id:string;fileName:string;size:number;errorCode?:string}[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [localOutcomes, setLocalOutcomes] = useState<Record<string, Partial<SourceDocument>>>({});
  const activeCount = countActiveSources(aggregate.sources);

  async function addFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setMessage('');
    setLocalRejected([]);
    try {
      await beforeMutation();
      const results = await addSourceFiles({
        ownerKey: aggregate.project.ownerKey,
        projectId: aggregate.project.id,
        files,
        repository,
        onAggregate,
      });
      const storageFailures = results.filter((result) => result.id && result.errorCode === 'STORAGE_FAILED');
      for (const result of storageFailures) {
        const file = files.find((item) => item.name === result.fileName && item.size === result.size);
        if (file && result.id) retryFiles.current.set(result.id, file);
      }
      if (storageFailures.length) setLocalOutcomes((current) => ({ ...current, ...Object.fromEntries(storageFailures.filter((result) => result.id).map((result) => [result.id!, result])) }));
      setLocalRejected(results.filter((result) => result.status === 'rejected').map((result) => ({ id: globalThis.crypto.randomUUID(), fileName: result.fileName, size: files.find((file) => file.name === result.fileName)?.size ?? 0, errorCode: result.errorCode ?? 'SOURCE_LIMIT' })));
      const failures = results.filter((result) => ['failed', 'unsupported'].includes(result.extractionStatus ?? '') || result.status === 'rejected').length;
      setMessage(failures ? `${results.length - failures}개 파일 처리 완료 · ${failures}개 확인 필요` : `${results.length}개 파일을 추출하고 저장했습니다.`);
    } catch {
      setMessage(SOURCE_ERROR_MESSAGES.STORAGE_FAILED);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.flatMap((file) => { const validation = validateSourceFile(file); return validation.valid ? [] : [{ id: globalThis.crypto.randomUUID(), fileName: file.name, size: file.size, errorCode: validation.errorCode }]; });
    setLocalRejected(invalid);
    void addFiles(files);
  }

  async function handleRemove(sourceId: string) {
    setBusy(true);
    setMessage('');
    try { await beforeMutation(); await removeSource({ ownerKey: aggregate.project.ownerKey, projectId: aggregate.project.id, sourceId, repository, onAggregate }); }
    catch { setMessage(SOURCE_ERROR_MESSAGES.STORAGE_FAILED); }
    finally { setBusy(false); }
  }

  async function handleRetry(sourceId: string) {
    const file = retryFiles.current.get(sourceId);
    if (!file || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await beforeMutation();
      const result = await retrySourceFile({ ownerKey: aggregate.project.ownerKey, projectId: aggregate.project.id, sourceId, file, repository, onAggregate });
      if (result.errorCode === 'STORAGE_FAILED') setLocalOutcomes((current) => ({ ...current, [sourceId]: result }));
      else { setLocalOutcomes((current) => { const next = { ...current }; delete next[sourceId]; return next; }); retryFiles.current.delete(sourceId); }
      setMessage(result.errorCode === 'STORAGE_FAILED' ? SOURCE_ERROR_MESSAGES.STORAGE_FAILED : '파일 상태를 다시 저장했습니다.');
    } catch { setMessage(SOURCE_ERROR_MESSAGES.STORAGE_FAILED); }
    finally { setBusy(false); }
  }

  return <section className="source-documents" aria-labelledby="source-documents-title">
    <div className="source-documents-heading"><div><h2 id="source-documents-title">참고 자료</h2><p>TXT, Markdown, 텍스트 PDF · 파일당 최대 10 MiB · 프로젝트당 최대 5개</p></div>
      <input ref={input} className="source-file-input" type="file" multiple accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf" aria-label="참고 파일 추가" onChange={handleSelect} />
      <button type="button" className="source-add-button" disabled={busy || activeCount >= MAX_ACTIVE_SOURCES} onClick={() => input.current?.click()}>{busy ? '파일 처리 중…' : '파일 추가'}</button>
    </div>
    {activeCount >= MAX_ACTIVE_SOURCES ? <p className="source-limit-message" role="status">파일 5개가 등록되어 있습니다. 파일을 제거한 뒤 추가할 수 있습니다.</p> : null}
    <ul className="source-list" aria-label="첨부한 참고 자료">
      {aggregate.sources.filter((source) => !source.archivedAt).map((source) => {
        const displaySource = { ...source, ...localOutcomes[source.id] };
        return <li className="source-row" key={source.id}>
        <div className="source-row-main"><strong className="source-file-name">{displaySource.fileName}</strong><span>{displaySource.mediaType} · {formatSize(displaySource.size)}</span><span className={`source-status source-status-${displaySource.extractionStatus}`} role="status">{statusLabel[displaySource.extractionStatus]}</span>
          {displaySource.errorCode ? <p className="source-error">{SOURCE_ERROR_MESSAGES[displaySource.errorCode] ?? SOURCE_ERROR_MESSAGES.EXTRACTION_FAILED}</p> : null}
          <p className="source-sensitive-notice">민감한 정보가 포함되어 있는지 확인하고, 공유 전에 필요한 내용을 제거해 주세요.</p>
        </div>
        <div className="source-row-actions">{displaySource.errorCode === 'STORAGE_FAILED' && retryFiles.current.has(source.id) ? <button type="button" disabled={busy} onClick={() => void handleRetry(source.id)}>저장 다시 시도</button> : null}{displaySource.extractionStatus === 'ready' ? <button type="button" onClick={() => setPreviewId(previewId === source.id ? null : source.id)} aria-expanded={previewId === source.id}>{previewId === source.id ? '미리보기 닫기' : '미리보기'}</button> : null}<button type="button" disabled={busy} onClick={() => void handleRemove(source.id)}>제거</button></div>
        {previewId === source.id ? <pre className="source-preview">{displaySource.extractedText}</pre> : null}
      </li>;
      })}
      {localRejected.map((item) => <li className="source-row source-rejected-row" key={item.id}><div className="source-row-main"><strong className="source-file-name">{item.fileName}</strong><span>{formatSize(item.size)}</span><span className="source-status source-status-failed" role="status">거부됨</span><p className="source-error">{SOURCE_ERROR_MESSAGES[item.errorCode ?? ''] ?? SOURCE_ERROR_MESSAGES.EXTRACTION_FAILED}</p><p className="source-sensitive-notice">민감한 정보가 포함되어 있는지 확인해 주세요.</p></div></li>)}
    </ul>
    {!aggregate.sources.length && !localRejected.length ? <p className="source-empty-state">아직 참고 자료가 없습니다. 자료를 추가하면 이 프로젝트에 저장됩니다.</p> : null}
    {message ? <p className="source-operation-message" role="status">{message}</p> : null}
  </section>;
}
