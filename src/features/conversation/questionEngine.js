const featureOptions = [
  { value: "chart", title: "차트/그래프" }, { value: "table", title: "표/목록" },
  { value: "upload", title: "파일 업로드" }, { value: "report", title: "리포트/문서 출력" },
  { value: "alert", title: "알림 기능" }, { value: "auto", title: "자동화/스케줄" },
];
const authTypeOptions = ["email", "google", "github", "sso"].map((value) => ({ value, title: value }));
const dbTypeOptions = ["mysql", "postgres", "mongodb", "sqlite", "supabase", "etc"].map((value) => ({ value, title: value }));
const securityOptions = [
  { value: "personal", title: "개인/민감 정보" },
  { value: "financial", title: "금융/결제" },
  { value: "internal", title: "사내 내부" },
  { value: "none", title: "해당 없음" },
];
const toolOptions = ["github", "jira", "confluence", "notion", "slack", "teams", "none"].map((value) => ({ value, title: value }));

const target = {
  problem: ["problem"], user: ["user_role"], goal: ["goal"], scope: ["scope"],
  features: ["requirement"], priority: ["requirement"], scale: ["success_metric"], data: ["technical_decision"],
  identity: ["technical_decision"], security: ["constraint"], integrations: ["technical_decision"], delivery: ["constraint"],
};
const contextKeywords = {
  problem: ["문제", "불편", "어려움"], user: ["사용자", "고객", "대상"], goal: ["목표", "결과", "달성"],
  scope: ["범위", "첫 버전", "mvp"], features: ["기능", "업무"], priority: ["우선순위", "중요"],
  scale: ["사용자 수", "규모", "많이"], data: ["저장", "데이터", "이력"], identity: ["로그인", "권한", "계정"],
  security: ["보안", "개인정보", "민감"], integrations: ["연동", "도구", "협업"], delivery: ["배포", "운영", "환경"],
};
// Stable final tie preference from the product contract: problem, user, then goal.
const tiePreference = ["problem", "user", "goal", "scope", "features", "priority", "scale", "data", "identity", "security", "integrations", "delivery"];

function question(id, area, topic, prompt, help, answerMode, required, options = [], extra = {}) {
  return { id, area, topic, prompt, help, answerMode, required, allowCustomAnswer: true, allowUnknown: true,
    allowRecommendation: true, allowDefer: true, targetItemTypes: target[area], allowedAnswerModes: [answerMode], options,
    contextKeywords: contextKeywords[area], fatigueGroup: area, factors: { downstreamImpact: required ? 3 : 1, risk: area === "security" ? 3 : 1, uncertainty: 2 }, ...extra };
}

