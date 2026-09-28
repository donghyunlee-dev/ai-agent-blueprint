import { requestStructuredOutput, sendJson } from "../_lib/blueprint-openai.js";

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string" }, summary: { type: "string" }, reportMarkdown: { type: "string" },
    guideDocs: { type: "array", items: { type: "string" } },
  },
  required: ["title", "summary", "reportMarkdown", "guideDocs"],
};

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  try {
    const result = await requestStructuredOutput({
      name: "blueprint_requirements",
      schema,
      messages: [
        { role: "system", content: "확정된 서비스 설계를 기반으로 한국어 요구사항명세서를 Markdown으로 작성한다. 기능/비기능 요구사항, 기술 구성, 데이터, 보안, 배포, 수용 기준을 포함한다." },
        { role: "user", content: JSON.stringify(req.body?.formData || {}) },
      ],
    });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 502, { error: error.message || "OPENAI_ERROR" });
  }
}
