import { conversationSchema, requestStructuredOutput, sendJson } from "../_lib/blueprint-openai.js";

const phaseGuidance = {
  service: "서비스 이름, 해결 문제, 사용자, 핵심 기능을 파악한다.",
  environment: "실행 환경(web/pc/both), 사용자 규모(solo/small/org), OS를 파악한다.",
  data: "DB 필요 여부와 종류, 로그인 필요 여부와 방식을 파악한다.",
  automation: "알림 필요 여부/채널과 자동화 작업을 파악한다.",
  tools: "AI Agent, 협업 도구, Git 사용 여부를 파악한다.",
  deployment: "배포, 보안, 테스트, 일정, 개발 방식을 파악한다.",
  complete: "완료된 설계를 요약한다.",
};

const allowedValues = {
  features: ["chart", "table", "upload", "report", "alert", "auto"], env: ["web", "pc", "both"],
  users: ["solo", "small", "org"], os: ["windows", "mac", "linux"], db: ["yes", "no"], dbExist: ["yes", "no"],
  dbType: ["mysql", "postgres", "mongodb", "sqlite", "supabase", "etc"], auth: ["yes", "no"],
  authTypes: ["email", "google", "github", "sso"], notif: ["yes", "no"],
  notifChannels: ["slack", "teams", "email", "kakao", "webhook", "push"],
  automation: ["schedule", "batch", "report", "monitor", "none"], aiAgent: ["claude", "codex", "gemini", "cursor", "none"],
  tools: ["github", "jira", "confluence", "notion", "slack", "teams", "none"], git: ["yes", "plan", "no"],
  deploy: ["cloud", "onprem", "local"], security: ["personal", "financial", "internal", "none"],
  test: ["yes", "no"], timeline: ["urgent", "normal", "long"], devExist: ["yes", "nocode", "both"],
};

function normalizeEnum(field, value) {
  const raw = String(value).trim().toLowerCase();
  if (allowedValues[field]?.includes(raw)) return raw;
  if (field === "users") return raw.includes("2~10") || raw.includes("소규모") ? "small" : raw.includes("혼자") || raw === "1" ? "solo" : raw.includes("10명") || raw.includes("조직") ? "org" : null;
  if (field === "env") return raw.includes("웹") || raw.includes("browser") ? "web" : raw.includes("pc") || raw.includes("로컬") ? "pc" : null;
  if (["db", "dbExist", "auth", "notif", "test"].includes(field)) return /^(yes|네|필요|사용|있)/.test(raw) ? "yes" : /^(no|아니|불필요|미사용|없)/.test(raw) ? "no" : null;
  return null;
}

function normalizeResult(result, targetField, requestOptions = []) {
  const freeTextFields = new Set(["serviceName", "serviceDesc", "extraNote"]);
  const requestValues = new Set(requestOptions.map((option) => option.value));
  return {
    ...result,
    decisions: (result.decisions || []).flatMap((decision) => {
      if (decision.field !== targetField) return [];
      if (freeTextFields.has(decision.field)) return [{ ...decision, value: String(decision.value).trim() }];
      if (decision.field === "features") {
        const values = (Array.isArray(decision.value) ? decision.value : [decision.value]).map((value) => String(value).trim()).filter(Boolean);
        return values.length ? [{ ...decision, value: values }] : [];
      }
      if (requestValues.size) {
        const values = (Array.isArray(decision.value) ? decision.value : [decision.value]).map((value) => String(value).trim().toLowerCase()).filter((value) => requestValues.has(value));
        return values.length ? [{ ...decision, value: Array.isArray(decision.value) ? values : values[0] }] : [];
      }
      if (!allowedValues[decision.field]) return [];
      if (Array.isArray(decision.value)) {
        const value = decision.value.map((item) => normalizeEnum(decision.field, item)).filter(Boolean);
        return value.length ? [{ ...decision, value }] : [];
      }
      const value = normalizeEnum(decision.field, decision.value);
      return value ? [{ ...decision, value }] : [];
    }),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  const body = req.body || {};
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 4000) {
    return sendJson(res, 400, { error: "INVALID_MESSAGE" });
  }
  const history = Array.isArray(body.history) ? body.history.slice(-16) : [];
  const confirmed = Array.isArray(body.confirmedDecisions) ? body.confirmedDecisions : [];
  const stagePhases = ["service", "environment", "data", "automation", "tools", "deployment"];
  const phase = stagePhases[Math.max(0, Math.min(5, Number(body.stage || 1) - 1))];
  const targetField = typeof body.targetField === "string" ? body.targetField : "serviceDesc";
  const allowedOptions = Array.isArray(body.allowedOptions) ? body.allowedOptions : [];
  try {
    const result = await requestStructuredOutput({
      name: "conversational_blueprint_turn",
      schema: conversationSchema,
      messages: [
        {
          role: "system",
          content: [
            "당신은 한국어로 대화하는 서비스 설계 컨설턴트다.",
            "한 번에 현재 phase에 필요한 내용만 분석하고 1개의 다음 질문을 한다.",
            "사용자 답변에서 확인 가능한 값만 decisions에 제안하며 자동 확정하지 않는다.",
            "결정 값은 제공된 필드 enum과 기존 SurveyFormData 코드값을 사용한다.",
            "추천 선택지는 2~4개 짧은 한국어 문장으로 만든다.",
            `현재 단계 지침: ${phaseGuidance[phase]}`,
            `반드시 현재 질문의 targetField(${targetField})만 decisions에 반환하고 다른 필드는 반환하지 않는다.`,
            `현재 질문: ${String(body.question || "")}`,
            `도움말: ${String(body.help || "")}`,
            `허용 선택지: ${JSON.stringify(allowedOptions)}`,
          ].join(" "),
        },
        { role: "developer", content: `확정된 결정: ${JSON.stringify(confirmed)}\n응답은 JSON schema를 정확히 따른다.` },
        ...history.map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").slice(0, 4000) })),
      ],
    });
    return sendJson(res, 200, normalizeResult(result, targetField, allowedOptions));
  } catch (error) {
    return sendJson(res, error.statusCode || 502, { error: error.message || "OPENAI_ERROR" });
  }
}
