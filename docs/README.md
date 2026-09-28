# SFOOD Agent Blueprint 문서

이 디렉터리는 Agent형 Blueprint의 제품 정의부터 구현 순서까지 관리한다. 제품 문서는 목표 상태를 설명하며, 현재 코드의 동작이나 마이그레이션 기록은 기준으로 삼지 않는다.

## 문서 구조

```text
docs/
├─ README.md
├─ product/
│  ├─ 01-product-definition.md
│  ├─ 02-prd.md
│  ├─ 03-requirements.md
│  ├─ 04-conversation-process.md
│  ├─ 05-data-spec.md
│  ├─ 06-architecture.md
│  ├─ 07-ui-design.md
│  ├─ 08-delivery-plan.md
│  ├─ 09-design-system-integration.md
│  ├─ 10-decision-log.md
│  ├─ 11-ax-login-authentication.md
│  ├─ 12-ai-orchestration-and-model-policy.md
│  ├─ 13-prompt-and-response-contracts.md
│  ├─ 14-ai-budget-evaluation-and-operations.md
│  └─ 15-ai-prompt-template-spec.md
├─ delivery/
│  ├─ README.md
│  ├─ development-pr-review-qa-workflow.md
│  ├─ 00-foundation-and-contracts.md
│  ├─ 01-project-lifecycle.md
│  ├─ 02-conversation-and-forms.md
│  ├─ 03-proposals-and-design.md
│  ├─ 04-documents.md
│  ├─ 05-sources-guides-export.md
│  ├─ 06-quality-and-release.md
│  ├─ ai-model-prompt-and-evaluation.md
│  └─ traceability.md
├─ ui/
│  ├─ README.md
│  ├─ 00-visual-foundation.md
│  ├─ 01-workspace-shell.md
│  ├─ 02-conversation-and-forms.md
│  ├─ 03-design-board-and-inspector.md
│  ├─ 04-document-workspace.md
│  ├─ 05-home-projects-and-files.md
│  ├─ 06-overlays-responsive-and-states.md
│  ├─ 07-visual-acceptance.md
│  ├─ component-contracts.md
│  ├─ screen-state-matrix.md
│  └─ screens/
│     ├─ README.md
│     ├─ 00-login-and-session.md
│     ├─ 01-home-and-start.md
│     ├─ 02-intake-and-discovery.md
│     ├─ 03-proposal-and-conflict.md
│     ├─ 04-design-and-readiness.md
│     ├─ 05-documents-and-guide.md
│     └─ 06-generation-ready-and-errors.md
├─ process/
│  ├─ README.md
│  ├─ 01-end-to-end-flow.md
│  ├─ 02-state-machine.md
│  ├─ 03-question-and-answer-decisions.md
│  ├─ 04-proposal-and-readiness.md
│  ├─ 05-document-generation.md
│  ├─ 06-failure-and-recovery.md
│  ├─ 07-process-test-spec.md
│  └─ traceability.md
├─ research/
│  └─ manyfast-benchmark-analysis.md
└─ guide/
```

## 읽는 순서

1. [제품 정의](product/01-product-definition.md)
2. [PRD](product/02-prd.md)
3. [요구사항 명세](product/03-requirements.md)
4. [대화·선택 프로세스](product/04-conversation-process.md)
5. [데이터 명세](product/05-data-spec.md)
6. [아키텍처](product/06-architecture.md)
7. [UI 디자인 명세](product/07-ui-design.md)
8. [AX Login 인증 설계](product/11-ax-login-authentication.md)
9. [AI 오케스트레이션과 모델 정책](product/12-ai-orchestration-and-model-policy.md)
10. [프롬프트·응답 계약](product/13-prompt-and-response-contracts.md)
11. [AI 호출 예산·평가·운영](product/14-ai-budget-evaluation-and-operations.md)
12. [AI Prompt Template 명세](product/15-ai-prompt-template-spec.md)
13. [디자인 시스템 통합 명세](product/09-design-system-integration.md)
14. [상세 화면 설계](ui/README.md)
15. [로그인부터 PRD까지 프로세스 설계](process/README.md)
16. [단계별 개발 계획](product/08-delivery-plan.md)
17. [개발 단위 작업 설계](delivery/README.md)
18. [개발 PR·리뷰·QA 반복 워크플로](delivery/development-pr-review-qa-workflow.md)
19. [AI 모델·프롬프트·평가 작업 설계](delivery/ai-model-prompt-and-evaluation.md)
20. [요구사항 추적표](delivery/traceability.md)
21. [결정 기록](product/10-decision-log.md)

