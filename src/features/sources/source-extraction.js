import { SOURCE_ERROR_MESSAGES } from './source-validation.js';

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function flattenPdfTextItems(pages) {
  const paragraphs = [];
  for (const items of pages) {
    const lines = [];
    for (const item of items) {
      if (typeof item.str !== 'string' || !item.str.trim()) continue;
      const y = item.transform?.[5];
      let line = typeof y === 'number' ? lines.find((candidate) => Math.abs(candidate.y - y) <= 3) : undefined;
      if (!line) {
        line = { y: typeof y === 'number' ? y : Number.NEGATIVE_INFINITY, items: [] };
        lines.push(line);
      }
      line.items.push({ x: typeof item.transform?.[4] === 'number' ? item.transform[4] : 0, text: item.str.trim() });
    }
    lines.sort((left, right) => right.y - left.y);
    for (const line of lines) {
      line.items.sort((left, right) => left.x - right.x);
      const text = line.items.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
      if (text) paragraphs.push(text);
    }
  }
  return paragraphs.join('\n\n');
}

async function extractPdf(file) {
  const { getDocument } = await import('./source-pdf-extraction.js');
  const loadingTask = getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items);
    }
  } finally {
    await loadingTask.destroy();
  }
  const text = flattenPdfTextItems(pages).trim();
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
