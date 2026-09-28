import {
  AUTH_LABELS,
  AUTO_LABELS,
  FEATURE_LABELS,
  LABELS,
  NOTIF_LABELS,
  SEC_LABELS,
  TOOL_LABELS,
} from "./constants";
import { searchGuideDocuments } from "../docs/docsRegistry";
import {
  GuideDocKey,
  StructuredRecommendation,
  SurveyFormData,
} from "./types";

const GUIDE_DOC_SET = new Set<GuideDocKey>();

function collectGuideKeywords(data: SurveyFormData) {
  const values = [
    data.aiAgent,
    data.deploy,
    data.git,
    data.auth,
    data.serviceName,
    data.serviceDesc,
    data.extraNote,
    ...data.features,
    ...data.authTypes,
    ...data.notifChannels,
    ...data.automation,
    ...data.tools,
    ...data.security,
  ];

  return values.filter(Boolean);
}

function collectGuideDocs(data: SurveyFormData) {
  GUIDE_DOC_SET.clear();
  GUIDE_DOC_SET.add("custom-setup-guide");

  if (data.aiAgent === "claude") GUIDE_DOC_SET.add("claude-mcp");
  if (data.aiAgent === "codex") GUIDE_DOC_SET.add("openai-prompt-guide");
  if (data.tools.includes("github") || data.git === "yes" || data.git === "plan") {
    GUIDE_DOC_SET.add("github-setup");
  }
  if (data.tools.includes("slack") || data.notifChannels.includes("slack")) {
    GUIDE_DOC_SET.add("slack-setup");
  }
  if (data.deploy) {
    GUIDE_DOC_SET.add("deploy-guide");
  }

  if (!GUIDE_DOC_SET.size) {
    for (const docKey of searchGuideDocuments(collectGuideKeywords(data), 2)) {
      GUIDE_DOC_SET.add(docKey);
    }
  }

  if (!GUIDE_DOC_SET.size) {
    GUIDE_DOC_SET.add("openai-prompt-guide");
  }

  return [...GUIDE_DOC_SET];
}

