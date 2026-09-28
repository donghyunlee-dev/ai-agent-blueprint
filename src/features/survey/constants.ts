import { ChoiceOption, SurveyFormData } from "./types";

export const TOTAL_STEPS = 7;

export const STEP_TITLES = [
  "시작",
  "서비스 소개",
  "사용 환경",
  "데이터·로그인",
  "알림·자동화",
  "AI·업무 도구",
  "배포·보안",
  "최종 확인",
] as const;

export const INITIAL_FORM_DATA: SurveyFormData = {
  serviceName: "",
  serviceDesc: "",
  features: [],
  env: "",
  users: "",
  os: "",
  db: "",
  dbExist: "",
  dbType: "",
  auth: "",
  authTypes: [],
  notif: "",
  notifChannels: [],
  automation: [],
  aiAgent: "",
  tools: [],
  git: "",
  deploy: "",
  security: [],
  test: "",
  timeline: "",
  devExist: "",
  extraNote: "",
};

export const featureOptions: ChoiceOption[] = [
  { value: "chart", icon: "📈", title: "차트/그래프", description: "데이터를 시각적으로 표현" },
  { value: "table", icon: "📋", title: "표/목록", description: "데이터를 표 형태로 관리" },
  { value: "upload", icon: "📤", title: "파일 업로드", description: "이미지·CSV 업로드 및 처리" },
  { value: "report", icon: "📄", title: "리포트/문서 출력", description: "결과를 PDF/문서로 다운로드" },
  { value: "alert", icon: "🔔", title: "알림 기능", description: "조건 발생 시 알림" },
  { value: "auto", icon: "⚙️", title: "자동화/스케줄", description: "정기 예약·자동 실행" },
];

export const envOptions: ChoiceOption[] = [
  { value: "web", icon: "🌐", title: "웹 브라우저", description: "링크 접속, 설치 불필요" },
  { value: "pc", icon: "💻", title: "내 PC", description: "로컬 앱/오프라인" },
  { value: "both", icon: "🤷", title: "둘 다/미정", description: "초기엔 간단, 이후 확장" },
];

export const userOptions: ChoiceOption[] = [
  { value: "solo", icon: "👤", title: "혼자", description: "1명" },
  { value: "small", icon: "👥", title: "소규모 팀", description: "2~10명" },
  { value: "org", icon: "🏢", title: "조직/다수", description: "10명 이상" },
];

export const osOptions: ChoiceOption[] = [
  { value: "windows", icon: "🪟", title: "Windows", description: "Windows 10/11" },
  { value: "mac", icon: "🍎", title: "macOS", description: "Mac" },
  { value: "linux", icon: "🐧", title: "Linux", description: "Ubuntu/CentOS 등" },
];

export const dbOptions: ChoiceOption[] = [
  { value: "yes", icon: "🗃️", title: "네, 데이터 필요", description: "저장·조회·분석" },
  { value: "no", icon: "🚫", title: "아니요, 임시 처리", description: "업로드 후 바로 표시" },
];

export const dbExistOptions: ChoiceOption[] = [
  { value: "yes", icon: "🔗", title: "네, 기존 DB 있음", description: "기존 DB 연결" },
  { value: "no", icon: "🆕", title: "아니요, 새로 구축", description: "추천 DB 설치" },
];

export const dbTypeOptions: ChoiceOption[] = [
  { value: "mysql", icon: "🐬", title: "MySQL/MariaDB", description: "보편적 RDB" },
  { value: "postgres", icon: "🐘", title: "PostgreSQL", description: "대용량/복잡 쿼리" },
  { value: "mongodb", icon: "🍃", title: "MongoDB", description: "문서형/유연 스키마" },
  { value: "sqlite", icon: "📦", title: "SQLite", description: "가벼운 파일 DB" },
  { value: "supabase", icon: "☁️", title: "Supabase", description: "클라우드 DB" },
  { value: "etc", icon: "❓", title: "모르겠음", description: "추천 받고 결정" },
];

