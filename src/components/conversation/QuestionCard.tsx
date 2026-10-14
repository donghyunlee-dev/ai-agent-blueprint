import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CatalogQuestion } from "../../features/conversation/questionEngine.js";
import { resolveQuestionForDisplay, validateQuestionAnswer } from "../../features/conversation/questionEngine.js";
import "../../styles/question-card.css";

type AnswerAction = "answer" | "unknown" | "recommend" | "defer" | "skip";
type Draft = { action: AnswerAction; selectedValues: string[]; customText: string; numberValue?: number; rangeValue?: { start: number; end: number }; rankedValues?: string[] };

export function QuestionCard({ question, onSubmit }: { question: CatalogQuestion; onSubmit: (answer: Draft) => void }) {
  const shown = useMemo(() => resolveQuestionForDisplay(question), [question]);
  const [draft, setDraft] = useState<Draft>({ action: "answer", selectedValues: [], customText: "" });
  const [error, setError] = useState("");
  const options = shown.options ?? [];
  const formErrorId = `question-error-${shown.id}`;
  const update = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values, ...(values.action === undefined ? { action: "answer" } : {}) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const checked = validateQuestionAnswer(shown, draft);
    if (!checked.valid) { setError(checked.error ?? "답변을 확인해 주세요."); return; }
    setError("");
    onSubmit(draft.action === "defer" ? { action: "defer", selectedValues: [], customText: "" } : { ...draft, customText: draft.customText.trim() });
  };
  const chooseAction = (action: AnswerAction) => {
    const candidate = { ...draft, action };
    const checked = validateQuestionAnswer(shown, candidate);
    if (!checked.valid) { setError(checked.error ?? "응답을 확인해 주세요."); return; }
    setError("");
    onSubmit(candidate);
  };
  const toggleOption = (value: string, checked: boolean) => update({ selectedValues: checked ? [...draft.selectedValues, value] : draft.selectedValues.filter((item) => item !== value) });

  return <article className="question-card" aria-labelledby={`question-title-${shown.id}`}>
    <div className="question-card-meta"><span>{shown.area}</span><span>{shown.required ? "필수" : "선택"}</span></div>
    <h2 id={`question-title-${shown.id}`}>{shown.prompt}</h2>
    <p className="question-card-help">{shown.help}</p>
    {shown.safeTextFallback ? <p className="question-card-safe-note" role="status">질문 형식을 확인할 수 없어 안전한 직접 입력으로 표시합니다. 입력한 답변은 제출 전 저장되지 않습니다.</p> : null}
    <form onSubmit={submit} noValidate>
      {shown.answerMode === "text" ? <label className="question-card-field">직접 입력<textarea rows={4} value={draft.customText} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ customText: event.target.value })} /></label> : null}
      {shown.answerMode === "number" ? <label className="question-card-field">{shown.unit ? `예상 수량 (${shown.unit})` : "숫자"}<input type="number" min={shown.min} max={shown.max} value={draft.numberValue ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ numberValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></label> : null}
      {shown.answerMode === "range" ? <fieldset className="question-card-field question-card-range"><legend>{shown.unit ? `범위 (${shown.unit})` : "범위"}</legend><label>시작<input type="number" min={shown.min} max={shown.max} value={draft.rangeValue?.start ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ rangeValue: { start: event.target.value === "" ? Number.NaN : Number(event.target.value), end: draft.rangeValue?.end ?? Number.NaN } })} /></label><label>끝<input type="number" min={shown.min} max={shown.max} value={draft.rangeValue?.end ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ rangeValue: { start: draft.rangeValue?.start ?? Number.NaN, end: event.target.value === "" ? Number.NaN : Number(event.target.value) } })} /></label></fieldset> : null}
      {["single", "multiple", "confirm"].includes(shown.answerMode) ? <fieldset className="question-card-options" aria-describedby={error ? formErrorId : undefined}><legend>{shown.answerMode === "multiple" ? "해당하는 항목을 모두 선택하세요" : "항목을 선택하세요"}</legend>{options.map((option) => <label className="question-card-option" key={option.value}><input type={shown.answerMode === "multiple" ? "checkbox" : "radio"} name={`question-${shown.id}`} value={option.value} checked={draft.selectedValues.includes(option.value)} onChange={(event) => shown.answerMode === "multiple" ? toggleOption(option.value, event.target.checked) : update({ selectedValues: [option.value] })} /><span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>{option.recommended ? <small>추천 · {option.recommendationReason}</small> : null}</label>)}</fieldset> : null}
      {shown.answerMode === "rank" ? <fieldset className="question-card-rank" aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined}><legend>순서를 정할 항목</legend><div className="question-card-options">{options.map((option) => <label className="question-card-option" key={option.value}><input type="checkbox" checked={(draft.rankedValues ?? []).includes(option.value)} onChange={(event) => { const values = draft.rankedValues ?? []; update({ rankedValues: event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value) }); }} /><span>{option.label}</span></label>)}</div><ol>{(draft.rankedValues ?? []).map((value, index, values) => <li key={value}><span>{options.find((item) => item.value === value)?.label ?? value}</span><button type="button" aria-label={`${options.find((item) => item.value === value)?.label ?? value} 순위 위로`} disabled={index === 0} onClick={() => { const next = [...values]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update({ rankedValues: next }); }}>위로</button><button type="button" aria-label={`${options.find((item) => item.value === value)?.label ?? value} 순위 아래로`} disabled={index === values.length - 1} onClick={() => { const next = [...values]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; update({ rankedValues: next }); }}>아래로</button></li>)}</ol></fieldset> : null}
      {shown.allowCustomAnswer && shown.answerMode !== "text" ? <label className="question-card-field question-card-custom">직접 입력 (선택)<input value={draft.customText} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ customText: event.target.value })} /></label> : null}
      {error ? <p className="question-card-error" id={formErrorId} role="alert">{error}</p> : null}
      {draft.action === "defer" ? <p className="question-card-defer-impact" role="status">이 질문을 미정으로 답변 이력에 남기고 다음 질문으로 진행합니다. 질문과 이력은 저장되어 나중에 다시 결정할 수 있습니다.</p> : null}
      <div className="question-card-actions"><button type="button" onClick={() => chooseAction("unknown")}>잘 모르겠어요</button><button type="button" onClick={() => chooseAction("recommend")}>추천해 주세요</button><button type="button" aria-pressed={draft.action === "defer"} onClick={() => { setError(""); setDraft((current) => ({ ...current, action: "defer" })); }}>나중에 결정</button>{!shown.required ? <button type="button" onClick={() => chooseAction("skip")}>건너뛰기</button> : null}<button className="question-card-submit" type="submit">{draft.action === "defer" ? "나중에 결정 확인" : "답변 제출"}</button></div>
    </form>
  </article>;
}
