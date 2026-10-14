import { validateModelConfiguration } from "../../src/infrastructure/ai/model-registry.js";

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

export function getOpenAiConfig(env = process.env) {
  try {
    validateModelConfiguration(env);
  } catch (error) {
    error.statusCode = 503;
    throw error;
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.AI_MODEL_DEFAULT.trim(),
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const values = (payload?.output || []).flatMap((item) => (item?.content || []))
    .filter((item) => item?.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text);
  return values.join("\n");
}

export async function requestStructuredOutput({ name, schema, messages, signal }) {
  const { apiKey, model } = getOpenAiConfig();
  if (!apiKey) {
    const error = new Error("OPENAI_NOT_CONFIGURED");
    error.statusCode = 503;
    throw error;
  }
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
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
      error.statusCode = response.status === 429 ? 429 : response.status >= 500 ? 502 : 503;
      if (response.status < 500 && response.status !== 429) error.code = "AI_PROVIDER_REJECTED";
      throw error;
    }
    const text = extractOutputText(await response.json());
    if (!text) {
      const error = new Error("AI output was empty");
      error.code = "AI_INVALID_OUTPUT";
      throw error;
    }
    try { return JSON.parse(text); }
    catch {
      const error = new Error("AI output was not valid JSON");
      error.code = "AI_INVALID_OUTPUT";
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function sendJson(res, status, payload) {
  if (typeof res.status === "function") return res.status(status).json(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
