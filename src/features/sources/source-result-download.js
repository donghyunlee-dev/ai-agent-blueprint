const INVALID_FILENAME_CHARACTERS = /[\\/:<>"|?*\u0000-\u001f\u007f-\u009f]/g;
const SOURCE_RESULT_SUFFIX = '-extracted-result.txt';
const MAX_FILENAME_BYTES = 255;

export function canDownloadSourceResult(source) {
  return Boolean(source
    && source.extractionStatus === 'ready'
    && !source.archivedAt
    && typeof source.extractedText === 'string'
    && source.extractedText.trim().length > 0);
}

export function createSourceResultFilename(fileName) {
  const normalizedBase = String(fileName ?? '')
    .normalize('NFC')
    .replace(INVALID_FILENAME_CHARACTERS, '-')
    .replace(/\.[^.]*$/, '')
    .replace(/[. ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  const safeBase = normalizedBase || 'source';
  const encoder = new TextEncoder();
  const maxBaseBytes = MAX_FILENAME_BYTES - encoder.encode(SOURCE_RESULT_SUFFIX).length;
  let baseBytes = 0;
  let truncatedBase = '';
  for (const character of safeBase) {
    const characterBytes = encoder.encode(character).length;
    if (baseBytes + characterBytes > maxBaseBytes) break;
    truncatedBase += character;
    baseBytes += characterBytes;
  }
  return `${truncatedBase || 'source'}${SOURCE_RESULT_SUFFIX}`;
}

export function downloadSourceResult(source, dependencies = {}) {
  if (!canDownloadSourceResult(source)) throw new TypeError('A ready source with extracted text is required');
  const BlobConstructor = dependencies.Blob ?? globalThis.Blob;
  const urlApi = dependencies.URL ?? globalThis.URL;
  const doc = dependencies.document ?? globalThis.document;
  const defer = dependencies.setTimeout ?? globalThis.setTimeout;
  const blob = new BlobConstructor([source.extractedText], { type: 'text/plain;charset=utf-8' });
  let objectUrl;
  let anchor;
  try {
    const createdObjectUrl = urlApi.createObjectURL(blob);
    objectUrl = createdObjectUrl;
    anchor = doc.createElement('a');
    anchor.href = createdObjectUrl;
    anchor.download = createSourceResultFilename(source.fileName);
    anchor.hidden = true;
    doc.body.appendChild(anchor);
    anchor.click();
    defer(() => {
      try { urlApi.revokeObjectURL(createdObjectUrl); }
      catch { /* Cleanup must still remove the temporary download link. */ }
      finally { anchor.remove(); }
    }, 0);
    objectUrl = undefined;
  } catch (error) {
    try { if (objectUrl) urlApi.revokeObjectURL(objectUrl); }
    catch { /* Preserve the original download failure. */ }
    finally { anchor?.remove(); }
    throw error;
  }
}