export const authOptions: ChoiceOption[] = [
  { value: "yes", icon: "🔐", title: "네, 로그인 필요", description: "사용자별 관리" },
  { value: "no", icon: "🔓", title: "아니요, 공개/자유", description: "인증 없이 사용" },
];

export const authTypeOptions: ChoiceOption[] = [
  { value: "email", icon: "✉️", title: "이메일+비밀번호", description: "직접 계정 생성" },
  { value: "google", icon: "🟢", title: "Google", description: "구글 계정 로그인" },
  { value: "github", icon: "🐙", title: "GitHub", description: "깃허브 로그인" },
  { value: "sso", icon: "🏢", title: "사내 SSO", description: "기업 SSO 연동" },
];

export const notifOptions: ChoiceOption[] = [
  { value: "yes", icon: "🔔", title: "네, 알림 사용", description: "조건 발생 시 알림" },
  { value: "no", icon: "🔕", title: "아니요", description: "화면에서만 확인" },
];

export const notifChannelOptions: ChoiceOption[] = [
  { value: "slack", icon: "💬", title: "Slack", description: "슬랙 채널 알림" },
  { value: "teams", icon: "💼", title: "MS Teams", description: "Teams 메시지" },
  { value: "email", icon: "✉️", title: "이메일", description: "메일 알림" },
  { value: "kakao", icon: "💛", title: "카카오톡", description: "카톡 알림" },
  { value: "webhook", icon: "🪝", title: "웹훅", description: "외부 서비스 연결" },
  { value: "push", icon: "🔔", title: "브라우저 푸시", description: "화면 알림" },
];

export const automationOptions: ChoiceOption[] = [
  { value: "schedule", icon: "⏱️", title: "정기 실행", description: "매일/매주 자동 실행" },
  { value: "batch", icon: "📦", title: "대량 처리", description: "대용량 데이터 일괄" },
  { value: "report", icon: "📧", title: "리포트 발송", description: "결과 자동 발송" },
  { value: "monitor", icon: "🛟", title: "이상 감지", description: "문제 발생 시 알림" },
  { value: "none", icon: "⛔", title: "없음", description: "자동화 미사용" },
];

export const aiAgentOptions: ChoiceOption[] = [
  { value: "claude", icon: "🤖", title: "Claude (Anthropic)", description: "문서·코드 지원" },
  { value: "codex", icon: "🧠", title: "OpenAI (ChatGPT)", description: "범용 코딩/요약" },
  { value: "gemini", icon: "🔷", title: "Gemini (Google)", description: "Google 연동" },
  { value: "cursor", icon: "💡", title: "Cursor/Copilot", description: "에디터 보조" },
  { value: "none", icon: "❌", title: "미사용", description: "도입 예정" },
];

export const toolOptions: ChoiceOption[] = [
  { value: "github", icon: "🐙", title: "GitHub", description: "코드/이슈 관리" },
  { value: "jira", icon: "📌", title: "Jira", description: "프로젝트 이슈" },
  { value: "confluence", icon: "📚", title: "Confluence", description: "팀 문서 위키" },
  { value: "notion", icon: "🗂️", title: "Notion", description: "문서/DB 협업" },
  { value: "slack", icon: "💬", title: "Slack", description: "팀 메시지" },
  { value: "teams", icon: "💼", title: "MS Teams", description: "협업 커뮤니케이션" },
  { value: "none", icon: "❌", title: "미사용", description: "도입 예정" },
];

export const gitOptions: ChoiceOption[] = [
  { value: "yes", icon: "✅", title: "네, 사용 중", description: "GitHub/GitLab" },
  { value: "plan", icon: "🗓️", title: "도입 예정", description: "준비 중" },
  { value: "no", icon: "🚫", title: "아니요", description: "필요 시 도입" },
];

export const deployOptions: ChoiceOption[] = [
  { value: "cloud", icon: "☁️", title: "클라우드", description: "AWS/GCP/Azure" },
  { value: "onprem", icon: "🏢", title: "사내(온프레미스)", description: "내부 장비 설치" },
  { value: "local", icon: "💻", title: "로컬만", description: "내 PC에서만" },
];

