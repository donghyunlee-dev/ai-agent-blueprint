import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CatalogQuestion } from "../../features/conversation/questionEngine.js";
import { resolveQuestionForDisplay, validateQuestionAnswer } from "../../features/conversation/questionEngine.js";
import "../../styles/question-card.css";

type AnswerAction = "answer" | "unknown" | "recommend" | "defer" | "skip";
type Draft = { action: AnswerAction; selectedValues: string[]; customText: string; numberValue?: number; rangeValue?: { start: number; end: number }; rankedValues?: string[] };
const areaLabels: Record<string, string> = { problem: "문제 정의", user: "주요 사용자", goal: "목표", scope: "범위", features: "핵심 기능", priority: "우선순위", scale: "사용 규모", data: "데이터", identity: "로그인·권한", security: "보안", integrations: "연동", delivery: "운영 환경" };

export function QuestionCard({ question, onSubmit }: { question: CatalogQuestion; onSubmit: (answer: Draft, effectiveAnswerMode: CatalogQuestion["answerMode"]) => void }) {
  const shown = useMemo(() => resolveQuestionForDisplay(question), [question]);
  const [draft, setDraft] = useState<Draft>({ action: "answer", selectedValues: [], customText: "" });
  const [error, setError] = useState("");
  const options = shown.options ?? [];
  const isUserRoleQuestion = shown.id === "user-role";
  const displayPrompt = isUserRoleQuestion ? "주로 누가 이 서비스를 사용하나요?" : shown.prompt;
  const displayHelp = isUserRoleQuestion ? "주요 사용자를 먼저 정의하면, 필요한 화면과 기능을 더 정확하게 구성할 수 있습니다." : shown.help;
  const roleCopy: Record<string, { label: string; description: string; icon: string }> = {
    "운영 담당자": { label: "일반 직원", description: "회의실을 검색하고 예약하는 구성원", icon: "employee" },
    "관리자": { label: "관리자", description: "회의실 정보와 예약 현황을 관리하는 담당자", icon: "admin" },
    "일반 사용자": { label: "총무팀", description: "회의실 운영을 총괄하고 정책을 관리하는 팀", icon: "team" },
    "고객": { label: "방문자", description: "외부 방문객이 회의실을 예약하는 경우", icon: "visitor" },
  };
  const roleDescription = (description: string) => {
    const lineBreaks: Record<string, string> = {
      "회의실을 검색하고 예약하는 구성원": "회의실을 검색하고",
      "회의실 정보와 예약 현황을 관리하는 담당자": "회의실 정보와",
      "회의실 운영을 총괄하고 정책을 관리하는 팀": "회의실 운영을 총괄하고",
      "외부 방문객이 회의실을 예약하는 경우": "외부 방문객이",
    };
    const firstLine = isUserRoleQuestion ? lineBreaks[description] : undefined;
    return firstLine ? <>{firstLine}<br className="question-option-break-desktop" />{description.slice(firstLine.length).trim()}</> : description;
  };
  const hasAnswerDraft = draft.selectedValues.length > 0 || Boolean(draft.customText.trim()) || draft.numberValue !== undefined || draft.rangeValue !== undefined || (draft.rankedValues?.length ?? 0) > 0;
  const showSubmit = hasAnswerDraft || draft.action === "defer";
  const formErrorId = `question-error-${shown.id}`;
  const update = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values, ...(values.action === undefined ? { action: "answer" } : {}) }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const checked = validateQuestionAnswer(shown, draft);
    if (!checked.valid) { setError(checked.error ?? "답변을 확인해 주세요."); return; }
    setError("");
    onSubmit(draft.action === "defer" ? { action: "defer", selectedValues: [], customText: "" } : { ...draft, customText: draft.customText.trim() }, shown.answerMode);
  };
  const chooseAction = (action: AnswerAction) => {
    const candidate = { ...draft, action };
    const checked = validateQuestionAnswer(shown, candidate);
    if (!checked.valid) { setError(checked.error ?? "응답을 확인해 주세요."); return; }
    setError("");
    onSubmit(candidate, shown.answerMode);
  };
  const toggleOption = (value: string, checked: boolean) => update({ selectedValues: checked ? [...draft.selectedValues, value] : draft.selectedValues.filter((item) => item !== value) });

  return <article className="question-card" aria-labelledby={`question-title-${shown.id}`}>
    <div className="question-card-meta"><span>{areaLabels[shown.area] ?? shown.area}</span><span>{shown.required ? "필수" : "선택"}</span></div>
    <h2 id={`question-title-${shown.id}`}>{displayPrompt}</h2>
    <p className="question-card-help">{displayHelp}</p>
    {shown.safeTextFallback ? <p className="question-card-safe-note" role="status">질문 형식을 확인할 수 없어 안전한 직접 입력으로 표시합니다. 입력한 답변은 제출 전 저장되지 않습니다.</p> : null}
    <form onSubmit={submit} noValidate>
      {shown.answerMode === "text" ? <label className="question-card-field">직접 입력<textarea rows={4} value={draft.customText} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ customText: event.target.value })} /></label> : null}
      {shown.answerMode === "number" ? <label className="question-card-field">{shown.unit ? `예상 수량 (${shown.unit})` : "숫자"}<input type="number" min={shown.min} max={shown.max} value={draft.numberValue ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ numberValue: event.target.value === "" ? undefined : Number(event.target.value) })} /></label> : null}
      {shown.answerMode === "range" ? <fieldset className="question-card-field question-card-range"><legend>{shown.unit ? `범위 (${shown.unit})` : "범위"}</legend><label>시작<input type="number" min={shown.min} max={shown.max} value={draft.rangeValue?.start ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ rangeValue: { start: event.target.value === "" ? Number.NaN : Number(event.target.value), end: draft.rangeValue?.end ?? Number.NaN } })} /></label><label>끝<input type="number" min={shown.min} max={shown.max} value={draft.rangeValue?.end ?? ""} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ rangeValue: { start: draft.rangeValue?.start ?? Number.NaN, end: event.target.value === "" ? Number.NaN : Number(event.target.value) } })} /></label></fieldset> : null}
      {["single", "multiple", "confirm"].includes(shown.answerMode) ? <fieldset className="question-card-options" aria-describedby={error ? formErrorId : undefined}><legend>{shown.answerMode === "multiple" ? "해당하는 항목을 모두 선택하세요" : "항목을 선택하세요"}</legend>{options.map((option) => { const copy = isUserRoleQuestion ? roleCopy[option.label] : undefined; return <label className="question-card-option" key={option.value}>{copy ? <span className={`question-option-icon is-${copy.icon}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">{copy.icon === "team" ? <><path d="M12 7v5m0 0H6v3m6-3h6v3" /><circle cx="12" cy="5" r="2" /><rect x="4" y="15" width="4" height="4" rx="1" /><rect x="16" y="15" width="4" height="4" rx="1" /></> : <path d={copy.icon === "employee" ? "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" : copy.icon === "admin" ? "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" : "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"} />}</svg></span> : null}<input type={shown.answerMode === "multiple" ? "checkbox" : "radio"} name={`question-${shown.id}`} value={option.value} checked={draft.selectedValues.includes(option.value)} onChange={(event) => shown.answerMode === "multiple" ? toggleOption(option.value, event.target.checked) : update({ selectedValues: [option.value] })} /><span className="question-option-copy"><strong>{copy?.label ?? option.label}</strong>{copy?.description || option.description ? <small>{copy?.description ? roleDescription(copy.description) : option.description}</small> : null}</span>{option.recommended ? <small>추천 · {option.recommendationReason}</small> : null}</label>; })}</fieldset> : null}
      {shown.answerMode === "rank" ? <fieldset className="question-card-rank" aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined}><legend>순서를 정할 항목</legend><div className="question-card-options">{options.map((option) => <label className="question-card-option" key={option.value}><input type="checkbox" checked={(draft.rankedValues ?? []).includes(option.value)} onChange={(event) => { const values = draft.rankedValues ?? []; update({ rankedValues: event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value) }); }} /><span>{option.label}</span></label>)}</div><ol>{(draft.rankedValues ?? []).map((value, index, values) => <li key={value}><span>{options.find((item) => item.value === value)?.label ?? value}</span><button type="button" aria-label={`${options.find((item) => item.value === value)?.label ?? value} 순위 위로`} disabled={index === 0} onClick={() => { const next = [...values]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update({ rankedValues: next }); }}>위로</button><button type="button" aria-label={`${options.find((item) => item.value === value)?.label ?? value} 순위 아래로`} disabled={index === values.length - 1} onClick={() => { const next = [...values]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; update({ rankedValues: next }); }}>아래로</button></li>)}</ol></fieldset> : null}
      {error ? <p className="question-card-error" id={formErrorId} role="alert">{error}</p> : null}
      {draft.action === "defer" ? <p className="question-card-defer-impact" role="status">이 질문을 미정으로 답변 이력에 남기고 다음 질문으로 진행합니다. 질문과 이력은 저장되어 나중에 다시 결정할 수 있습니다.</p> : null}
      <div className="question-card-actions"><button type="button" onClick={() => chooseAction("unknown")}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="11" r="8" /><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.2 1-1.9 1.3-1.9 3m0 3h.01" /></svg></span>잘 모르겠어요</button><button type="button" onClick={() => chooseAction("recommend")}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="m12 2 2.1 7.1L21 12l-6.9 2.9L12 22l-2.1-7.1L3 12l6.9-2.9L12 2Z" /></svg></span>추천해 주세요</button><button type="button" aria-pressed={draft.action === "defer"} onClick={() => { setError(""); setDraft((current) => ({ ...current, action: "defer" })); }}><span className="question-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>나중에 결정</button>{!shown.required ? <button type="button" onClick={() => chooseAction("skip")}>건너뛰기</button> : null}{shown.allowCustomAnswer && shown.answerMode !== "text" && !isUserRoleQuestion ? <details className="question-card-custom"><summary>직접 입력 (선택)</summary><label className="question-card-field">직접 입력<input value={draft.customText} aria-invalid={Boolean(error)} aria-describedby={error ? formErrorId : undefined} onChange={(event) => update({ customText: event.target.value })} /></label></details> : null}{showSubmit ? <button className="question-card-submit" type="submit">{draft.action === "defer" ? "나중에 결정 확인" : "답변 제출"}</button> : null}</div>
    </form>
  </article>;
}