function buildAgentSetupSection(data: SurveyFormData, os: string) {
  const commonIntro = [
    "# AI Agent 설치 및 설정 방법",
    `${LABELS.aiAgent[data.aiAgent as keyof typeof LABELS.aiAgent] || data.aiAgent}를 실제 개발에 쓰려면 설치, 인증, 프로젝트 연결 순서를 먼저 고정해야 합니다. 이 섹션은 현재 선택한 Agent를 기준으로 바로 실행할 수 있는 최소 설정 절차를 정리한 것입니다.`,
    "로컬 개발 환경과 저장소 연결이 먼저 안정화되어야 Agent가 생성한 코드, 문서, 설정 파일을 추적할 수 있으므로 아래 순서대로 진행하는 것이 좋습니다.",
    "",
  ];

  if (data.aiAgent === "none") {
    return [
      "# AI Agent 설치 및 설정 방법",
      "현재는 AI Agent를 사용하지 않는 구성이므로 별도의 Agent 설치는 필요하지 않습니다. 대신 개발 환경, Git 저장소, 문서 관리 위치를 먼저 고정해 수동 작업 기준을 명확히 하는 편이 중요합니다.",
      "추후 AI Agent를 도입할 수 있도록 `.env.local`, `docs/guide`, 저장소 브랜치 전략, 배포 기준은 미리 정리해 두는 것이 좋습니다. 이렇게 해두면 나중에 Agent를 붙여도 구조를 크게 바꾸지 않고 확장할 수 있습니다.",
    ].join("\n");
  }

  if (data.aiAgent === "claude") {
    const installCommand =
      data.os === "windows"
        ? "npm install -g @anthropic-ai/claude-code"
        : "npm install -g @anthropic-ai/claude-code";

    return [
      ...commonIntro,
      "Claude를 선택한 경우에는 Claude Code CLI와 Anthropic API 키, MCP 설정 파일을 함께 준비해야 합니다. 단순 웹 사용만으로는 프로젝트 루트에서 반복 작업을 자동화하기 어렵기 때문에 CLI 환경을 먼저 맞추는 편이 좋습니다.",
      "",
      "```bash",
      installCommand,
      "```",
      "",
      "설치 후 API 키를 환경 변수로 등록합니다.",
      "",
      "```bash",
      data.os === "windows"
        ? "setx ANTHROPIC_API_KEY your-anthropic-api-key"
        : "export ANTHROPIC_API_KEY=your-anthropic-api-key",
      "```",
      "",
      "MCP를 함께 쓰려면 Claude 설정 파일에 서버 정보를 등록합니다.",
      "",
      "```json",
      "{",
      '  "mcpServers": {',
      '    "filesystem": {',
      '      "command": "npx",',
      '      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]',
      "    }",
      "  }",
      "}",
      "```",
      "",
      `${os} 기준으로 설정 파일 위치와 권한 정책을 먼저 확인해야 합니다. 이후 프로젝트 루트에서 Claude Code를 실행하고, 저장소와 문서 디렉터리를 읽을 수 있는지부터 점검합니다.`,
    ].join("\n");
  }

  if (data.aiAgent === "codex") {
    return [
      ...commonIntro,
      "OpenAI 계열 Agent를 선택한 경우에는 OpenAI API 키와 프로젝트 환경 변수 구성이 핵심입니다. 이 서비스도 동일하게 `.env.local` 기준으로 모델과 키를 읽도록 맞추는 것이 유지보수에 유리합니다.",
      "",
      "```bash",
      "cp .env.example .env.local",
      "```",
      "",
      "`.env.local`에 최소한 아래 값을 넣습니다.",
      "",
      "```bash",
      "OPENAI_API_KEY=your-server-side-openai-api-key",
      "VITE_OPENAI_MODEL=gpt-5-mini",
      "```",
      "",
      "OpenAI를 호출하는 구조는 system, developer, user 메시지를 함께 보내는 방식으로 통일하는 것이 좋습니다. 그래야 매 요청마다 같은 지침을 선적용할 수 있고, 추천 결과와 가이드 문서 품질도 안정적으로 맞출 수 있습니다.",
      "추가로 브라우저 직접 호출 구조를 운영에 사용할지, 서버 프록시를 둘지 먼저 결정해야 합니다. 운영 전환 가능성을 생각하면 API 키 보호를 위해 서버 측 호출 계층을 별도로 두는 편이 안전합니다.",
    ].join("\n");
  }

  if (data.aiAgent === "gemini") {
    return [
      ...commonIntro,
      "Gemini를 선택한 경우에는 Google 계정 또는 Gemini API 키 준비가 먼저입니다. 프로젝트에서 직접 호출할지, Google 생태계 서비스와 함께 붙일지에 따라 인증 방식이 달라지므로 초기 결정이 중요합니다.",
      "",
      "```bash",
      "cp .env.example .env.local",
      "```",
      "",
      "환경 변수 예시는 다음과 같이 잡을 수 있습니다.",
      "",
      "```bash",
      "VITE_GEMINI_API_KEY=your-gemini-api-key",
      "VITE_GEMINI_MODEL=gemini-2.5-pro",
      "```",
      "",
      "Google Workspace, Drive, Sheets 같은 자원과 이어질 가능성이 있다면 프로젝트 초기에 권한 범위와 계정 관리 기준을 정해야 합니다. 이후 프롬프트 설계와 응답 정규화 계층을 별도로 두면 OpenAI 계열과 병행 운영할 때도 구조가 덜 흔들립니다.",
    ].join("\n");
  }

  if (data.aiAgent === "cursor") {
    return [
      ...commonIntro,
      "Cursor 또는 Copilot 계열은 에디터 안에서 바로 쓰는 형태이므로 IDE 설치와 로그인, 프로젝트 신뢰 설정이 먼저입니다. CLI 중심 Agent보다 진입은 빠르지만, 저장소 규칙과 작업 지시 템플릿을 별도로 정리해야 품질 편차를 줄일 수 있습니다.",
      "",
      "1. Cursor 또는 Visual Studio Code를 설치합니다.",
      "2. GitHub 또는 사용하는 AI 계정으로 로그인합니다.",
      "3. 프로젝트 폴더를 열고 워크스페이스를 신뢰하도록 설정합니다.",
      "4. 코드 생성 전에 `.env.local.example`, `docs/guide`, `src/features` 구조를 먼저 읽히도록 작업 규칙을 정합니다.",
      "",
      "에디터 내 Agent는 프로젝트 문맥을 넓게 읽기 때문에, 어떤 폴더를 기준 문서로 삼을지 정하는 것이 중요합니다. 이 프로젝트에서는 `docs/guide`와 결과 리포트 구조를 먼저 학습 대상으로 두는 편이 가장 실용적입니다.",
    ].join("\n");
  }

  return [
    ...commonIntro,
    "선택한 AI Agent에 대한 세부 문서가 아직 충분하지 않으므로, API 키 또는 로그인 방식, 프로젝트 연결 방식, 기준 문서 위치를 먼저 정해야 합니다. 최소한 실행 명령, 환경 변수, 저장소 연결 규칙을 문서화한 뒤 실제 개발에 들어가야 결과 품질이 안정됩니다.",
  ].join("\n");
}

