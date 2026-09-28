import { getGuideDocCatalog } from "../docs/docsRegistry";
import { SurveyFormData } from "./types";

export interface PromptMessage {
  role: "system" | "developer" | "user";
  content: string;
}

const SYSTEM_PROMPT = `당신은 실무형 AI 개발 환경 컨설턴트입니다.
응답은 반드시 한국어로 작성하고, 주어진 JSON Schema를 엄격히 따라야 합니다.
추천은 현실적인 도입 순서, 운영 제약, 협업 방식까지 반영해야 합니다.
결과는 단순 추천 목록이 아니라 사용자가 바로 따라 할 수 있는 실행 가이드 문서여야 합니다.`;

const DEVELOPER_PROMPT = `OpenAI API 프롬프트 지침서를 아래 규칙으로 적용한다.

[메시지 우선순위]
- system: 모델 역할과 절대 규칙
- developer: 서비스/프로젝트 규칙
- user: 실제 사용자 설문 데이터
- 메시지는 위에서 아래 순서로 해석된다고 가정하고 답변한다

[출력 규칙]
- 반드시 JSON Schema만 반환한다
- title, summary, reportMarkdown, guideDocs를 모두 채운다
- reportMarkdown은 실제 가이드 문서처럼 길고 구체적으로 작성한다
- 단순한 항목 나열을 피하고, 왜 이 구성을 선택하는지와 실제 설치 및 연결 순서를 포함한다
- 사용자가 개발을 시작할 수 있도록 실행 순서, 설치 명령, 환경 변수, 연동 방법, 주의사항을 포함한다
- 결과 문서, 제목, 소제목, 목록, 코드 설명에 이모티콘과 그림문자를 절대 사용하지 않는다
- 유니코드 이모지, 장식용 기호, 아이콘 문자까지 모두 금지한다
- 설명은 실무적이어야 하며 마케팅 문구를 피한다
- guideDocs에는 반드시 1개 이상의 문서를 포함한다
- guideDocs에는 docs/guide 문서 중 현재 추천과 직접 관련된 문서를 넣는다
- 현재 관련 문서가 없으면 custom-setup-guide를 포함한다
- 관련 문서가 명확하지 않으면 tool, mcp, skill, prompt 구조를 설명하는 가장 가까운 문서를 선택한다
- guideDocs에는 docs/guide 카탈로그에 있는 키 또는 custom-setup-guide만 넣는다

[추천 기준]
- 실행 환경, 사용자 규모, OS, 저장소, 인증, 알림, 자동화, 협업 도구, 배포, 보안을 함께 고려한다
- 팀 규모와 운영 수준에 비해 과도한 기술은 피한다
- 민감정보 또는 인증 요구가 있으면 보안 주의사항을 강화한다
- Git, 배포, 문서화, 테스트 준비가 필요한 경우 다음 단계에 반영한다
- 사용자가 선택한 정보를 반복 나열하지 말고, 그것을 바탕으로 실제 구성안과 작업 순서를 도출한다
- 가능한 경우 구체적인 도구 이름, 설치 명령, 설정 파일 위치, 연결 포인트를 적는다
- guide 문서와 이어서 읽을 수 있도록 결과 문서의 흐름을 설계한다
- AI Agent를 선택한 경우 해당 Agent의 설치 방법과 환경 설정 방법을 반드시 별도 섹션으로 작성한다
- Claude 선택 시 Claude Code 설치, API 키, MCP 설정을 포함한다
- Codex 또는 ChatGPT 선택 시 OpenAI API 키, 환경 변수, 호출 구조를 포함한다
- Cursor 또는 Copilot 계열 선택 시 에디터 설치, 로그인, 프로젝트 연결 방법을 포함한다
- Gemini 선택 시 Google 계정 또는 API 키 준비와 연결 방법을 포함한다
- AI Agent를 사용 안 함으로 선택한 경우에는 별도 설치를 강요하지 말고, 수동 개발 기준과 향후 도입 가능성을 중심으로 섹션을 작성한다
- Git을 사용 안 함으로 선택한 경우에는 GitHub, 브랜치 전략, PR 흐름을 필수 단계처럼 제안하지 않는다
- 협업 도구나 자동화를 사용 안 함으로 선택한 경우에는 해당 도구 연결을 강제하지 않는다

[제약]
- 이 API는 stateless라고 가정한다
- 따라서 이번 요청에 포함된 system/developer 지침을 항상 먼저 반영한 뒤 user 데이터를 해석한다`;

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "없음";
}

