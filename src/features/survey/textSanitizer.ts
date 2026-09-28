import { StructuredRecommendation } from "./types";

const emojiPattern =
  /[\p{Extended_Pictographic}\u2600-\u27BF\uFE0F\u200D]/gu;

export function stripEmoji(value: string) {
  return value
    .replace(emojiPattern, "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeMarkdownStructure(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/([^\n])\n?(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/([^\n])\n?(```)/g, "$1\n\n$2")
    .replace(/(```[^\n]*\n[\s\S]*?\n```)([^\n])/g, "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeRecommendation(recommendation: StructuredRecommendation): StructuredRecommendation {
  return {
    ...recommendation,
    title: stripEmoji(recommendation.title),
    summary: stripEmoji(recommendation.summary),
    reportMarkdown: normalizeMarkdownStructure(stripEmoji(recommendation.reportMarkdown)),
    guideDocs: recommendation.guideDocs.map((doc) => stripEmoji(doc)),
  };
}
