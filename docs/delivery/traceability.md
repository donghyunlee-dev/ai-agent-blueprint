# 요구사항 추적표

## 사용법

각 요구사항은 하나 이상의 개발 작업과 검증 증거를 가져야 한다. 구현 PR에서는 상태, PR unit, 코드 리뷰, QA와 사용자 머지 증거 링크를 갱신한다. 상세 상태와 순서는 [PR·리뷰·QA 반복 워크플로](development-pr-review-qa-workflow.md)를 따른다.

| 요구사항 | 주 작업 | 핵심 검증 | 초기 상태 |
| --- | --- | --- | --- |
| AI-001 | AI-001 | task/profile/model/reasoning routing | ready |
| AI-002 | AI-002, AI-009 | prompt/schema version과 변경 gate | ready |
| AI-003 | AI-004 | 6개 block, 8개 proposal 상한, 임의 UI 거절 | ready |
| AI-004 | AI-004, AI-005 | 복수 atomic proposal과 근거 | ready |
| AI-005 | AI-005 | 도움 LIGHT, 추천 DEFAULT, 미확정 | ready |
| AI-006 | AI-003, AI-008 | context 순서, token/hard budget | ready |
| AI-007 | AI-006, AI-007 | plan/draft/review/repair 상한 | ready |
| AI-008 | AI-008 | usage·latency 원장, 원문 미기록 | ready |
| AI-009 | AI-009 | golden eval과 금지 결과 0건 | ready |
| AI-010 | AI-003, AI-010 | store=false, retry/circuit 복구 | ready |
| AUTH-001 | AUTH-001, AUTH-004 | 보호 경로, 로그인 시작, returnTo | ready |
| AUTH-002 | AUTH-002, AUTH-003 | valid 판정, token 만료·재사용, cookie | ready |
| AUTH-003 | AUTH-004, AUTH-005 | 화면 가드와 직접 API 401 | ready |
| AUTH-004 | AUTH-003, AUTH-007 | 계정 표시, 만료, 멱등 logout | ready |
| AUTH-005 | AUTH-006 | A/B owner namespace 격리 | ready |
| PJT-001 | PRJ-102 | 제목 있음/없음, 중복 생성 | ready |
| PJT-002 | PRJ-103, PRJ-105 | 자동 저장, 실패, 새로고침 | ready |
| PJT-003 | PRJ-104, PRJ-105 | 최근 목록과 복구 | ready |
| PJT-004 | PRJ-104 | 20/21 경계, 취소/삭제 | ready |
| PJT-005 | PRJ-101, PRJ-103 | namespace 분리와 404 | ready |
| CONV-001 | CON-202, CON-203 | 첫 입력 복수 후보 | ready |
| CONV-002 | CON-203, DSG-302 | 반복 방지와 제안 gate | ready |
| CONV-003 | CON-202, CON-205 | 단일 thread와 요약 | ready |
| CONV-004 | CON-202, CON-205 | 작업 상태와 취소 | ready |
| CONV-005 | CON-206 | 입력 보존과 중복 없는 재시도 | ready |
| FORM-001 | CON-204 | 7개 answer mode | ready |
| FORM-002 | CON-204 | value/label, 추천 미선택 | ready |
| FORM-003 | CON-204 | 직접 입력, 추천, 미정 | ready |
| FORM-004 | CON-203 | 조건부 활성과 재검토 | ready |
| PROP-001 | DSG-301 | 복수 제안 분리 | ready |
| PROP-002 | DSG-302, DSG-303 | 개별 승인·수정·거절 | ready |
| PROP-003 | DSG-304 | before 재검증과 충돌 해결 | ready |
| PROP-004 | DSG-307 | 제외 수와 atomic 처리 | ready |
| DES-001 | FND-003, DSG-303 | item 상태와 근거 | ready |
| DES-002 | DSG-306, DOC-402 | 요구사항과 수용 기준 | ready |
| DES-003 | DSG-306, DOC-403 | 상태 기반 준비도 | ready |
| DOC-001 | DOC-401, DOC-402, DOC-404 | 동일 revision | ready |
| DOC-002 | DOC-402 | requirements 필수 섹션 | ready |
| DOC-003 | DOC-403, DOC-404 | ready 선행과 PRD 구조 | ready |
| DOC-004 | DOC-405 | 영향 미리보기와 항목별 제외, transaction | ready |
| DOC-005 | DOC-406 | 선택 범위 patch | ready |
| DOC-006 | DOC-407 | 불일치 위치와 proposal | ready |
| DOC-007 | GDE-504 | 전체 생성, 근거 기반 명령·버전과 면책 문구, draft 검증 | ready |
| SRC-001 | SRC-501, SRC-502 | 형식·크기·개수·추출 | ready |
| SRC-002 | SRC-503 | 근거 preview와 제거 | ready |
| EXP-001 | EXP-505 | 개별 복사·다운로드 | ready |
| NFR-001 | FND-002, QLT-601 | 키보드, 이름, 대비 | ready |
| NFR-002 | PRJ-105, QLT-602 | 5개 viewport | ready |
| NFR-003 | QLT-603 | 셸, 긴 콘텐츠, 입력 응답 | ready |
| NFR-004 | CON-201, SRC-503, QLT-604 | 안내, 최소 전송, 비밀 보호 | ready |
| NFR-005 | CON-202, QLT-604 | 비식별 오류와 지연 | ready |
| NFR-006 | CON-205, QLT-605 | 한글 UI·응답·문서 | ready |
| NFR-007 | QLT-604, QLT-606 | 행동 이벤트 미전송 | ready |

## 현재 차단 항목

| 요구사항 | 필요한 결정 |
| --- | --- |
| NFR-002 | 지원 브라우저 범위 |

## 완료 규칙

- `blocked` 요구사항을 구현 PR에 포함하지 않는다.
- 작업은 코드 리뷰와 QA를 통과하고 사용자가 PR을 머지한 뒤에만 상태를 `done`으로 바꾸며 PR·테스트·검토 증거를 연결한다.
- 하나의 테스트가 여러 요구사항을 검증할 수 있지만 각 요구사항에서 판정 지점을 식별할 수 있어야 한다.
- P0 요구사항에 작업 또는 증거가 없으면 단계와 출시를 완료할 수 없다.
