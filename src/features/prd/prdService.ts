import { normalizeMarkdownStructure, stripEmoji } from "../survey/textSanitizer";
import { buildFallbackPrd } from "./fallbackPrd";
import { buildPrdPromptMessages } from "./promptTemplates";
import { PrdGenerationInput, StructuredPrd } from "./types";

const prdSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    prdMarkdown: { type: "string" },
  },
  required: ["title", "summary", "prdMarkdown"],
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

function isStructuredPrd(payload: unknown): payload is StructuredPrd {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as StructuredPrd;

  return (
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.prdMarkdown === "string"
  );
}

function sanitizePrd(value: StructuredPrd): StructuredPrd {
  return {
    title: stripEmoji(value.title),
    summary: stripEmoji(value.summary),
    prdMarkdown: normalizeMarkdownStructure(stripEmoji(value.prdMarkdown)),
  };
}

async function requestOpenAIPrd(input: PrdGenerationInput) {
  const response = await fetch("/api/blueprint/prd", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isStructuredPrd(payload)) {
    throw new Error("OpenAI response did not match the PRD schema");
  }
  return sanitizePrd(payload);
}

export const prdService = {
  async generate(input: PrdGenerationInput) {
    return requestOpenAIPrd(input);
  },
};
