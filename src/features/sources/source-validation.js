export const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ACTIVE_SOURCES = 5;

const MIME_BY_EXTENSION = {
  txt: new Set(['text/plain']),
  md: new Set(['text/markdown', 'text/plain']),
  markdown: new Set(['text/markdown', 'text/plain']),
  pdf: new Set(['application/pdf']),
};
const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'application/x-unknown']);

export function validateSourceFile(file) {
  const extension = file?.name?.toLowerCase().split('.').at(-1) ?? '';
  const supported = MIME_BY_EXTENSION[extension];
  if (!supported) return { valid: false, errorCode: 'UNSUPPORTED_TYPE' };
  if (Number(file.size) <= 0) return { valid: false, errorCode: 'EMPTY_FILE' };
  if (Number(file.size) > MAX_SOURCE_FILE_BYTES) return { valid: false, errorCode: 'FILE_TOO_LARGE' };
  const mime = String(file.type ?? '').trim().toLowerCase();
  if (!GENERIC_MIME_TYPES.has(mime) && !supported.has(mime)) return { valid: false, errorCode: 'TYPE_MISMATCH' };
  return { valid: true, extension, mediaType: mime || (extension === 'pdf' ? 'application/pdf' : 'text/plain') };
}

export function countActiveSources(sources) {
  return sources.filter((source) => !source.archivedAt).length;
}

export const SOURCE_ERROR_MESSAGES = {
  UNSUPPORTED_TYPE: 'TXT, Markdown 또는 텍스트 PDF 파일만 첨부할 수 있습니다.',
  EMPTY_FILE: '빈 파일은 첨부할 수 없습니다.',
  FILE_TOO_LARGE: '파일 크기는 10 MiB 이하여야 합니다.',
  TYPE_MISMATCH: '파일 확장자와 형식이 일치하지 않습니다.',
  SOURCE_LIMIT: '프로젝트에는 보관 중인 파일을 포함해 최대 5개까지 첨부할 수 있습니다.',
  INVALID_ENCODING: '파일을 UTF-8 텍스트로 읽을 수 없습니다.',
  PDF_NO_TEXT: 'PDF에서 텍스트를 찾지 못했습니다. 이미지 PDF는 지원하지 않습니다.',
  EXTRACTION_FAILED: '파일을 읽지 못했습니다. 파일을 확인하고 다시 선택해 주세요.',
  STORAGE_FAILED: '파일 상태를 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
};
