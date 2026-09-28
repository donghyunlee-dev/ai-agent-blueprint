const fields = [
  "serviceName", "serviceDesc", "features", "env", "users", "os", "db", "dbExist", "dbType",
  "auth", "authTypes", "notif", "notifChannels", "automation", "aiAgent", "tools", "git", "deploy",
  "security", "test", "timeline", "devExist", "extraNote",
];

export const conversationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantMessage: { type: "string" },
    suggestions: { type: "array", items: { type: "string" } },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", enum: fields },
          value: { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
          label: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["field", "value", "label", "rationale"],
      },
    },
    nextQuestion: { type: "string" },
    nextPhase: { type: "string", enum: ["service", "environment", "data", "automation", "tools", "deployment", "review", "complete"] },
    canComplete: { type: "boolean" },
  },
  required: ["assistantMessage", "suggestions", "decisions", "nextQuestion", "nextPhase", "canComplete"],
};

export function getOpenAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const values = (payload?.output || []).flatMap((item) => (item?.content || []))
    .filter((item) => item?.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text);
  return values.join("\n");
}

export async function requestStructuredOutput({ name, schema, messages }) {
  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) {
    const error = new Error("OPENAI_NOT_CONFIGURED");
    error.statusCode = 503;
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: messages, text: { format: { type: "json_schema", name, strict: true, schema } } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`OpenAI request failed (${response.status})`);
      error.statusCode = response.status === 429 ? 429 : 502;
      throw error;
    }
    const text = extractOutputText(await response.json());
    if (!text) throw new Error("OpenAI response was empty");
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export function sendJson(res, status, payload) {
  if (typeof res.status === "function") return res.status(status).json(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