## 문서별 책임

| 문서 | 답하는 질문 |
| --- | --- |
| 제품 정의 | 누구의 어떤 문제를 해결하는가? |
| PRD | 무엇을 만들고 어떤 결과를 달성하는가? |
| 요구사항 | 시스템이 반드시 어떻게 동작해야 하는가? |
| 대화 프로세스 | Agent가 무엇을 묻고 선택 폼을 어떻게 만드는가? |
| 데이터 명세 | 어떤 데이터를 어떤 상태와 관계로 보관하는가? |
| 아키텍처 | 기능을 어떤 경계와 실행 흐름으로 구현하는가? |
| AX Login 인증 | Claude가 어떤 MCP 계약으로 사내 로그인, 세션, API 보호와 사용자 격리를 구현하는가? |
| AI 오케스트레이션 | 어떤 작업에 어떤 모델·reasoning·token 정책을 적용하는가? |
| 프롬프트·응답 계약 | 상황별 prompt가 어떤 구조화 block과 문서 결과를 반환하는가? |
| AI 예산·평가·운영 | 프로젝트당 몇 번 호출하고 품질·비용·회귀를 어떻게 통제하는가? |
| AI Prompt Template | 각 task가 실제로 어떤 System·Developer 지침과 변수를 사용하는가? |
| UI 디자인 | 화면을 어떻게 구성하고 상호작용하게 하는가? |
| 디자인 시스템 통합 | 어떤 런타임과 MCP 절차로 사내 UI를 적용하는가? |
| 상세 화면 설계 | 부분 화면을 어디에 어떤 크기·간격·컴포넌트·토큰과 상태로 구현하고 어떻게 시각 검수하는가? |
| 프로세스 설계 | 사용자의 선택을 어떤 guard로 판단하고 어떤 상태·데이터·화면으로 전환하며 어떻게 프로세스 테스트하는가? |
| 단계별 개발 계획 | 어떤 순서와 단계 산출물로 구현하는가? |
| 개발 단위 작업 설계 | 각 작업의 입력·화면·상태·출력·실패 처리와 성공 판정은 무엇인가? |
| PR·리뷰·QA 워크플로 | 작업을 어떤 PR로 나누고 누가 리뷰·QA·머지하며 언제 다음 작업을 시작하는가? |
| 요구사항 추적표 | 요구사항을 어떤 작업과 증거로 완료하는가? |
| 결정 기록 | 사용자가 확정한 선택과 반영 범위는 무엇인가? |

## 문서 관리 원칙

- 기능 요구사항에는 고유 ID를 부여한다.
- PRD는 제품 목표와 범위를 관리하고, 구현 세부사항은 하위 명세로 연결한다.
- 데이터 명세와 API 계약은 같은 상태 이름과 ID를 사용한다.
- 새로운 범위는 PRD에 먼저 반영한 뒤 요구사항과 개발 계획에 연결한다.
- `product/08-delivery-plan.md`는 단계와 순서를, `delivery/`는 실제 구현·검토 계약을 관리한다.
- 개발 작업은 요구사항 ID, 작업 ID, 검증 방법과 제출 증거가 연결되어야 완료된다.
- 구현 PR은 독립 코드 리뷰와 QA를 통과하고 사용자가 직접 머지해야 완료되며, 그 전에는 다음 PR 구현을 시작하지 않는다.
- 미정 사항은 추측으로 확정하지 않고 각 문서의 오픈 이슈에 기록한다.
- `guide/`는 Blueprint가 사용자에게 제공하는 실행 가이드 원본으로 유지한다.
- `research/`는 제품 결정의 근거이며 구현 계약은 아니다.
