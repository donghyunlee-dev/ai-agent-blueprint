import { SurveyFormData } from "../survey/types";

export type BlueprintField = keyof SurveyFormData;
export type ConversationPhase = "service" | "environment" | "data" | "automation" | "tools" | "deployment" | "review" | "complete";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "openai" | "system";
}

export interface ProposedDecision {
  field: BlueprintField;
  value: string | string[];
  label: string;
  rationale: string;
}

export interface ConversationReply {
  assistantMessage: string;
  suggestions: string[];
  decisions: ProposedDecision[];
  nextQuestion: string;
  nextPhase: ConversationPhase;
  canComplete: boolean;
}

export interface ConfirmedDecision extends ProposedDecision {
  confirmedAt: number;
}
