const documentTypeNames = Object.freeze({
  requirements: 'requirements',
  prd: 'prd',
  setup_guide: 'setup-guide',
});

function matchingRequirements(document, section) {
  if (section.key === 'open_issues') return [];
  const sectionSources = new Set(section.sourceItemIds ?? []);
  return (document.requirements ?? []).filter((requirement) =>
    (requirement.sourceItemIds ?? []).some((id) => sectionSources.has(id))
  );
}

function requirementMarkdown(requirement) {
  const lines = [`### ${requirement.id} · ${requirement.priority} · ${requirement.title}`, '', requirement.description, '', `근거: ${(requirement.sourceItemIds ?? []).join(', ') || '연결된 설계 없음'}`];
  const criteria = requirement.acceptanceCriteria ?? [];
  if (criteria.length) lines.push('', '#### 수용 기준', '', ...criteria.map(({ text, sourceItemIds }) => `- ${text} (근거: ${(sourceItemIds ?? []).join(', ')})`));
  return lines.join('\n');
}

function openIssueMarkdown(issue) {
  return [`### ${issue.title}`, '', issue.description, '', `설계 항목: ${(issue.sourceItemIds ?? []).join(', ')}`].join('\n');
}

export function serializeDocumentMarkdown(document, sections) {
  if (!document || !document.id || !documentTypeNames[document.type]) throw new TypeError('A supported document is required');
  const orderedSections = (sections ?? [])
    .filter((section) => section.documentId === document.id)
    .toSorted((left, right) => left.order - right.order);
  const blocks = [`# ${document.title}`];
  if (document.type === 'setup_guide' && document.status === 'draft') {
    blocks.push('> 초안: 실행 전 최신 버전과 명령어를 직접 확인하세요.');
  }
  for (const section of orderedSections) {
    blocks.push(`## ${section.title}`);
    if (section.markdown) blocks.push(section.markdown);
    if (document.type === 'requirements') {
      const requirements = matchingRequirements(document, section);
      for (const requirement of requirements) blocks.push(requirementMarkdown(requirement));
      if (section.key === 'open_issues') {
        const sectionSources = new Set(section.sourceItemIds ?? []);
        for (const issue of document.openIssues ?? []) {
          if ((issue.sourceItemIds ?? []).some((id) => sectionSources.has(id))) blocks.push(openIssueMarkdown(issue));
        }
      }
    }
  }
  return blocks.join('\n\n');
}

export function createDocumentFilename(projectTitle, documentType) {
  const type = documentTypeNames[documentType];
  if (!type) throw new TypeError('Unsupported document type');
  const safeTitle = String(projectTitle ?? '')
    .normalize('NFC')
    .replace(/[\\/\u0000-\u001f\u007f-\u009f]/g, '-')
    .replace(/[^\p{L}\p{N}._ -]/gu, '-')
    .replace(/[. ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return `${safeTitle || 'project'}-${type}.md`;
}

export function downloadMarkdown(markdown, filename, dependencies = {}) {
  const BlobConstructor = dependencies.Blob ?? globalThis.Blob;
  const urlApi = dependencies.URL ?? globalThis.URL;
  const doc = dependencies.document ?? globalThis.document;
  const defer = dependencies.setTimeout ?? globalThis.setTimeout;
  const blob = new BlobConstructor([markdown], { type: 'text/markdown;charset=utf-8' });
  let objectUrl;
  let anchor;
  try {
    objectUrl = urlApi.createObjectURL(blob);
    anchor = doc.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    doc.body.appendChild(anchor);
    anchor.click();
    defer(() => {
      urlApi.revokeObjectURL(objectUrl);
      anchor.remove();
    }, 0);
    objectUrl = undefined;
  } catch (error) {
    if (objectUrl) urlApi.revokeObjectURL(objectUrl);
    anchor?.remove();
    throw error;
  }
}
