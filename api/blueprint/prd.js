import { requestStructuredOutput, sendJson } from "../_lib/blueprint-openai.js";

const schema = {
  type: "object", additionalProperties: false,
  properties: { title: { type: "string" }, summary: { type: "string" }, prdMarkdown: { type: "string" } },
  required: ["title", "summary", "prdMarkdown"],
};

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  try {
    const result = await requestStructuredOutput({
      name: "blueprint_prd",
      schema,
      messages: [
        { role: "system", content: "요구사항명세서와 추가 입력을 기반으로 한국어 PRD Markdown을 작성한다. 문제, 목표, 사용자, 시나리오, 범위, 기능, 지표, 릴리즈 계획을 포함한다." },
        { role: "user", content: JSON.stringify(req.body || {}).slice(0, 80_000) },
      ],
    });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 502, { error: error.message || "OPENAI_ERROR" });
  }
}
