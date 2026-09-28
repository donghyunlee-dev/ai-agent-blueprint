import { BlueprintQuestion, StageId } from "./blueprintQuestions";
import { ChatMessage, ConfirmedDecision, ConversationReply } from "./types";

export async function requestConversationTurn(input: {
  message: string;
  stage: StageId;
  question: BlueprintQuestion;
  history: ChatMessage[];
  decisions: ConfirmedDecision[];
  signal?: AbortSignal;
}): Promise<ConversationReply> {
  const response = await fetch("/api/blueprint/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      stage: input.stage,
      targetField: input.question.field,
      question: input.question.title,
      help: input.question.help,
      multiple: Boolean(input.question.multiple),
      allowedOptions: (input.question.options || []).map(({ value, title, description }) => ({ value, label: title, description })),
      history: input.history.slice(-16).map(({ role, content }) => ({ role, content })),
      confirmedDecisions: input.decisions.map(({ field, value, label }) => ({ field, value, label })),
    }),
    signal: input.signal,
  });

  const payload = await response.json().catch(() => ({})) as ConversationReply & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "AI 응답을 불러오지 못했습니다.");
  }
  return payload;
}
