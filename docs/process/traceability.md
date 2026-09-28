# 프로세스 추적표

## 목적

각 프로세스 경로를 요구사항, UI Frame, 개발 작업과 자동화 테스트에 연결한다. 구현 중 상태나 분기를 추가하면 이 표를 먼저 갱신한다.

| PATH | 요구사항 | UI Frame | 주 개발 작업 | 프로세스 테스트 |
| --- | --- | --- | --- | --- |
| `PATH-AI-BLOCKS` | AI-001~005 | DISCOVERY, PROPOSAL | AI-001~005 | `PT-AI-001` |
| `PATH-DOC-PIPELINE` | AI-006~010, DOC-001~003 | REQ-GENERATING, REQ-DRAFT, PRD-DRAFT | AI-003, AI-006~010 | `PT-AI-002` |
| `PATH-AI-BUDGET` | AI-006, AI-008, AI-010 | AI-ERROR, 기존 Frame | AI-003, AI-008, AI-010 | `PT-AI-003` |
| `PATH-AUTH-SUCCESS` | AUTH-001~004 | AUTH-CHECK, LOGIN, AUTH-REDIRECT, HOME | AUTH-001~004, AUTH-007 | `PT-AUTH-001` |
| `PATH-AUTH-DENIED` | AUTH-001~002 | LOGIN, AUTH-ERROR | AUTH-002~004 | `PT-AUTH-002` |
| `PATH-AUTH-EXPIRED` | AUTH-003~004 | SESSION-EXPIRED, LOGIN | AUTH-003~005, AUTH-007 | `PT-AUTH-001` |
| `PATH-AUTH-API-BYPASS` | AUTH-003, NFR-004 | LOGIN | AUTH-003, AUTH-005 | `PT-AUTH-002` |
| `PATH-AUTH-USER-SWITCH` | AUTH-004~005 | LOGIN, HOME | AUTH-006~007 | `PT-AUTH-003` |
| `PATH-HAPPY-IDEA` | PJT-001, CONV-001~002, PROP-001~002, DES-001~003, DOC-001~003 | HOME, INTAKE, PROPOSAL, DISCOVERY, REQ, PRD | PRJ-102, CON-202~204, DSG-301~306, DOC-402~404 | `PT-E2E-001` |
| `PATH-HAPPY-FILE` | SRC-001~002, CONV-001, DOC-001~003 | HOME, INTAKE, PROPOSAL, REQ, PRD | SRC-501~503, CON-202, DOC-402~404 | `PT-E2E-002` |
| `PATH-PARTIAL-FILE` | SRC-001~002 | FILE states, INTAKE | SRC-501~503 | `PT-SRC-001` |
| `PATH-CUSTOM-ANSWER` | FORM-002~003, PROP-001 | DISCOVERY, PROPOSAL | CON-204, DSG-301~303 | `PT-FORM-001` |
| `PATH-RECOMMEND` | FORM-003, PROP-001~002 | DISCOVERY, PROPOSAL | CON-204, DSG-301~303 | `PT-FORM-002` |
| `PATH-DEFERRED` | FORM-003~004, DES-003, DOC-001 | DISCOVERY, DESIGN-WORKABLE, REQ | CON-203~204, DSG-305~306, DOC-402 | `PT-002` |
| `PATH-HELP` | FORM-003, CONV-002 | DISCOVERY | CON-203~204 | `PT-FORM-003` |
| `PATH-CONFLICT` | PROP-003, FORM-004 | PROPOSAL, CONFLICT | DSG-304~305 | `PT-003` |
| `PATH-PRD-LOCK` | DOC-003 | REQ-DRAFT, REQ-READY, PRD-LOCKED | DOC-403~404 | `PT-004`, `PT-007` |
| `PATH-DOC-EDIT` | DOC-004 | DOC-IMPACT, DOC-STALE | DOC-405 | `PT-006` |
| `PATH-AI-RETRY` | CONV-005, NFR-005 | AI-ERROR, 이전 Frame | CON-206, QLT-605 | `PT-005` |
| `PATH-SAVE-RETRY` | PJT-002 | SAVE-ERROR, 이전 Frame | PRJ-103~105 | `PT-STO-001` |
| `PATH-REFRESH` | PJT-002~003, CONV-003 | 모든 주요 Frame | PRJ-103~105, CON-205 | `PT-STO-002` |

## 불변식 검증 위치

| 불변식 | 주 테스트 계층 |
| --- | --- |
| `INV-001` 자동 확정 금지 | domain + process integration |
| `INV-002` proposal gate | domain + browser process |
| `INV-003` 자유 대화 유지 | component + browser process |
| `INV-004` 핵심 누락 차단 | readiness unit + API contract |
| `INV-005` deferred 허용 | readiness unit + E2E |
| `INV-006` PRD 잠금 | API contract + E2E |
| `INV-007` 중복 반영 금지 | integration + concurrency test |
| `INV-008` 실패 시 상태 보존 | integration + E2E |
| `INV-009` 영향 확인 선행 | domain + browser process |
| `INV-010` 저장 성공 기준 UI | repository integration + E2E |
| `INV-014` AI 제어권 제한 | schema/domain contract + process test |
| `INV-015` 사건당 task 단위 | request ledger + browser process |
| `INV-016` 문서 pipeline 상한 | service integration + ledger assertion |
| `INV-017` hard budget | budget unit + provider spy E2E |

## 완료 규칙

- P0 PATH에는 자동화 테스트 ID와 fixture가 있어야 한다.
- 테스트 구현 후 마지막 열을 실제 테스트 파일과 test name 링크로 바꾼다.
- 요구사항은 통과했지만 불변식이 실패하면 PATH 전체를 실패로 판정한다.
- UI Frame만 검증하고 aggregate 변화와 request 수를 확인하지 않은 테스트는 프로세스 테스트로 인정하지 않는다.
