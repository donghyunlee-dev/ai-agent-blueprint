const MAX_PARAGRAPHS_PER_SOURCE = 2;
const MAX_CHARS_PER_SOURCE = 1200;
const MAX_CHARS_PER_REQUEST = 6000;

function paragraphsFor(source) {
  return String(source.extractedText ?? '')
    .split(/\r?\n\s*\r?\n+/)
    .map((text) => text.trim())
    .filter(Boolean);
}

function tokens(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function characterCount(value) { return Array.from(value).length; }

function relevanceScore(text, queryTokens) {
  const paragraphTokens = tokens(text);
  let score = 0;
  for (const token of queryTokens) if (paragraphTokens.some((candidate) => candidate === token || (/\p{Script=Hangul}/u.test(token) && /\p{Script=Hangul}/u.test(candidate) && (candidate.includes(token) || token.includes(candidate))))) score += 1;
  return score;
}

export function selectSourceExcerpts({ projectId, query, sources = [], evidence = [], idFactory = () => globalThis.crypto.randomUUID() }) {
  if (!projectId) return [];
  const queryTokens = new Set(tokens(query));
  const fileEvidence = evidence.filter((reference) => reference?.sourceType === 'file' && typeof reference.sourceId === 'string');
  const candidates = [];
  for (const [sourceIndex, source] of sources.entries()) {
    if (source.projectId !== projectId || source.extractionStatus !== 'ready' || source.archivedAt || typeof source.extractedText !== 'string') continue;
    paragraphsFor(source).forEach((text, paragraphIndex) => candidates.push({
      source,
      sourceIndex,
      paragraphIndex,
      text,
      score: relevanceScore(text, queryTokens),
      cited: fileEvidence.some((reference) => reference.sourceId === source.id && (!reference.excerpt || text.includes(reference.excerpt))),
    }));
  }

  candidates.sort((left, right) => Number(right.cited) - Number(left.cited) || right.score - left.score || left.sourceIndex - right.sourceIndex || left.paragraphIndex - right.paragraphIndex);
  const selected = [];
  const sourceCounts = new Map();
  const sourceChars = new Map();
  let requestChars = 0;
  for (const candidate of candidates) {
    const count = sourceCounts.get(candidate.source.id) ?? 0;
    const sourceCharCount = sourceChars.get(candidate.source.id) ?? 0;
    const length = characterCount(candidate.text);
    if (count >= MAX_PARAGRAPHS_PER_SOURCE || length > MAX_CHARS_PER_SOURCE - sourceCharCount || length > MAX_CHARS_PER_REQUEST - requestChars) continue;
    selected.push(candidate);
    sourceCounts.set(candidate.source.id, count + 1);
    sourceChars.set(candidate.source.id, sourceCharCount + length);
    requestChars += length;
  }

  selected.sort((left, right) => left.sourceIndex - right.sourceIndex || left.paragraphIndex - right.paragraphIndex);
  return selected.map(({ source, paragraphIndex, text }) => ({
    id: idFactory(),
    sourceId: source.id,
    text,
    location: `문단 ${paragraphIndex + 1}`,
  }));
}

export const sourceExcerptLimits = Object.freeze({ perSourceParagraphs: MAX_PARAGRAPHS_PER_SOURCE, perSourceCharacters: MAX_CHARS_PER_SOURCE, requestCharacters: MAX_CHARS_PER_REQUEST });
