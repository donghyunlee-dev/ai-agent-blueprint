import { PrdGenerationInput, StructuredPrd } from "./types";

function splitLines(value: string, fallback: string[]) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : fallback;
}

export function buildFallbackPrd(input: PrdGenerationInput): StructuredPrd {
  const { context, formData, uploadedDocuments, guideDocuments } = input;
  const uploadedNames = uploadedDocuments
    .filter((document) => document.status === "ready")
    .map((document) => document.fileName);
  const guideNames = guideDocuments.map((document) => document.title);

  const functionalRequirements = splitLines(formData.functionalRequirements, [
    "추천 리포트의 작업 순서를 기준으로 핵심 화면과 주요 연동 기능을 우선 구현합니다.",
    "사용자가 입력한 환경과 운영 제약을 기준으로 MVP 범위를 먼저 고정합니다.",
  ]);

  const userScenarios = splitLines(formData.userScenarios, [
    "사용자는 설문을 입력하고 추천 리포트를 확인한 뒤 추가 문서를 작성합니다.",
    "운영 담당자는 생성된 결과를 기준으로 개발 환경과 연동 범위를 검토합니다.",
  ]);

  const markdown = [
    `# ${formData.documentTitle || `${context.formData.serviceName} PRD`}`,
    "",
    "# 문서 개요",
    `${formData.projectOverview || context.recommendation.summary} 이 문서는 설문 기반 추천 결과와 환경설정 가이드, 사용자가 추가로 작성한 요구사항을 바탕으로 작성한 한국어 PRD입니다. 구현 착수 전에 범위와 우선순위를 맞추기 위한 기준 문서로 사용합니다.`,
    "",
    "# 문제 정의",
    `${formData.problemStatement || context.formData.serviceDesc || "현재 서비스가 해결해야 하는 문제 정의가 추가 확인이 필요한 상태입니다."} 추천 결과에서 제안한 개발 환경과 운영 방식이 실제 요구사항과 맞는지 함께 검토해야 합니다.`,
    "",
    "# 목표",
    `${formData.goals || "추천 결과를 바탕으로 실행 가능한 제품 요구사항을 정리하고 개발 착수 기준을 만든다."} 성공 여부는 기능 구현 가능성, 운영 적합성, 문서 기반 협업 가능성을 기준으로 판단합니다.`,
    "",
    "# 대상 사용자",
    `${formData.targetUsers || "서비스 운영자, 실무 담당자, 개발자"}를 주요 사용자로 가정합니다. 사용자 유형별 접근 권한과 사용 목적은 설문 결과와 인증 요구사항을 기준으로 구체화해야 합니다.`,
    "",
    "# 핵심 사용자 시나리오",
    ...userScenarios.map((line, index) => `${index + 1}. ${line}`),
    "",
    "# 범위",
    `이번 범위에는 추천 결과에서 제안한 핵심 환경과 ${context.formData.serviceName}의 우선 기능 구현이 포함됩니다. 제외 범위는 ${formData.outOfScope || "추가 확인 필요"}로 두고, MVP를 넘는 요구는 다음 단계로 분리합니다.`,
    "",
    "# 기능 요구사항",
    ...functionalRequirements.map((line) => `- ${line}`),
    "",
    "# 비기능 요구사항",
    `- 배포 및 운영 조건은 ${context.formData.deploy || "추가 확인 필요"} 환경을 기준으로 정리합니다.`,
    `- 보안 요구사항은 ${context.formData.security.join(", ") || "추가 확인 필요"}를 기준으로 검토합니다.`,
    `- 테스트 전략은 ${context.formData.test || "추가 확인 필요"} 수준으로 잡되, 실제 운영 전 검증 항목을 별도 문서화합니다.`,
    "",
    "# 데이터 및 연동 요구사항",
    `${formData.dataAndIntegrations || "데이터 저장 방식, 외부 시스템 연동, 인증 구조는 추천 리포트와 가이드를 기준으로 정리해야 합니다."} 현재 참조 중인 가이드는 ${guideNames.join(", ") || "없음"} 입니다.`,
    uploadedNames.length
      ? `업로드한 참고 문서는 ${uploadedNames.join(", ")} 이며, 여기서 추출한 내용을 요구사항 정리에 함께 반영합니다.`
      : "업로드 문서는 아직 없으므로 추가 자료가 있으면 다음 수정 단계에서 반영합니다.",
    "",
    "# 운영 및 배포 고려사항",
    `${formData.constraints || "운영 제약과 일정은 추가 확인이 필요합니다."} 환경설정 가이드에 포함된 설치 및 연동 전제조건을 운영 기준 문서와 함께 유지해야 합니다.`,
    "",
    "# 리스크 및 오픈 이슈",
    "- 업로드 문서 중 자동 추출이 되지 않은 파일은 별도 수동 검토가 필요합니다.",
    "- 추천 결과의 기술 구성이 실제 조직 정책과 충돌하지 않는지 확인해야 합니다.",
    "- 기능 우선순위와 제외 범위를 확정하지 않으면 PRD가 지나치게 넓어질 수 있습니다.",
    "",
    "# 다음 단계",
    "1. 핵심 기능 우선순위를 확정합니다.",
    "2. 데이터 및 인증 요구를 세부 설계 문서로 분리합니다.",
    "3. 환경설정 가이드와 PRD를 기준으로 개발 작업을 분해합니다.",
  ].join("\n");

  return {
    title: formData.documentTitle || `${context.formData.serviceName} PRD`,
    summary: "추천 결과와 입력 자료를 바탕으로 한국어 PRD 초안을 생성했습니다.",
    prdMarkdown: markdown,
  };
}
