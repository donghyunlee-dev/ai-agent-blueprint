import { searchGuideDocuments } from "../docs/docsRegistry";
import { buildFallbackRecommendation } from "./fallbackRecommendation";
import { buildPromptMessages } from "./promptTemplates";
import { sanitizeRecommendation } from "./textSanitizer";
import {
  GuideDocKey,
  RecommendationService,
  StructuredRecommendation,
  SurveyFormData,
} from "./types";

const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    reportMarkdown: { type: "string" },
    guideDocs: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "summary",
    "reportMarkdown",
    "guideDocs",
  ],
} as const;

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  return null;
}

function isStructuredRecommendation(
  payload: unknown,
): payload is StructuredRecommendation {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as StructuredRecommendation;

  return (
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.reportMarkdown === "string" &&
    Array.isArray(value.guideDocs)
  );
}

function collectGuideKeywords(
  data: SurveyFormData,
  recommendation?: StructuredRecommendation,
) {
  const recommendationTerms = recommendation
    ? [
        recommendation.title,
        recommendation.summary,
        recommendation.reportMarkdown,
      ]
    : [];

  return [
    data.aiAgent,
    data.deploy,
    data.git,
    data.auth,
    data.serviceName,
    data.serviceDesc,
    data.extraNote,
    ...data.features,
    ...data.authTypes,
    ...data.notifChannels,
    ...data.automation,
    ...data.tools,
    ...data.security,
    ...recommendationTerms,
  ].filter(Boolean);
}

function ensureGuideDocs(
  recommendation: StructuredRecommendation,
  data: SurveyFormData,
): StructuredRecommendation {
  const directDocs = recommendation.guideDocs;
  const searchedDocs = searchGuideDocuments(
    collectGuideKeywords(data, recommendation),
    3,
  );
  const mergedGuideDocs = [...new Set([...directDocs, ...searchedDocs])].slice(0, 3);

  const ensuredGuideDocs = [
    "custom-setup-guide",
    ...mergedGuideDocs.filter((doc): doc is GuideDocKey => doc !== "custom-setup-guide"),
  ].slice(0, 4) as GuideDocKey[];

  return {
    ...recommendation,
    guideDocs: ensuredGuideDocs,
  };
}

async function requestOpenAIRecommendation(data: SurveyFormData) {
  const response = await fetch("/api/blueprint/requirements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formData: data }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isStructuredRecommendation(payload)) {
    throw new Error("OpenAI response did not match the recommendation schema");
  }
  return sanitizeRecommendation(ensureGuideDocs(payload, data));
}

export const recommendationService: RecommendationService = {
  async generate(data) {
    return requestOpenAIRecommendation(data);
  },
};