export const QUESTION_CATALOG = [
  question("problem", "problem", "problem.statement", "사용자가 해결해야 하는 가장 중요한 문제는 무엇인가요?", "이 답은 제품의 범위와 성공 기준을 정하는 출발점입니다.", "text", true),
  question("user-role", "user", "user.roles", "주요 사용자는 누구인가요?", "사용자 역할을 모두 선택할 수 있습니다.", "multiple", true, ["운영 담당자", "관리자", "일반 사용자", "고객"].map((label) => ({ value: label, label }))),
  question("goal", "goal", "goal.outcome", "사용자가 제품으로 이루려는 결과는 무엇인가요?", "관찰 가능한 결과를 적어 주세요.", "text", true),
  question("scope", "scope", "scope.mvp", "첫 버전에 반드시 포함할 범위는 어디까지인가요?", "핵심 업무와 제외할 범위를 구분합니다.", "confirm", true, ["핵심 업무만", "핵심 업무와 운영 도구"].map((label) => ({ value: label, label }))),
  question("core-features", "features", "features.core", "첫 버전의 핵심 기능은 무엇인가요?", "최대 5개까지 선택하거나 직접 입력할 수 있습니다.", "multiple", true, featureOptions.map(({ value, title, description }) => ({ value, label: title, description })), { maxSelections: 5, fatigueGroup: "feature-prioritization" }),
  question("feature-priority", "priority", "features.priority", "핵심 기능의 우선순위를 정해 주세요.", "항목을 고른 뒤 위·아래 버튼으로 순서를 조정합니다.", "rank", false, featureOptions.map(({ value, title }) => ({ value, label: title })), { minSelections: 2, fatigueGroup: "feature-prioritization" }),
  question("usage-volume", "scale", "scale.users", "초기 사용자는 몇 명으로 예상하나요?", "대략적인 수를 입력해 주세요.", "number", false, [], { min: 1, max: 10000000, unit: "명" }),
  question("volume-range", "scale", "scale.peak", "평소와 최대 사용량 범위를 예상해 주세요.", "시작 값은 끝 값보다 클 수 없습니다.", "range", false, [], { min: 0, max: 10000000, unit: "명" }),
  question("data-needed", "data", "data.persistence", "사용 이력이나 결과 저장이 필요한가요?", "저장하지 않아도 되는 경우 데이터베이스 질문은 생략됩니다.", "single", true, [{ value: "yes", label: "네, 저장이 필요해요" }, { value: "no", label: "아니요, 임시 처리면 돼요" }]),
  question("login-needed", "identity", "identity.login", "사용자별 로그인이나 권한이 필요한가요?", "아니요를 선택하면 로그인 방식 질문은 생략됩니다.", "single", true, [{ value: "yes", label: "네, 필요해요" }, { value: "no", label: "아니요" }]),
  question("login-method", "identity", "identity.method", "어떤 로그인 방식을 지원할까요?", "사용자별 데이터나 권한이 필요한 경우 선택합니다.", "multiple", true, authTypeOptions.map(({ value, title }) => ({ value, label: title })), { prerequisites: [{ questionId: "login-needed", expectedValues: ["yes"] }], when: (aggregate) => answerHas(aggregate, "login-needed", "yes") }),
  question("database-type", "data", "data.storage", "어떤 저장소를 사용할까요?", "데이터 저장이 필요한 경우 선택합니다.", "single", false, dbTypeOptions.map(({ value, title }) => ({ value, label: title })), { prerequisites: [{ questionId: "data-needed", expectedValues: ["yes"] }], when: (aggregate) => answerHas(aggregate, "data-needed", "yes") }),
  question("security", "security", "security.constraints", "고려해야 할 보안 요구를 확인해 주세요.", "해당 항목을 모두 선택합니다.", "multiple", false, securityOptions.map(({ value, title }) => ({ value, label: title }))),
  question("integrations", "integrations", "integrations.tools", "연동할 협업 도구가 있나요?", "필요한 도구를 선택하거나 직접 입력합니다.", "multiple", false, toolOptions.map(({ value, title }) => ({ value, label: title }))),
  question("delivery", "delivery", "delivery.environment", "어떤 배포 환경과 운영 제약이 있나요?", "지역, 운영체제, 일정 등 제약을 적어 주세요.", "text", false),
];

const SUPPORTED_MODES = new Set(["single", "multiple", "text", "number", "range", "rank", "confirm"]);
const DEFAULT_VERSION = "1";

function answerHas(aggregate, questionId, value) {
  const latest = [...(aggregate?.answers ?? [])].reverse().find((item) => item.questionId === questionId);
  return latest?.action === "answer" && (latest.selectedValues?.includes(value) ?? false);
}

export function validateQuestionSpec(spec) {
  if (!spec || !SUPPORTED_MODES.has(spec.answerMode) || !spec.allowedAnswerModes?.includes(spec.answerMode)
    || !Array.isArray(spec.targetItemTypes) || !spec.targetItemTypes.length) throw new Error("QUESTION_SCHEMA_INVALID");
  return true;
}