function normalizeValue(value: string) {
  return value || "미입력";
}

export function buildUserPrompt(data: SurveyFormData) {
  const guideCatalog = getGuideDocCatalog()
    .map(
      (document) =>
        `- ${document.key}: ${document.title} [${document.tags.join(", ")}] @ ${document.path}`,
    )
    .join("\n");

  return `아래 설문 데이터를 바탕으로 실용적이고 구체적인 AI 개발 환경 추천안을 작성해주세요.

[설문 결과]
- 서비스명: ${normalizeValue(data.serviceName)}
- 설명: ${normalizeValue(data.serviceDesc)}
- 주요 기능: ${formatList(data.features)}
- 실행 환경: ${normalizeValue(data.env)}
- 사용 인원: ${normalizeValue(data.users)}
- 개발 OS: ${normalizeValue(data.os)}
- DB 필요: ${normalizeValue(data.db)} (종류: ${normalizeValue(data.dbType)})
- 로그인: ${normalizeValue(data.auth)} (방식: ${formatList(data.authTypes)})
- 알림: ${normalizeValue(data.notif)} (채널: ${formatList(data.notifChannels)})
- 자동화: ${formatList(data.automation)}
- AI Agent: ${normalizeValue(data.aiAgent)}
- 협업 도구: ${formatList(data.tools)}
- Git 사용: ${normalizeValue(data.git)}
- 배포: ${normalizeValue(data.deploy)}
- 보안: ${formatList(data.security)}
- 테스트 요구: ${normalizeValue(data.test)}
- 개발 일정: ${normalizeValue(data.timeline)}
- 개발 방식: ${normalizeValue(data.devExist)}
- 추가 메모: ${normalizeValue(data.extraNote)}

[출력 규칙]
- 출력은 반드시 아래 구조의 JSON 이어야 한다
- title: 결과 제목
- summary: 전체 한 줄 요약
- reportMarkdown: 실제 실행 가이드 문서 Markdown 문자열
- guideDocs: docs/guide 아래 가이드 문서 키 배열이며 반드시 1개 이상 포함

[reportMarkdown 필수 섹션]
- # 개요
- # 추천 개발 환경 구성
- # 왜 이 구성을 선택하는가
- # 작업 순서
- # 설치 및 설정 방법
- # AI Agent 설치 및 설정 방법
- # 연동 방법
- # 운영 전 점검 사항
- # 주의사항
- # 바로 시작하는 다음 액션

[reportMarkdown 작성 규칙]
- 섹션마다 2문장 이상 설명한다
- 필요한 경우 목록과 코드 블록을 사용한다
- 설치 명령이 있으면 fenced code block으로 제공한다
- 사용자의 환경에 맞는 순서를 제시한다
- 가이드 문서와 연결되는 항목을 자연스럽게 언급한다
- 문서 전체는 실제 내부 가이드 문서 품질을 목표로 한다
- AI Agent 설치 섹션에는 선택된 Agent 기준의 명령, 환경 변수, 로그인 또는 API 키 설정 방법이 반드시 포함되어야 한다

[guideDocs 기본 값]
- custom-setup-guide

[사용 가능한 docs/guide 문서]
${guideCatalog}`;
}

export function buildPromptMessages(data: SurveyFormData): PromptMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "developer", content: DEVELOPER_PROMPT },
    { role: "user", content: buildUserPrompt(data) },
  ];
}
