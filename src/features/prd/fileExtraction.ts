import { UploadedReferenceDocument } from "./types";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "yaml",
  "yml",
  "xml",
  "html",
  "htm",
  "log",
  "tsv",
]);

const UNSUPPORTED_OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "pdf"]);

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) || "" : "";
}

function printableRatio(value: string) {
  if (!value.length) return 0;

  const printable = [...value].filter((char) => {
    const code = char.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 32 && code < 65535);
  }).length;

  return printable / value.length;
}

export async function extractReferenceDocument(file: File): Promise<UploadedReferenceDocument> {
  const extension = getExtension(file.name);

  if (UNSUPPORTED_OFFICE_EXTENSIONS.has(extension)) {
    return {
      fileName: file.name,
      fileType: file.type || extension || "unknown",
      status: "unsupported",
      extractedText: "",
      message: "이 파일 형식은 현재 자동 텍스트 추출을 지원하지 않습니다. 핵심 내용을 입력란에 요약해 주세요.",
    };
  }

  try {
    const isTextLike = file.type.startsWith("text/") || TEXT_EXTENSIONS.has(extension);
    const content = await file.text();

    if (!isTextLike && printableRatio(content) < 0.85) {
      return {
        fileName: file.name,
        fileType: file.type || extension || "unknown",
        status: "unsupported",
        extractedText: "",
        message: "문서 내용을 안정적으로 읽지 못했습니다. 다른 형식으로 업로드하거나 핵심 내용을 직접 입력해 주세요.",
      };
    }

    const normalizedText = content.replace(/\u0000/g, "").trim();

    if (!normalizedText) {
      return {
        fileName: file.name,
        fileType: file.type || extension || "unknown",
        status: "error",
        extractedText: "",
        message: "문서에서 읽을 수 있는 텍스트를 찾지 못했습니다.",
      };
    }

    return {
      fileName: file.name,
      fileType: file.type || extension || "unknown",
      status: "ready",
      extractedText: normalizedText.slice(0, 20000),
      message: "문서 내용을 읽어 PRD 생성 자료에 포함합니다.",
    };
  } catch {
    return {
      fileName: file.name,
      fileType: file.type || extension || "unknown",
      status: "error",
      extractedText: "",
      message: "파일을 읽는 중 오류가 발생했습니다.",
    };
  }
}
