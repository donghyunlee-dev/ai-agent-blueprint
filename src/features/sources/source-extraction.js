import { SOURCE_ERROR_MESSAGES } from './source-validation.js';

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

async function extractPdf(file) {
  const { getDocument } = await import('./source-pdf-extraction.js');
  const pdf = await getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false, isEvalSupported: false }).promise;
  const paragraphs = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let line = '';
      let previousY;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = item.transform?.[5];
        if (line && typeof y === 'number' && typeof previousY === 'number' && Math.abs(y - previousY) > 3) {
          paragraphs.push(line.trim());
          line = '';
        }
        line += `${line ? ' ' : ''}${item.str}`;
        if (item.hasEOL) { paragraphs.push(line.trim()); line = ''; }
        previousY = y;
      }
      if (line.trim()) paragraphs.push(line.trim());
    }
  } finally {
    await pdf.destroy();
  }
  const text = paragraphs.filter(Boolean).join('\n\n').trim();
  if (!text) return { extractionStatus: 'unsupported', errorCode: 'PDF_NO_TEXT' };
  return { extractionStatus: 'ready', text };
}

export async function extractSourceFile(file, extension) {
  try {
    let result;
    if (extension === 'pdf') result = await extractPdf(file);
    else {
      let bytes;
      try { bytes = await file.arrayBuffer(); }
      catch { return { extractionStatus: 'failed', errorCode: 'EXTRACTION_FAILED' }; }
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim(); }
      catch { return { extractionStatus: 'failed', errorCode: 'INVALID_ENCODING' }; }
      if (!text) return { extractionStatus: 'failed', errorCode: 'EXTRACTION_FAILED' };
      result = { extractionStatus: 'ready', text };
    }
    if (result.extractionStatus !== 'ready') return result;
    return {
      extractionStatus: 'ready',
      extractedText: result.text,
      preview: result.text.slice(0, 500),
      textHash: await sha256(result.text),
    };
  } catch {
    return { extractionStatus: 'failed', errorCode: 'EXTRACTION_FAILED' };
  }
}

export function sourceStatusMessage(source) {
  return source.errorCode ? SOURCE_ERROR_MESSAGES[source.errorCode] ?? SOURCE_ERROR_MESSAGES.EXTRACTION_FAILED : '';
}