export function getQuestionCandidates(aggregate, incomingSpec) {
  if (incomingSpec) validateQuestionSpec(incomingSpec);
  const confirmed = (aggregate?.designItems ?? []).filter((item) => item.status === "confirmed");
  return QUESTION_CATALOG.filter((item) => {
    validateQuestionSpec(item);
    const latestAnswer = [...(aggregate?.answers ?? [])].reverse().find((answer) => answer.questionId === item.id);
    const needsReview = latestAnswer?.action === "answer" && getAnswerReviewState(aggregate, latestAnswer).reviewRequired;
    if ((latestAnswer && !needsReview) || (item.when && !item.when(aggregate))) return false;
    const sameMeaning = confirmed.some((design) => design.key === item.topic || design.attributes?.semanticKey === item.topic);
    return !sameMeaning;
  }).map((item) => {
    const latestAnswer = [...(aggregate?.answers ?? [])].reverse().find((answer) => answer.questionId === item.id);
    return { ...item, catalogVersion: DEFAULT_VERSION, reviewRequired: latestAnswer?.action === "answer" && getAnswerReviewState(aggregate, latestAnswer).reviewRequired };
  });
}

export function getAnswerReviewState(aggregate, answer) {
  const questionSpec = QUESTION_CATALOG.find((item) => item.id === answer?.questionId);
  if (!questionSpec?.prerequisites?.length || answer?.action !== "answer") return { reviewRequired: false };
  const answerIndex = aggregate.answers.indexOf(answer);
  if (answerIndex < 0 || aggregate.answers.slice(answerIndex + 1).some((item) => item.questionId === answer.questionId)) return { reviewRequired: false };
  const fingerprint = (item) => JSON.stringify({
    action: item.action,
    selectedValues: [...(item.selectedValues ?? [])].sort(),
    customText: item.customText?.trim() ?? "",
    numberValue: item.numberValue ?? null,
    rangeValue: item.rangeValue ?? null,
  });
  const changedPrerequisite = questionSpec.prerequisites.some(({ questionId, expectedValues }) => {
    const previous = [...aggregate.answers.slice(0, answerIndex)].reverse().find((item) => item.questionId === questionId);
    const following = aggregate.answers.slice(answerIndex + 1).filter((item) => item.questionId === questionId);
    const previousMeaning = previous ? fingerprint(previous) : JSON.stringify({ action: "answer", selectedValues: expectedValues, customText: "", numberValue: null, rangeValue: null });
    return following.some((item) => fingerprint(item) !== previousMeaning);
  });
  return { reviewRequired: changedPrerequisite };
}

function scoreForContext(questionSpec, aggregate) {
  const recentText = (aggregate?.messages ?? []).filter((message) => message.role === "user").slice(-3).map((message) => message.content.toLocaleLowerCase()).join(" ");
  return (questionSpec.contextKeywords ?? []).reduce((score, keyword) => score + (recentText.includes(keyword.toLocaleLowerCase()) ? 1 : 0), 0);
}

function scoreForFatigue(questionSpec, aggregate) {
  const recentAnswers = (aggregate?.answers ?? []).slice(-3);
  return recentAnswers.reduce((score, answer) => score + (QUESTION_CATALOG.find((item) => item.id === answer.questionId)?.fatigueGroup === questionSpec.fatigueGroup ? 1 : 0), 0);
}

export function rankQuestionCandidates(candidates, aggregate) {
  return [...candidates].sort((a, b) => Number(b.required) - Number(a.required)
    || Number(Boolean(b.reviewRequired)) - Number(Boolean(a.reviewRequired))
    || b.factors.downstreamImpact - a.factors.downstreamImpact
    || b.factors.risk - a.factors.risk
    || b.factors.uncertainty - a.factors.uncertainty
    || scoreForContext(b, aggregate) - scoreForContext(a, aggregate)
    || scoreForFatigue(a, aggregate) - scoreForFatigue(b, aggregate)
    || tiePreference.indexOf(a.area) - tiePreference.indexOf(b.area));
}

export function selectNextQuestion(aggregate) {
  if ((aggregate?.project?.readiness?.pendingProposalCount ?? 0) > 0 || (aggregate?.proposals ?? []).some((item) => item.status === "pending")) return null;
  return rankQuestionCandidates(getQuestionCandidates(aggregate), aggregate)[0] ?? null;
}

