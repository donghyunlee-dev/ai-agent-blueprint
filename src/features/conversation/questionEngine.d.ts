import type { QuestionSpec } from "../../domain/blueprint/types.js";

export interface CatalogQuestion extends QuestionSpec {
  area: string;
  catalogVersion: string;
  allowRecommendation: boolean;
  fatigueGroup: string;
  reviewRequired?: boolean;
  allowedAnswerModes: QuestionSpec["answerMode"][];
  factors: { downstreamImpact: number; risk: number; uncertainty: number };
  contextKeywords: string[];
  prerequisites?: { questionId: string; expectedValues: string[] }[];
  options?: (NonNullable<QuestionSpec["options"]>[number] & { value: string })[];
  min?: number;
  max?: number;
  minSelections?: number;
  maxSelections?: number;
  unit?: string;
  safeTextFallback?: boolean;
  when?: (aggregate: any) => boolean;
}

export const QUESTION_CATALOG: CatalogQuestion[];
export function validateQuestionSpec(spec: unknown): true;
export function getQuestionCandidates(aggregate: unknown, incomingSpec?: unknown): CatalogQuestion[];
export function getAnswerReviewState(aggregate: any, answer: any): { reviewRequired: boolean };
export function rankQuestionCandidates(candidates: CatalogQuestion[], aggregate: unknown): CatalogQuestion[];
export function selectNextQuestion(aggregate: unknown): CatalogQuestion | null;
export function resolveQuestionForDisplay(spec: CatalogQuestion, displayedCatalogVersion?: string): CatalogQuestion;
export function validateQuestionAnswer(spec: CatalogQuestion, answer: Record<string, any>): { valid: boolean; error?: string };
