import { useRef, useState } from 'react';
import type { DocumentSection, GeneratedDocument } from '../../domain/blueprint/types.js';
import { createDocumentFilename, downloadMarkdown, serializeDocumentMarkdown } from '../../features/documents/markdown-export.js';

export function DocumentExportActions({ document, sections, projectTitle }: { document: GeneratedDocument; sections: DocumentSection[]; projectTitle: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const [downloadError, setDownloadError] = useState(false);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const markdown = serializeDocumentMarkdown(document, sections);
  const documentLabel = document.type === 'requirements' ? '요구사항 명세' : document.type === 'prd' ? 'PRD' : document.type === 'setup_guide' ? '설정 가이드' : document.title;

  async function copyDocument() {
    setCopyState('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(markdown);
      setCopyState('copied');
    } catch {
      setCopyState('fallback');
      requestAnimationFrame(() => fallbackRef.current?.select());
    }
  }

  function downloadDocument() {
    setDownloadError(false);
    try {
      downloadMarkdown(markdown, createDocumentFilename(projectTitle, document.type));
    } catch {
      setDownloadError(true);
    }
  }

  return <div className="document-export-actions" role="group" aria-label={`${documentLabel} 내보내기`}>
    <button type="button" className="document-export-copy" onClick={() => void copyDocument()}>Markdown 복사</button>
    <button type="button" className="document-export-download" onClick={downloadDocument}>Markdown 다운로드</button>
    {copyState === 'copied' ? <p role="status">문서 전체를 Markdown으로 복사했습니다.</p> : null}
    {copyState === 'fallback' ? <div className="document-export-fallback"><p role="alert">자동 복사에 실패했습니다. 아래 내용을 선택해 직접 복사해 주세요.</p><label htmlFor={`markdown-fallback-${document.id}`}>복사할 Markdown</label><textarea id={`markdown-fallback-${document.id}`} ref={fallbackRef} readOnly value={markdown} onFocus={(event) => event.currentTarget.select()} /></div> : null}
    {downloadError ? <p role="alert">Markdown 다운로드를 시작하지 못했습니다. 다시 시도해 주세요.</p> : null}
  </div>;
}
