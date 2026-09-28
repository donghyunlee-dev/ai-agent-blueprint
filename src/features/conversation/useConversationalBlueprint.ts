import { useMemo, useState } from "react";
import { INITIAL_FORM_DATA } from "../survey/constants";
import { SurveyFormData } from "../survey/types";
import { activeQuestions, BLUEPRINT_STAGES, StageId } from "./blueprintQuestions";
import { requestConversationTurn } from "./conversationService";
import { ChatMessage, ConfirmedDecision, ConversationReply } from "./types";

function answered(value: string | string[]) { return Array.isArray(value) ? value.length > 0 : Boolean(value); }
function toFormData(decisions: ConfirmedDecision[]) {
  const data = { ...INITIAL_FORM_DATA } as SurveyFormData;
  decisions.forEach((decision) => { (data as unknown as Record<string, string | string[]>)[decision.field] = decision.value; });
  if (data.db === "no") { data.dbExist = ""; data.dbType = ""; }
  if (data.auth === "no") data.authTypes = [];
  if (data.notif === "no") data.notifChannels = [];
  return data;
}

export function useConversationalBlueprint() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [decisions, setDecisions] = useState<ConfirmedDecision[]>([]);
  const [stageId, setStageId] = useState<StageId>(1);
  const [draft, setDraft] = useState("");
  const [pendingReply, setPendingReply] = useState<ConversationReply | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formData = useMemo(() => toFormData(decisions), [decisions]);
  const stage = BLUEPRINT_STAGES[stageId - 1];
  const questions = activeQuestions(stage, formData);
  const currentQuestion = questions.find((question) => !answered(formData[question.field])) || null;
  const questionIndex = currentQuestion ? questions.indexOf(currentQuestion) : questions.length;

  async function sendMessage(message = draft) {
    const content = message.trim();
    if (!content || !currentQuestion || isLoading) return;
    if (pendingReply) setPendingReply(null);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory); setDraft(""); setError(null); setIsLoading(true);
    try {
      const reply = await requestConversationTurn({ message: content, stage: stageId, question: currentQuestion, history: nextHistory, decisions });
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", source: "openai", content: reply.assistantMessage }]);
      setPendingReply({ ...reply, decisions: reply.decisions.filter((decision) => decision.field === currentQuestion.field) });
    } catch (requestError) {
      setDraft(content);
      setError(requestError instanceof Error ? requestError.message : "AI 응답을 불러오지 못했습니다.");
    } finally { setIsLoading(false); }
  }

  function confirmProposal() {
    if (!pendingReply || !currentQuestion || !pendingReply.decisions.length) return;
    const replacement = pendingReply.decisions[0];
    const next = [...decisions.filter((item) => item.field !== replacement.field), { ...replacement, confirmedAt: Date.now() }];
    const nextData = toFormData(next);
    setDecisions(next); setPendingReply(null);
    const remaining = activeQuestions(stage, nextData).filter((question) => !answered(nextData[question.field]));
    if (!remaining.length && stageId < 7) setStageId((stageId + 1) as StageId);
  }

  function rejectProposal() { setPendingReply(null); setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", source: "system", content: "답변을 수정해 다시 알려주세요." }]); }
  function editSection(fields: string[], targetStage: StageId) {
    setDecisions((current) => current.filter((decision) => !fields.includes(decision.field)));
    setPendingReply(null); setStageId(targetStage);
  }

  return { messages, decisions, formData, stageId, stage, questions, currentQuestion, questionIndex, draft, pendingReply, isLoading, error, setDraft, sendMessage, confirmProposal, rejectProposal, editSection };
}
