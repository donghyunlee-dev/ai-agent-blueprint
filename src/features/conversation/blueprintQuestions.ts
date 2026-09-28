import { ChoiceOption, SurveyFormData } from "../survey/types";
import {
  aiAgentOptions, authOptions, authTypeOptions, automationOptions, dbExistOptions, dbOptions, dbTypeOptions,
  deployOptions, devExistOptions, envOptions, featureOptions, gitOptions, notifChannelOptions, notifOptions,
  osOptions, securityOptions, testOptions, timelineOptions, toolOptions, userOptions,
} from "../survey/constants";

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface BlueprintQuestion {
  id: string; field: keyof SurveyFormData; title: string; help: string; options?: ChoiceOption[];
  multiline?: boolean; multiple?: boolean; when?: (data: SurveyFormData) => boolean;
}
export interface BlueprintStage { id: StageId; title: string; description: string; questions: BlueprintQuestion[]; }

export const BLUEPRINT_STAGES: BlueprintStage[] = [
  { id: 1, title: "서비스 소개", description: "무엇을 만들고 어떤 문제를 해결할지 정의합니다.", questions: [
    { id: "serviceName", field: "serviceName", title: "서비스 이름은 무엇인가요?", help: "임시 프로젝트명도 괜찮습니다." },
    { id: "serviceDesc", field: "serviceDesc", title: "어떤 문제를 해결하는 서비스인가요?", help: "사용자와 기대 결과를 함께 설명해 주세요.", multiline: true },
    { id: "features", field: "features", title: "가장 중요한 기능은 무엇인가요?", help: "기존 선택지 또는 직접 작성한 기능을 복수로 알려주세요.", options: featureOptions, multiple: true },
  ]},
  { id: 2, title: "사용 환경", description: "사용 위치, 규모와 개발 환경을 결정합니다.", questions: [
    { id: "env", field: "env", title: "서비스는 어디에서 사용하나요?", help: "웹, PC 또는 둘 다 중 선택하세요.", options: envOptions },
    { id: "users", field: "users", title: "몇 명이 사용하나요?", help: "초기 운영 규모를 기준으로 답해 주세요.", options: userOptions },
    { id: "os", field: "os", title: "주 개발 운영체제는 무엇인가요?", help: "개발자가 주로 사용하는 환경입니다.", options: osOptions },
  ]},
  { id: 3, title: "데이터 · 로그인", description: "저장소와 사용자 접근 방식을 설계합니다.", questions: [
    { id: "db", field: "db", title: "데이터 저장이 필요한가요?", help: "이력 조회나 비교 분석이 필요하면 저장을 권장합니다.", options: dbOptions },
    { id: "dbExist", field: "dbExist", title: "기존 데이터베이스가 있나요?", help: "연결할 DB가 있는지 알려주세요.", options: dbExistOptions, when: (d) => d.db === "yes" },
    { id: "dbType", field: "dbType", title: "어떤 데이터베이스를 사용할까요?", help: "잘 모르겠다면 추천을 요청하세요.", options: dbTypeOptions, when: (d) => d.db === "yes" },
    { id: "auth", field: "auth", title: "로그인이 필요한가요?", help: "사용자별 데이터나 권한이 있으면 필요합니다.", options: authOptions },
    { id: "authTypes", field: "authTypes", title: "어떤 로그인 방식을 사용할까요?", help: "복수 선택할 수 있습니다.", options: authTypeOptions, multiple: true, when: (d) => d.auth === "yes" },
  ]},
  { id: 4, title: "알림 · 자동화", description: "반복 작업과 알림 범위를 정합니다.", questions: [
    { id: "notif", field: "notif", title: "알림이 필요한가요?", help: "상태 변경이나 오류 알림 여부를 결정합니다.", options: notifOptions },
    { id: "notifChannels", field: "notifChannels", title: "어떤 채널로 알릴까요?", help: "복수 채널을 선택할 수 있습니다.", options: notifChannelOptions, multiple: true, when: (d) => d.notif === "yes" },
    { id: "automation", field: "automation", title: "어떤 업무를 자동화할까요?", help: "없음도 명시적으로 선택할 수 있습니다.", options: automationOptions, multiple: true },
  ]},
  { id: 5, title: "AI · 업무 도구", description: "AI Agent와 협업 도구 구성을 결정합니다.", questions: [
    { id: "aiAgent", field: "aiAgent", title: "어떤 AI Agent를 사용할까요?", help: "현재 팀 환경에 맞는 도구를 선택하세요.", options: aiAgentOptions },
    { id: "tools", field: "tools", title: "연결할 협업 도구는 무엇인가요?", help: "복수 선택할 수 있습니다.", options: toolOptions, multiple: true },
    { id: "git", field: "git", title: "Git 버전 관리를 사용하나요?", help: "현재 사용 여부를 알려주세요.", options: gitOptions },
  ]},
  { id: 6, title: "배포 · 보안", description: "운영 환경, 보안, 테스트와 일정을 확정합니다.", questions: [
    { id: "deploy", field: "deploy", title: "어디에 배포할까요?", help: "운영 위치를 선택하세요.", options: deployOptions },
    { id: "security", field: "security", title: "어떤 보안 요구가 있나요?", help: "복수 선택할 수 있습니다.", options: securityOptions, multiple: true },
    { id: "test", field: "test", title: "테스트 환경을 분리할까요?", help: "운영 전 검증 환경 여부입니다.", options: testOptions },
    { id: "timeline", field: "timeline", title: "예상 일정은 어느 정도인가요?", help: "목표 일정을 선택하세요.", options: timelineOptions },
    { id: "devExist", field: "devExist", title: "개발은 어떤 방식으로 진행하나요?", help: "개발자와 AI의 역할을 정합니다.", options: devExistOptions },
    { id: "extraNote", field: "extraNote", title: "추가 제약이나 요청이 있나요?", help: "없으면 ‘없음’이라고 입력하세요.", multiline: true },
  ]},
  { id: 7, title: "최종 검토", description: "확정된 전체 설계를 검토하고 문서 생성을 승인합니다.", questions: [] },
];

export function activeQuestions(stage: BlueprintStage, data: SurveyFormData) {
  return stage.questions.filter((question) => !question.when || question.when(data));
}