export const securityOptions: ChoiceOption[] = [
  { value: "personal", icon: "🔒", title: "개인/민감 정보", description: "이름/연락처 등" },
  { value: "financial", icon: "💳", title: "금융/결제", description: "카드/정산" },
  { value: "internal", icon: "🏷️", title: "사내 내부", description: "대외비" },
  { value: "none", icon: "❌", title: "미사용", description: "보안 요구 없음" },
];

export const testOptions: ChoiceOption[] = [
  { value: "yes", icon: "🧪", title: "분리(스테이징)", description: "검증 환경 분리" },
  { value: "no", icon: "🚀", title: "바로 운영", description: "간단 배포" },
];

export const timelineOptions: ChoiceOption[] = [
  { value: "urgent", icon: "⏳", title: "급함 (2주 이내)", description: "빠른 일정" },
  { value: "normal", icon: "📆", title: "보통 (1~3개월)", description: "권장 일정" },
  { value: "long", icon: "🗓️", title: "여유 (3개월+)", description: "충분한 검토" },
];

export const devExistOptions: ChoiceOption[] = [
  { value: "yes", icon: "👨‍💻", title: "개발자 있음", description: "내부/외부" },
  { value: "nocode", icon: "✨", title: "AI/노코드 우선", description: "최소 코드" },
  { value: "both", icon: "🤝", title: "AI+개발자 병행", description: "함께 진행" },
];

export const LABELS = {
  env: { web: "웹", pc: "PC", both: "둘 다/미정" },
  users: { solo: "혼자", small: "소규모 팀 (2~10명)", org: "조직/다수 (10명+)" },
  os: { windows: "Windows", mac: "macOS", linux: "Linux" },
  db: { yes: "데이터 필요", no: "임시 처리" },
  dbType: { mysql: "MySQL/MariaDB", postgres: "PostgreSQL", mongodb: "MongoDB", sqlite: "SQLite", supabase: "Supabase", etc: "추천 받고 결정" },
  auth: { yes: "로그인 필요", no: "인증 없음" },
  notif: { yes: "알림 사용", no: "알림 없음" },
  aiAgent: { claude: "Claude", codex: "OpenAI", gemini: "Gemini", cursor: "Cursor/Copilot", none: "미사용" },
  git: { yes: "사용 중", plan: "도입 예정", no: "미사용" },
  deploy: { cloud: "클라우드", onprem: "사내", local: "로컬" },
  test: { yes: "분리", no: "바로 운영" },
  timeline: { urgent: "급함", normal: "보통", long: "여유" },
  devExist: { yes: "있음", nocode: "노코드", both: "병행" },
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  chart: "📈 차트/그래프",
  table: "📋 표/목록",
  upload: "📤 파일 업로드",
  report: "📄 리포트/문서",
  alert: "🔔 알림",
  auto: "⚙️ 자동화",
};

export const NOTIF_LABELS: Record<string, string> = {
  slack: "💬 Slack",
  teams: "💼 Teams",
  email: "✉️ 이메일",
  kakao: "💛 카카오톡",
  webhook: "🪝 웹훅",
  push: "🔔 푸시",
};

export const AUTH_LABELS: Record<string, string> = {
  email: "✉️ 이메일",
  google: "🟢 구글",
  github: "🐙 GitHub",
  sso: "🏢 SSO",
};

export const AUTO_LABELS: Record<string, string> = {
  schedule: "⏱️ 정기 실행",
  batch: "📦 대량 처리",
  report: "📧 리포트 발송",
  monitor: "🛟 이상 감지",
  none: "⛔ 없음",
};

export const SEC_LABELS: Record<string, string> = {
  personal: "🔒 개인정보",
  financial: "💳 금융정보",
  internal: "🏷️ 내부정보",
  none: "—",
};

export const TOOL_LABELS: Record<string, string> = {
  github: "🐙 GitHub",
  jira: "📌 Jira",
  confluence: "📚 Confluence",
  notion: "🗂️ Notion",
  slack: "💬 Slack",
  teams: "💼 Teams",
  none: "—",
};
