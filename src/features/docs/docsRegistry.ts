import { StructuredRecommendation, SurveyFormData } from "../survey/types";
import { GuideDocKey } from "../survey/types";
import { stripEmoji } from "../survey/textSanitizer";

export interface GuideDocument {
  key: GuideDocKey;
  title: string;
  content: string;
  path: string;
  tags: string[];
}

interface ParsedFrontmatter {
  body: string;
  tags: string[];
  title: string | null;
}

const rawGuideModules = import.meta.glob("../../../docs/guide/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase();
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function extractBaseName(path: string) {
  const match = path.match(/\/([^/]+)\.md$/);
  return match ? match[1] : path;
}

function parseFrontmatter(content: string): ParsedFrontmatter {
  if (!content.startsWith("---\n")) {
    return { body: content, title: null, tags: [] };
  }

  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { body: content, title: null, tags: [] };
  }

  const rawFrontmatter = content.slice(4, endIndex);
  const body = content.slice(endIndex + 5);
  const titleMatch = rawFrontmatter.match(/^title:\s*(.+)$/m);
  const tagsMatch = rawFrontmatter.match(/^tags:\s*(.+)$/m);

  return {
    body,
    title: titleMatch ? titleMatch[1].trim() : null,
    tags: tagsMatch
      ? tagsMatch[1]
          .split(",")
          .map((tag) => normalizeKeyword(tag))
          .filter(Boolean)
      : [],
  };
}

function extractTitle(content: string, fallback: string) {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  return stripEmoji(headingMatch ? headingMatch[1].trim() : fallback);
}

function deriveTags(baseName: string, title: string, explicitTags: string[]) {
  if (explicitTags.length) return explicitTags;

  return [...new Set([...baseName.split("-"), ...title.toLowerCase().split(/\s+/)])].filter(Boolean);
}

const staticGuideDocumentList: GuideDocument[] = Object.entries(rawGuideModules)
  .map(([path, rawContent]) => {
    const baseName = extractBaseName(path);
    const { body, title, tags } = parseFrontmatter(rawContent);
    const documentTitle = title || extractTitle(body, toTitleCase(baseName));

    return {
      key: baseName,
      title: stripEmoji(documentTitle),
      content: body,
      path: `docs/guide/${baseName}.md`,
      tags: deriveTags(baseName, documentTitle, tags),
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "ko-KR"));

export const guideDocuments: Record<GuideDocKey, GuideDocument> =
  staticGuideDocumentList.reduce(
    (acc, document) => {
      acc[document.key] = document;
      return acc;
    },
    {} as Record<GuideDocKey, GuideDocument>,
  );

function scoreDocument(document: GuideDocument, keywords: string[]) {
  const haystack = `${document.title} ${document.tags.join(" ")} ${document.content.slice(0, 1200)}`
    .toLowerCase();

  return keywords.reduce((score, keyword) => {
    if (!keyword) return score;
    if (document.tags.some((tag) => tag.includes(keyword))) return score + 4;
    if (document.title.toLowerCase().includes(keyword)) return score + 3;
    if (haystack.includes(keyword)) return score + 1;
    return score;
  }, 0);
}

export function searchGuideDocuments(keywords: string[], limit = 3): GuideDocKey[] {
  const normalized = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];

  return staticGuideDocumentList
    .map((document) => ({
      key: document.key,
      score: scoreDocument(document, normalized),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.key);
}

export function getGuideDocCatalog() {
  return staticGuideDocumentList.map((document) => ({
    key: document.key,
    title: document.title,
    path: document.path,
    tags: document.tags,
  }));
}

export function buildCustomGuideDocument(
  formData: SurveyFormData,
  recommendation: StructuredRecommendation,
): GuideDocument {
  const lines = [
    `# ${formData.serviceName || "프로젝트"} 맞춤 설치 및 설정 가이드`,
    "",
    `> 이 문서는 현재 설문 응답과 생성된 리포트를 기준으로 바로 실행할 수 있도록 다시 정리한 맞춤형 가이드입니다.`,
    "",
    "## 우선 준비할 항목",
    "- Node.js LTS와 패키지 매니저 설치",
    "- `.env.local` 생성 및 API 키 준비",
    "- Git 저장소 또는 협업 도구 연결 준비",
    "",
    "## 먼저 해야 하는 작업",
    "1. 리포트의 작업 순서를 기준으로 MVP 범위를 확정합니다.",
    "2. 개발 OS에 맞는 패키지 설치를 먼저 끝냅니다.",
    "3. 데이터 저장과 인증 방식부터 확정한 뒤 화면과 API를 연결합니다.",
    "4. 배포 전에 알림 및 협업 도구 연동을 마지막으로 붙입니다.",
    "",
    "## 현재 추천 리포트 핵심 요약",
    recommendation.summary,
    "",
    "## 리포트 원문 활용",
    "아래 리포트 본문을 기준으로 환경 구성과 연동 순서를 그대로 진행하면 됩니다.",
    "",
    recommendation.reportMarkdown,
  ];

  return {
    key: "custom-setup-guide",
    title: "맞춤 설치 및 설정 가이드",
    content: lines.join("\n"),
    path: "generated://custom-setup-guide",
    tags: ["custom", "setup", "install", "configuration", "guide"],
  };
}
