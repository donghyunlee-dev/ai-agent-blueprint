import { FormEvent, KeyboardEvent, useState } from "react";
import { Alert, Badge, Button, Card, Spinner, Tag, Textarea } from "@sfood/ui";
import { SurveyHeader } from "../components/survey/SurveyHeader";
import { BlueprintSidebar } from "../components/survey/BlueprintSidebar";
import { ResultPanel } from "../components/survey/ResultPanel";
import { useConversationalBlueprint } from "../features/conversation/useConversationalBlueprint";
import { recommendationService } from "../features/survey/recommendationService";
import { StructuredRecommendation } from "../features/survey/types";
import { buildRecommendationMarkdown } from "../features/survey/fallbackRecommendation";
import "../styles/survey.css";
import "../styles/blueprint-workspace.css";

export function SurveyPage() {
  const chat = useConversationalBlueprint();
  const [result, setResult] = useState<StructuredRecommendation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  async function generateRequirements() {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      setResult(await recommendationService.generate(chat.formData));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "요구사항명세서를 생성하지 못했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyResult() {
    if (result) await navigator.clipboard.writeText(buildRecommendationMarkdown(result));
  }

  function downloadResult() {
    if (!result) return;
    const blob = new Blob([buildRecommendationMarkdown(result)], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${chat.formData.serviceName || "blueprint-requirements"}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function submitAnswer(event?: FormEvent) {
    event?.preventDefault();
    void chat.sendMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitAnswer();
    }
  }

  return (
    <div className="survey-page-shell">
      <SurveyHeader />
      <div className="survey-shell conversational-app">
        <div className="blueprint-workspace">
          <main className="conversation-main">
            <header className="conversation-titlebar">
              <div><Badge variant="info">STEP {chat.stageId} / 7</Badge><h1>{chat.stage.title}</h1><p>{chat.stage.description}</p></div>
              <span>{chat.decisions.length}개 결정 확정</span>
            </header>
            <nav className="stage-rail" aria-label="Blueprint 진행 단계">
              {Array.from({ length: 7 }, (_, index) => <span className={chat.stageId === index + 1 ? "current" : chat.stageId > index + 1 ? "done" : ""} key={index}>{chat.stageId > index + 1 ? "✓" : index + 1}</span>)}
            </nav>

            {chat.currentQuestion ? (
              <section className="question-focus" aria-labelledby="current-question-title">
                <div className="question-count">질문 {chat.questionIndex + 1} / {chat.questions.length}</div>
                <h2 id="current-question-title">{chat.currentQuestion.title}</h2>
                <p>{chat.currentQuestion.help}</p>
                {chat.currentQuestion.options?.length ? (
                  <div className="quick-choice-grid">
                    {chat.currentQuestion.options.map((option) => <Button variant="secondary" key={option.value} onClick={() => chat.setDraft(chat.currentQuestion?.multiple && chat.draft ? `${chat.draft}, ${option.title}` : option.title)}><span>{option.icon}</span><span><strong>{option.title}</strong><small>{option.description}</small></span></Button>)}
                    <Button variant="ghost" onClick={() => chat.setDraft("잘 모르겠어요. 현재 설계에 맞는 선택을 추천해 주세요.")}>추천해 주세요</Button>
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="conversation-thread" aria-live="polite">
              {chat.messages.map((message) => (
                <article className={`chat-message-card ${message.role}`} key={message.id}>
                  <header><strong>{message.role === "assistant" ? "SFOOD AI" : "나"}</strong>{message.source === "openai" ? <span>OpenAI 응답</span> : null}</header>
                  <p>{message.content}</p>
                </article>
              ))}

              {chat.isLoading ? <div className="chat-loading"><Spinner size="sm" /><span>OpenAI가 답변을 해석하고 있습니다.</span></div> : null}
              {chat.error ? <Alert variant="danger" title="AI 응답 오류">{chat.error} 입력 내용과 확정된 설계는 유지됩니다.</Alert> : null}

              {chat.pendingReply ? (
                <Card className="proposal-card" padding="lg">
                  <div className="proposal-heading"><div><Badge variant="info">AI 제안</Badge><h2>설계 제안을 검토해 주세요</h2></div><p>확정하기 전에는 설계 보드에 반영되지 않습니다.</p></div>
                  <div className="proposal-decisions">
                    {chat.pendingReply.decisions.map((decision) => (
                      <div key={decision.field}><strong>{decision.label}</strong><Tag>{Array.isArray(decision.value) ? decision.value.join(" · ") : decision.value}</Tag><p>{decision.rationale}</p></div>
                    ))}
                  </div>
                  {!chat.pendingReply.decisions.length ? <Alert variant="warning">답변을 선택값으로 해석하지 못했습니다. 더 구체적으로 다시 답해 주세요.</Alert> : null}
                  <div className="proposal-actions"><Button variant="secondary" onClick={chat.rejectProposal}>다시 답변</Button><Button onClick={chat.confirmProposal} disabled={!chat.pendingReply.decisions.length}>이대로 확정</Button></div>
                </Card>
              ) : null}
            </div>

            {chat.stageId < 7 ? (
              <form className="chat-composer-wrap" onSubmit={submitAnswer}>
                <label className="composer-label" htmlFor="blueprint-answer">{chat.currentQuestion?.multiple ? "선택하거나 직접 입력하세요 · 복수 가능" : "선택하거나 직접 입력하세요"}</label>
                <div className="chat-composer">
                  <Textarea id="blueprint-answer" value={chat.draft} onChange={(event) => chat.setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="답변을 입력하세요." disabled={chat.isLoading} rows={3} />
                  <div className="composer-footer"><span className="composer-hint">{chat.pendingReply ? "새 답변은 현재 AI 제안을 교체합니다." : "Enter 전송 · Shift+Enter 줄바꿈"}</span><Button className="composer-send" type="submit" disabled={!chat.draft.trim() || chat.isLoading}>{chat.isLoading ? <><Spinner size="sm" /> 전송 중</> : "OpenAI에 보내기"}</Button></div>
                </div>
              </form>
            ) : (
              <Card className="completion-card" padding="lg"><h2>7단계 최종 검토</h2><p>우측 설계 보드에서 6개 영역을 검토한 뒤 요구사항명세서를 생성합니다.</p>
                {generationError ? <Alert variant="danger">{generationError}</Alert> : null}
                <Button size="lg" onClick={() => void generateRequirements()} disabled={isGenerating}>{isGenerating ? <><Spinner size="sm" /> 생성 중</> : "요구사항명세서 생성"}</Button>
              </Card>
            )}

            {result || isGenerating ? <ResultPanel formData={chat.formData} result={result} isSubmitting={isGenerating} onCopy={copyResult} onDownloadMarkdown={downloadResult} onReset={() => window.location.reload()} /> : null}
          </main>
          <BlueprintSidebar decisions={chat.decisions} currentStage={chat.stageId} onEdit={chat.editSection} isOpen={isBoardOpen} onClose={() => setIsBoardOpen(false)} />
          <button className={`blueprint-backdrop ${isBoardOpen ? "is-open" : ""}`} type="button" aria-label="설계 보드 닫기" onClick={() => setIsBoardOpen(false)} />
          <div className="mobile-blueprint-trigger-row"><Button className="mobile-blueprint-link" variant="secondary" onClick={() => setIsBoardOpen(true)}>설계 보드 보기</Button></div>
        </div>
      </div>
    </div>
  );
}
