import { PrdGenerationInput } from "./types";

interface PromptMessage {
  role: "system" | "developer" | "user";
  content: string;
}

const SYSTEM_PROMPT = `당신은 한국어 제품 요구 문서를 작성하는 실무형 프로덕트 매니저입니다.
응답은 반드시 한국어로 작성하고, 주어진 JSON Schema를 엄격히 따라야 합니다.
결과는 제품팀, 기획자, 개발자가 바로 읽고 실행에 옮길 수 있는 수준이어야 합니다.`;

const DEVELOPER_PROMPT = `다음 규칙을 반드시 따른다.

[출력 규칙]
- title, summary, prdMarkdown을 모두 채운다
- prdMarkdown은 실제 내부 문서처럼 길고 구체적으로 작성한다
- 이모티콘, 그림문자, 장식용 아이콘은 절대 사용하지 않는다
- 단순 요약이 아니라 목적, 범위, 기능 요구사항, 비기능 요구사항, 연동, 운영 고려사항까지 포함한다
- 사용자가 입력한 내용과 업로드 문서, 환경설정 가이드, 추천 리포트를 모두 반영한다
- 업로드 문서에서 직접 확인한 내용과 추론한 내용을 혼동하지 않는다
- 확실한 정보가 부족한 항목은 "추가 확인 필요"로 표시한다

[문서 규칙]
- PRD는 반드시 한국어로 작성한다
- 설치 가이드 문서를 다시 반복하지 말고, 제품 요구사항과 구현 범위 중심으로 정리한다
- 다만 환경설정 가이드에서 제품 범위나 운영 제약에 영향을 주는 내용은 반영한다
- 기능 요구사항은 가능한 한 실행 단위로 나눈다
- 바로 개발 착수할 수 있도록 우선순위와 다음 단계를 정리한다`;

function formatGuideDocuments(input: PrdGenerationInput) {
  if (!input.guideDocuments.length) return "없음";

  return input.guideDocuments
    .map(
      (document, index) =>
        `문서 ${index + 1}\n제목: ${document.title}\n경로: ${document.path}\n내용:\n${document.content.slice(0, 5000)}`,
    )
    .join("\n\n");
}

function formatUploadedDocuments(input: PrdGenerationInput) {
  const readyDocuments = input.uploadedDocuments.filter((document) => document.status === "ready");
  if (!readyDocuments.length) return "없음";

  return readyDocuments
    .map(
      (document, index) =>
        `업로드 문서 ${index + 1}\n파일명: ${document.fileName}\n유형: ${document.fileType}\n추출 내용:\n${document.extractedText}`,
    )
    .join("\n\n");
}

export function buildPrdPromptMessages(input: PrdGenerationInput): PromptMessage[] {
  const { context, formData } = input;

  const userPrompt = `아래 자료를 바탕으로 한국어 PRD 문서를 작성해 주세요.

[설문 기반 추천 결과]
- 서비스명: ${context.formData.serviceName}
- 추천 제목: ${context.recommendation.title}
- 추천 요약: ${context.recommendation.summary}
- 추천 리포트:
${context.recommendation.reportMarkdown}

[PRD 입력 폼]
- 문서 제목: ${formData.documentTitle || "미입력"}
- 프로젝트 개요: ${formData.projectOverview || "미입력"}
- 문제 정의: ${formData.problemStatement || "미입력"}
- 목표: ${formData.goals || "미입력"}
- 주요 사용자: ${formData.targetUsers || "미입력"}
- 사용자 시나리오: ${formData.userScenarios || "미입력"}
- 기능 요구사항: ${formData.functionalRequirements || "미입력"}
- 제외 범위: ${formData.outOfScope || "미입력"}
- 데이터 및 연동: ${formData.dataAndIntegrations || "미입력"}
- 운영 및 제약사항: ${formData.constraints || "미입력"}
- 성공 지표: ${formData.successMetrics || "미입력"}
- 릴리즈 계획: ${formData.releasePlan || "미입력"}
- 추가 메모: ${formData.additionalNotes || "미입력"}

[업로드 문서]
${formatUploadedDocuments(input)}

[참고 환경설정 가이드]
${formatGuideDocuments(input)}

[출력 형식]
- 출력은 반드시 JSON
- title: 문서 제목
- summary: 한 줄 요약
- prdMarkdown: 아래 필수 섹션을 포함한 Markdown 문서

[prdMarkdown 필수 섹션]
- # 문서 개요
- # 문제 정의
- # 목표
- # 대상 사용자
- # 핵심 사용자 시나리오
- # 범위
- # 기능 요구사항
- # 비기능 요구사항
- # 데이터 및 연동 요구사항
- # 운영 및 배포 고려사항
- # 리스크 및 오픈 이슈
- # 다음 단계`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "developer", content: DEVELOPER_PROMPT },
    { role: "user", content: userPrompt },
  ];
}
