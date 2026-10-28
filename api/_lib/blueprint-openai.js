import { aiModelRegistry, validateModelConfiguration } from "../../src/infrastructure/ai/model-registry.js";
import { decodeOpenAiStrictOutput, toOpenAiStrictSchema } from "../../src/infrastructure/ai/openai-strict-schema.js";

const SAFE_PROVIDER_ERROR_TYPES = new Set(["api_error", "authentication_error", "billing_error", "invalid_request_error", "not_found_error", "permission_error", "rate_limit_error", "server_error"]);
const SAFE_PROVIDER_ERROR_CODES = new Set(["context_length_exceeded", "insufficient_quota", "invalid_api_key", "invalid_json_schema", "model_not_found", "permission_denied", "rate_limit_exceeded", "server_error", "unsupported_parameter", "unsupported_value"]);
const SAFE_PROVIDER_ERROR_PARAMS = new Set(["model", "input", "text.format", "text.format.schema", "reasoning.effort"]);
const SAFE_INCOMPLETE_REASONS = new Set(["max_output_tokens", "content_filter"]);
const SAFE_RESPONSE_STATUSES = new Set(["cancelled", "completed", "incomplete", "failed", "in_progress", "queued"]);

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
    const setting = error.message.match(/\bAI_MODEL_(?:LIGHT|DEFAULT|FINAL)\b/)?.[0] ?? "AI_MODEL_CONFIGURATION";
    console.error("OPENAI_CONFIGURATION_UNAVAILABLE", { setting });
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

function logInvalidOutput({ name, model, response, payload, failure, maxOutputTokens }) {
  const usage = payload?.usage;
  const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const status = SAFE_RESPONSE_STATUSES.has(payload?.status) ? payload.status : "unknown";
  console.error("OPENAI_OUTPUT_INVALID", {
    operation: name,
    model,
    requestId: response.headers?.get?.("x-request-id") ?? null,
    status,
    failure,
    ...(count(usage?.input_tokens) === undefined ? {} : { inputTokens: count(usage.input_tokens) }),
    ...(count(usage?.output_tokens) === undefined ? {} : { outputTokens: count(usage.output_tokens) }),
    ...(count(usage?.output_tokens_details?.reasoning_tokens) === undefined ? {} : { reasoningTokens: count(usage.output_tokens_details.reasoning_tokens) }),
    ...(Number.isSafeInteger(maxOutputTokens) && maxOutputTokens >= 0 ? { maxOutputTokens } : {}),
  });
}

export async function requestStructuredOutput({ name, schema, messages, signal, reasoningEffort, model, maxOutputTokens, timeoutMs = 45_000 }) {
  const { apiKey, model: defaultModel } = getOpenAiConfig();
  const allowedModels = new Set(Object.values(aiModelRegistry.profiles).map((profile) => profile.model));
  if (model && !allowedModels.has(model)) {
    const error = new Error("AI_MODEL_NOT_REGISTERED");
    error.statusCode = 503;
    throw error;
  }
  const resolvedModel = model ?? defaultModel;
  if (!apiKey) {
    const error = new Error("OPENAI_NOT_CONFIGURED");
    error.statusCode = 503;
    console.error("OPENAI_CONFIGURATION_UNAVAILABLE", { setting: "OPENAI_API_KEY" });
    throw error;
  }
  const providerSchema = toOpenAiStrictSchema(schema);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: resolvedModel, input: messages, ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}), ...(maxOutputTokens === undefined ? {} : { max_output_tokens: maxOutputTokens }), text: { format: { type: "json_schema", name, strict: true, schema: providerSchema } } }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let providerError;
      try { providerError = (await response.json())?.error; } catch { /* Provider error bodies are best-effort diagnostics only. */ }
      const providerErrorType = SAFE_PROVIDER_ERROR_TYPES.has(providerError?.type) ? providerError.type : undefined;
      const providerErrorCode = SAFE_PROVIDER_ERROR_CODES.has(providerError?.code) ? providerError.code : undefined;
      const providerErrorParam = SAFE_PROVIDER_ERROR_PARAMS.has(providerError?.param)
        ? providerError.param : undefined;
      console.error("OPENAI_RESPONSE_REJECTED", {
        operation: name,
        model: resolvedModel,
        status: response.status,
        requestId: response.headers?.get?.("x-request-id") ?? null,
        ...(providerErrorType ? { providerErrorType } : {}),
        ...(providerErrorCode ? { providerErrorCode } : {}),
        ...(providerErrorParam ? { providerErrorParam } : {}),
      });
      const error = new Error(`OpenAI request failed (${response.status})`);
      error.statusCode = response.status === 429 ? 429 : response.status >= 500 ? 502 : 503;
      if (response.status < 500 && response.status !== 429) error.code = "AI_PROVIDER_REJECTED";
      throw error;
    }
    const payload = await response.json();
    const responseStatus = SAFE_RESPONSE_STATUSES.has(payload?.status) ? payload.status : "unknown";
    if (responseStatus !== "completed") {
      const incompleteReason = SAFE_INCOMPLETE_REASONS.has(payload.incomplete_details?.reason)
        ? payload.incomplete_details.reason : undefined;
      const usage = payload.usage;
      const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : undefined;
      const requestId = response.headers?.get?.("x-request-id") ?? null;
      console.error("OPENAI_RESPONSE_INCOMPLETE", {
        operation: name,
        model: resolvedModel,
        requestId,
        status: responseStatus,
        ...(incompleteReason ? { reason: incompleteReason } : {}),
        ...(count(usage?.input_tokens) === undefined ? {} : { inputTokens: count(usage.input_tokens) }),
        ...(count(usage?.output_tokens) === undefined ? {} : { outputTokens: count(usage.output_tokens) }),
        ...(count(usage?.output_tokens_details?.reasoning_tokens) === undefined ? {} : { reasoningTokens: count(usage.output_tokens_details.reasoning_tokens) }),
        ...(Number.isSafeInteger(maxOutputTokens) && maxOutputTokens >= 0 ? { maxOutputTokens } : {}),
      });
      const error = new Error("OpenAI response was incomplete");
      error.code = "AI_OUTPUT_INCOMPLETE";
      throw error;
    }
    const text = extractOutputText(payload);
    if (!text) {
      logInvalidOutput({ name, model: resolvedModel, response, payload, failure: "empty_output", maxOutputTokens });
      const error = new Error("AI output was empty");
      error.code = "AI_INVALID_OUTPUT";
      throw error;
    }
    try { return decodeOpenAiStrictOutput(JSON.parse(text), schema); }
    catch {
      logInvalidOutput({ name, model: resolvedModel, response, payload, failure: "invalid_json", maxOutputTokens });
      const error = new Error("AI output was not valid JSON");
      error.code = "AI_INVALID_OUTPUT";
      throw error;
    }
  } catch (error) {
    if (timedOut) console.error("OPENAI_REQUEST_TIMED_OUT", { operation: name, model: resolvedModel, timeoutMs });
    throw error;
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