export function resolveQuestionForDisplay(spec, displayedCatalogVersion = DEFAULT_VERSION) {
  validateQuestionSpec(spec);
  if (spec.catalogVersion && spec.catalogVersion !== displayedCatalogVersion) return { ...spec, answerMode: "text", allowedAnswerModes: ["text"], options: [], safeTextFallback: true };
  return spec;
}

export function validateQuestionAnswer(spec, answer) {
  validateQuestionSpec(spec);
  const error = (message) => ({ valid: false, error: message });
  if (!answer || !["answer", "unknown", "recommend", "defer", "skip"].includes(answer.action)) return error("올바른 응답을 선택해 주세요.");
  if (answer.action === "unknown" && spec.allowUnknown) return { valid: true };
  if (answer.action === "recommend" && spec.allowRecommendation) return { valid: true };
  if (answer.action === "defer" && spec.allowDefer) return { valid: true };
  if (answer.action === "skip" && !spec.required) return { valid: true };
  if (answer.action !== "answer") return error("이 질문에서는 해당 응답을 사용할 수 없습니다.");
  const custom = typeof answer.customText === "string" ? answer.customText.trim() : "";
  if (custom) return { valid: true };
  if (spec.answerMode === "text") return spec.required && !custom ? error("답변을 입력해 주세요.") : { valid: true };
  if (spec.answerMode === "number") return Number.isFinite(answer.numberValue) && answer.numberValue >= (spec.min ?? -Infinity) && answer.numberValue <= (spec.max ?? Infinity) ? { valid: true } : error("허용된 범위의 숫자를 입력해 주세요.");
  if (spec.answerMode === "range") return answer.rangeValue && Number.isFinite(answer.rangeValue.start) && Number.isFinite(answer.rangeValue.end)
    && answer.rangeValue.start <= answer.rangeValue.end && answer.rangeValue.start >= (spec.min ?? -Infinity) && answer.rangeValue.end <= (spec.max ?? Infinity) ? { valid: true } : error("시작 값이 끝 값보다 작거나 같은 범위를 입력해 주세요.");
  const values = spec.answerMode === "rank" ? answer.rankedValues : answer.selectedValues;
  const selected = Array.isArray(values) ? values : [];
  const allowedValues = new Set((spec.options ?? []).map((option) => option.value));
  if (allowedValues.size && selected.some((value) => !allowedValues.has(value))) return error("목록에 있는 항목을 선택해 주세요.");
  if (spec.answerMode === "rank" && new Set(selected).size !== selected.length) return error("순위에 같은 항목을 중복할 수 없습니다.");
  if (spec.answerMode === "single" || spec.answerMode === "confirm") return selected.length === 1 || (!spec.required && selected.length === 0) ? { valid: true } : error("항목을 하나 선택해 주세요.");
  if (selected.length < (spec.minSelections ?? (spec.required ? 1 : 0))) return error("필수 항목을 선택해 주세요.");
  if (selected.length > (spec.maxSelections ?? Infinity)) return error(`최대 ${spec.maxSelections}개까지 선택할 수 있습니다.`);
  return { valid: true };
}

export function createQuestionAnswerRecord({ id, projectId, threadId, question: questionSpec, answer, effectiveAnswerMode, createdAt }) {
  return {
    id,
    projectId,
    threadId,
    questionId: questionSpec.id,
    logicalRequestId: id,
    answerMode: effectiveAnswerMode ?? questionSpec.answerMode,
    action: answer.action,
    createdAt,
    ...(answer.selectedValues?.length ? { selectedValues: answer.selectedValues } : {}),
    ...(answer.customText?.trim() ? { customText: answer.customText.trim() } : {}),
    ...(answer.numberValue !== undefined ? { numberValue: answer.numberValue } : {}),
    ...(answer.rangeValue ? { rangeValue: answer.rangeValue } : {}),
    ...(answer.rankedValues?.length ? { rankedValues: answer.rankedValues } : {}),
  };
}