export function buildRecommendationMarkdown(
  recommendation: StructuredRecommendation,
) {
  const appendix = recommendation.guideDocs.length
    ? [
        "",
        "# 연결 가능한 가이드 문서",
        ...recommendation.guideDocs.map((item) => `- ${item}`),
      ]
    : [];

  return [recommendation.reportMarkdown, ...appendix].join("\n");
}

export function buildFallbackRecommendation(
  data: SurveyFormData,
): StructuredRecommendation {
  const guideDocs = collectGuideDocs(data);
  const runtime = LABELS.env[data.env as keyof typeof LABELS.env] || data.env;
  const teamSize = LABELS.users[data.users as keyof typeof LABELS.users] || data.users;
  const os = LABELS.os[data.os as keyof typeof LABELS.os] || data.os;
  const db = LABELS.db[data.db as keyof typeof LABELS.db] || data.db;
  const dbType = data.dbType
    ? LABELS.dbType[data.dbType as keyof typeof LABELS.dbType] || data.dbType
    : "미정";
  const auth = LABELS.auth[data.auth as keyof typeof LABELS.auth] || data.auth;
  const aiAgent = LABELS.aiAgent[data.aiAgent as keyof typeof LABELS.aiAgent] || data.aiAgent;
  const deploy = LABELS.deploy[data.deploy as keyof typeof LABELS.deploy] || data.deploy;
  const git = LABELS.git[data.git as keyof typeof LABELS.git] || data.git;
  const test = LABELS.test[data.test as keyof typeof LABELS.test] || data.test;
  const timeline = LABELS.timeline[data.timeline as keyof typeof LABELS.timeline] || data.timeline;
  const devMode = LABELS.devExist[data.devExist as keyof typeof LABELS.devExist] || data.devExist;
  const features = data.features.length ? data.features.map((item) => FEATURE_LABELS[item] || item) : ["기본 기능 정리 필요"];
  const authTypes = data.authTypes.length ? data.authTypes.map((item) => AUTH_LABELS[item] || item) : ["추가 인증 방식 없음"];
  const notifChannels = data.notifChannels.length ? data.notifChannels.map((item) => NOTIF_LABELS[item] || item) : ["알림 채널 없음"];
  const automation = data.automation.length ? data.automation.map((item) => AUTO_LABELS[item] || item) : ["자동화 범위 없음"];
  const tools = data.tools.length ? data.tools.map((item) => TOOL_LABELS[item] || item) : ["협업 도구 미선정"];
  const security = data.security.length ? data.security.map((item) => SEC_LABELS[item] || item) : ["보안 요구사항 없음"];
  const primaryFrontend = "React 19 + TypeScript + Vite";
  const primaryData = data.db === "yes" ? dbType : "브라우저 상태 또는 파일 기반 처리";
  const primaryCollab = tools.includes(TOOL_LABELS.none)
    ? "별도 협업 도구 없이 진행"
    : tools.join(", ");
  const agentSetupSection = buildAgentSetupSection(data, os);
  const runtimeSetup = [
    `${os} 환경에서 Node.js LTS와 패키지 매니저를 먼저 맞춥니다.`,
    data.aiAgent !== "none" ? "선택한 AI Agent를 설치하고 실행 가능한 상태로 맞춥니다." : "AI Agent를 쓰지 않는다면 에디터와 문서 관리 위치만 먼저 고정합니다.",
    data.git === "yes" || data.git === "plan"
      ? "저장소와 브랜치 전략을 함께 정리합니다."
      : "버전 관리를 사용하지 않는다면 작업 폴더 구조와 백업 기준을 먼저 정합니다.",
  ].join(" ");

  const installCommand =
    data.os === "windows"
      ? `winget install OpenJS.NodeJS.LTS\nnpm install`
      : data.os === "mac"
        ? `brew install node\nnpm install`
        : `sudo apt-get install -y nodejs npm\nnpm install`;

  const reportMarkdown = [
    `# ${data.serviceName || "프로젝트"} 개발 환경 가이드`,
    "",
    `> ${runtime} 환경과 ${teamSize} 운영 규모를 기준으로, ${aiAgent} 중심의 개발 및 연동 환경을 바로 시작할 수 있도록 정리한 실행 문서입니다.`,
    "",
    "# 개요",
    `${data.serviceDesc || "서비스 설명이 아직 비어 있으므로 설문 응답을 기준으로 개발 환경을 구성합니다."} 이 프로젝트는 ${features.join(", ")} 기능을 중심으로 설계하는 것이 적합하며, 결과적으로 사용자가 직접 개발을 시작할 수 있는 환경과 작업 순서를 먼저 확보하는 것이 중요합니다.`,
    `현재 입력값을 보면 실행 환경은 ${runtime}, 개발 OS는 ${os}, 배포 목표는 ${deploy}이며, 협업 방식은 ${devMode}로 보는 것이 적절합니다.`,
    "",
    "# 추천 개발 환경 구성",
    `핵심 프론트엔드 구성은 **${primaryFrontend}** 를 권장합니다. 설문 기반 UI, 결과 리포트 렌더링, Markdown 문서 표시까지 한 코드베이스에서 다루기 쉽고, 빠른 프로토타이핑과 운영 전환에 유리합니다.`,
    `데이터 계층은 **${primaryData}** 를 기준으로 잡는 것이 좋습니다. 저장이 필요한 경우에는 스키마와 인증 흐름을 먼저 정리해야 하고, 저장이 필요 없더라도 이후 이력 관리가 필요해질 가능성을 염두에 둬야 합니다.`,
    `협업 및 운영 도구는 **${primaryCollab}** 를 기본 축으로 삼는 것이 좋습니다. 여기에 버전 관리는 ${git}, 테스트 전략은 ${test} 수준으로 맞추면 현재 프로젝트 성숙도에 비해 과하지 않은 구성이 됩니다.`,
    "",
    "# 왜 이 구성을 선택하는가",
    data.aiAgent === "none"
      ? "AI Agent를 사용하지 않는 구성이라면, 개발 환경과 문서 체계를 먼저 안정화해 수동 작업의 기준을 명확히 하는 편이 중요합니다. 따라서 협업 도구, 문서 구조, 배포 기준을 먼저 정리하는 구성이 더 실용적입니다."
      : `${aiAgent}를 선택한 이상, 코드 생성과 문서 초안 작성, 설치 가이드 정리, 반복 작업 자동화까지 이어지는 워크플로우가 중요합니다. 따라서 단순 IDE 추천보다 실제로 연결 가능한 도구와 문서를 먼저 확보하는 구성이 더 실용적입니다.`,
    `${runtime}와 ${teamSize} 조건에서는 복잡한 멀티 서비스 아키텍처보다, 프론트엔드 중심 구조와 필요한 외부 연동을 단계적으로 붙이는 편이 실패 확률이 낮습니다. 특히 ${security.join(", ")} 조건이 있으면 초기부터 보안과 배포 방식을 묶어서 결정해야 합니다.`,
    "",
    "# 작업 순서",
    "1. 서비스 범위를 먼저 고정합니다.",
    `   지금 기준 핵심 기능은 ${features.join(", ")} 이므로, 1차 버전에서 반드시 필요한 기능과 나중에 붙일 기능을 나눕니다.`,
    "2. 개발 환경을 준비합니다.",
    `   ${runtimeSetup}`,
    "3. 저장소와 협업 흐름을 정합니다.",
    data.git === "yes" || data.git === "plan"
      ? `   ${git} 상태를 기준으로 브랜치 전략, PR 방식, 문서 관리 위치를 확정합니다.`
      : "   버전 관리를 사용하지 않는다면 파일 백업 위치, 변경 이력 기록 방식, 산출물 보관 규칙을 먼저 정합니다.",
    "4. 데이터와 인증 구조를 확정합니다.",
    `   데이터 저장은 ${db}, 인증 요구는 ${auth}, 로그인 방식은 ${authTypes.join(", ")} 이므로 이 부분을 먼저 정해야 이후 API와 화면 구성이 안정됩니다.`,
    "5. 자동화와 알림 연결 대상을 정합니다.",
    `   자동화 범위는 ${automation.join(", ")}, 알림 채널은 ${notifChannels.join(", ")} 으로 잡고, 어떤 이벤트를 자동화하거나 수동 운영할지 문서화합니다.`,
    "6. 배포와 운영 기준을 정합니다.",
    `   배포는 ${deploy}, 일정은 ${timeline} 이므로 MVP 우선인지, 운영 안정성 우선인지에 따라 배포 파이프라인과 테스트 깊이를 맞춥니다.`,
    "",
    "# 설치 및 설정 방법",
    "아래 순서대로 개발 환경을 준비하면 됩니다.",
    "",
    "```bash",
    installCommand,
    "```",
    "",
    "프로젝트를 실행하기 전에 환경 변수를 먼저 준비합니다.",
    "",
    "```bash",
    "cp .env.example .env.local",
    "```",
    "",
    "`.env.local`에는 최소한 다음 값을 설정합니다.",
    "",
    "```bash",
    "OPENAI_API_KEY=your-server-side-openai-api-key",
    "VITE_OPENAI_MODEL=gpt-5-mini",
    "```",
    "",
    "개발 서버는 아래 명령으로 실행합니다.",
    "",
    "```bash",
    "npm run dev",
    "```",
    "",
    agentSetupSection,
    "",
    "# 연동 방법",
    data.aiAgent === "none"
      ? `AI Agent를 사용하지 않더라도 코드 저장소와 협업 도구, 운영 문서는 이어져야 합니다. 현재 선택된 협업 도구는 ${tools.join(", ")} 이므로, 우선순위는 저장소 연결, 알림 연결, 문서 연결 순서로 잡는 것이 좋습니다.`
      : `${aiAgent}를 실제 개발 흐름에 넣으려면 코드 저장소와 협업 도구가 이어져야 합니다. 현재 선택된 협업 도구는 ${tools.join(", ")} 이므로, 우선순위는 저장소 연결, 알림 연결, 문서 연결 순서로 잡는 것이 좋습니다.`,
    data.tools.includes("github") || data.git !== "no"
      ? "GitHub를 사용하는 경우에는 레포지토리 생성, 브랜치 전략, PR 규칙, 배포 연결까지 한 번에 설계해야 합니다. 결과에 포함된 GitHub 가이드를 함께 보면 연결 속도가 빨라집니다."
      : "버전 관리를 사용하지 않는다면 결과 문서, 설정 파일, 산출물 보관 위치를 먼저 고정하고 주기적으로 백업하는 운영 기준을 마련하는 편이 좋습니다.",
    data.notifChannels.includes("slack")
      ? "Slack 알림이 필요한 경우에는 Webhook 또는 Slack App 권한 범위를 먼저 정하고, 어떤 이벤트를 어떤 채널로 보낼지 명확히 해야 합니다."
      : "알림이 당장 필수는 아니더라도, 배포 완료나 오류 감지 같은 운영 이벤트를 나중에 연결할 수 있도록 인터페이스를 열어두는 편이 좋습니다.",
    "",
    "# 운영 전 점검 사항",
    `- 서비스 설명과 실제 구현 범위가 일치하는지 확인합니다.`,
    `- 핵심 기능 ${features.join(", ")} 이 MVP 범위를 넘어서지 않는지 점검합니다.`,
    `- 데이터 저장 정책이 ${db} 인데도 추후 이력 요구가 생기지 않는지 다시 확인합니다.`,
    `- 인증 방식 ${authTypes.join(", ")} 이 실제 사용자 운영 흐름과 맞는지 검토합니다.`,
    `- 배포 방식 ${deploy} 에서 보안 요구 ${security.join(", ")} 를 만족하는지 점검합니다.`,
    "",
    "# 주의사항",
    data.security.includes("personal") || data.security.includes("financial")
      ? "- 민감한 데이터가 포함되므로 브라우저에서 직접 외부 API를 호출하는 구조는 운영 환경에서 재검토해야 합니다."
      : "- 현재 구조는 빠른 설계와 문서화에 유리하지만, 운영 배포 시에는 API 키 보호 구조를 점검해야 합니다.",
    "- OpenAI API는 stateless이므로 요청마다 필요한 지침과 컨텍스트를 함께 보내야 합니다.",
    "- 선택한 도구를 모두 한 번에 붙이기보다, 저장소와 실행 환경부터 먼저 안정화한 뒤 협업 도구와 자동화를 붙이는 편이 안전합니다.",
    "",
    "# 바로 시작하는 다음 액션",
    "1. 개발 환경 설치와 `.env.local` 구성을 먼저 끝냅니다.",
    data.git === "yes" || data.git === "plan"
      ? "2. Git 저장소와 기본 브랜치 전략을 정리합니다."
      : "2. 작업 폴더, 백업 위치, 문서 저장 규칙을 정리합니다.",
    "3. 데이터 저장 여부와 인증 방식을 확정합니다.",
    "4. 결과에 연결된 가이드 문서를 순서대로 읽으며 실제 도구 연동을 진행합니다.",
    data.extraNote
      ? `5. 추가 메모에 적은 요구사항인 "${data.extraNote}" 를 반영할 수 있도록 우선순위를 다시 정합니다.`
      : "5. MVP 범위를 문서로 고정하고 실제 구현에 들어갑니다.",
  ].join("\n");

  return {
    title: `${data.serviceName || "프로젝트"} 개발 환경 추천`,
    summary: `${
      data.env === "web" ? "웹 기반" : data.env === "pc" ? "설치형 앱" : "멀티 환경"
    } 환경에서 ${
      data.users === "solo" ? "소규모 개인 사용" : data.users === "small" ? "소규모 팀" : "조직형"
    } 운영에 맞춘 구성을 권장합니다.`,
    reportMarkdown,
    guideDocs,
  };
}
