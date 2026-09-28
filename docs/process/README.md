# Blueprint 프로세스 설계

## 목적

사내 로그인부터 프로젝트 시작, Requirements 작성과 PRD 생성까지의 판단, 상태 전이, 저장 결과와 화면 변화를 정의한다. 이 문서는 단순 UI 기능 테스트가 아니라 여러 기능이 연결된 업무 프로세스 테스트의 기준이다.

## 문서 구조

1. [전체 프로세스](01-end-to-end-flow.md)
2. [프로세스 상태 머신](02-state-machine.md)
3. [질문과 답변 판단](03-question-and-answer-decisions.md)
4. [제안 처리와 준비도](04-proposal-and-readiness.md)
5. [Requirements와 PRD 생성](05-document-generation.md)
6. [실패·중단·복구](06-failure-and-recovery.md)
7. [프로세스 테스트 명세](07-process-test-spec.md)
8. [프로세스 추적표](traceability.md)

## 식별자

| 접두사 | 의미 | 예시 |
| --- | --- | --- |
| `PS-*` | 프로세스 상태 | `PS-DISCOVERING` |
| `EV-*` | 사용자·시스템 사건 | `EV-ANSWER-SUBMITTED` |
| `G-*` | 전이 guard | `G-NO-PENDING-PROPOSALS` |
| `AC-*` | 원자적 command | `AC-APPLY-PROPOSAL` |
| `INV-*` | 항상 참이어야 하는 불변식 | `INV-NO-AUTO-CONFIRM` |
| `PATH-*` | 처음부터 끝까지 이어지는 경로 | `PATH-HAPPY-IDEA` |
| `PT-*` | 자동화할 프로세스 테스트 | `PT-PROPOSAL-EDIT` |

## 전이 판정 순서

모든 사건은 아래 순서로 처리한다.

```text
event 수신
→ 현재 상태에서 허용되는지 확인
→ guard 평가
→ command를 하나의 transaction으로 실행
→ 도메인 불변식 확인
→ 저장
→ 성공한 다음 상태와 UI Frame 반영
```

저장이 실패하면 다음 상태로 전환하지 않는다. 메모리의 작업 복사본과 사용자 입력을 유지한 채 오류 상태를 원래 화면 위에 표시한다.

## 핵심 불변식

| ID | 규칙 |
| --- | --- |
| `INV-001` | Agent 응답만으로 `confirmed` 설계 항목을 만들 수 없다. |
| `INV-002` | 현재 질문에서 만들어진 pending proposal이 있으면 다음 시스템 질문을 열 수 없다. |
| `INV-003` | 자유 대화 입력은 proposal 검토 중에도 허용한다. |
| `INV-004` | 핵심 누락 또는 미해결 conflict가 있으면 Requirements를 생성할 수 없다. |
| `INV-005` | 명시적 deferred 항목만 있는 경우 Requirements 생성을 막지 않는다. |
| `INV-006` | Requirements가 `ready`가 아니면 PRD를 생성하거나 갱신할 수 없다. |
| `INV-007` | retry는 동일 논리 요청을 중복 반영하지 않는다. |
| `INV-008` | 오류·취소는 마지막 확정 설계와 생성 문서를 변경하지 않는다. |
| `INV-009` | 문서 직접 편집은 영향 확인 이후에만 설계 revision을 변경한다. |
| `INV-010` | 상태와 UI Frame은 마지막 성공 transaction의 결과를 표현한다. |
| `INV-011` | 유효한 세션 전에는 보호 화면과 로컬 프로젝트를 읽거나 표시하지 않는다. |
| `INV-012` | 모든 Blueprint API는 서버가 세션을 검증하며 클라이언트 상태를 인증 근거로 신뢰하지 않는다. |
| `INV-013` | 인증 사용자 간 owner namespace가 섞이지 않는다. |
| `INV-014` | AI는 질문 ID·폼, readiness, process state와 confirmed 여부를 결정하지 않는다. |
| `INV-015` | 하나의 사용자 사건에서 반환된 여러 block은 하나의 logical AI task 결과다. |
| `INV-016` | Plan 검증 실패 후 Draft를 호출하지 않고 자동 document repair는 한 번만 수행한다. |
| `INV-017` | 프로젝트 AI hard budget 이후 provider 호출이 발생하지 않는다. |

## 문서 간 역할

- [대화 프로세스](../product/04-conversation-process.md): 질문과 대화의 제품 규칙
- [AI 오케스트레이션](../product/12-ai-orchestration-and-model-policy.md): task별 모델·reasoning·token 정책
- [프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md): 상황별 block과 문서 schema
- 이 디렉터리: 규칙을 실행 가능한 상태 전이와 테스트 경로로 변환
- [화면 상태 매트릭스](../ui/screen-state-matrix.md): 각 상태에서 보여야 하는 UI Frame
- [개발 단위 작업 설계](../delivery/README.md): 전이를 구현하는 개발 작업

## 완료 조건

- 모든 P0 프로세스 분기에 guard, command, 다음 상태가 있다.
- 모든 상태는 하나 이상의 UI Frame과 연결된다.
- 모든 금지 전이는 프로세스 테스트에 포함된다.
- 정상, 선택 변경, 명시적 미정, 충돌, 실패·재시도 경로가 독립 fixture로 반복 실행된다.

## Mermaid 검증

프로세스 문서의 모든 Mermaid 블록은 저장소에 고정된 `@mermaid-js/mermaid-cli@11.17.0`으로 실제 렌더링한다.

```bash
npm run docs:check:mermaid
```

검증 스크립트는 `docs/`의 Mermaid 블록을 임시 파일로 추출해 SVG로 렌더링하고 결과물을 삭제한다. 문법 또는 렌더링 오류가 하나라도 있으면 종료 코드 1을 반환한다.
