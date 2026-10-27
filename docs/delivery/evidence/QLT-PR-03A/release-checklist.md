# QLT-PR-03A 기술 출시 체크리스트

## 상태

**출시 준비 완료 판정: 보류.** 이 문서는 기존 기술 검증과 현재 Production 배포 정보를 연결합니다. fixture 기반 통과나 배포 URL 존재를 실제 사용자 검증 또는 출시 승인으로 간주하지 않습니다. 사람 대상 관찰과 최종 P0/성공 지표 판정은 [QLT-PR-03 계획](../../../tasks/QLT-PR-03/plan.md)에 남아 있습니다.

## 제품 흐름과 자동화 증거

현재 구현 흐름은 아이디어/자료 입력 → 맥락 기반 대화 → 제안별 승인·수정·거절 → 확정 설계 검토 → **요구사항 명세** 생성·검토·사용자 준비 완료 확인 → 같은 설계 revision에서 PRD 생성·검토·Markdown 내보내기입니다. AI 제안은 승인 전까지 확정되지 않으며, 요구사항 명세 준비 완료 전에는 PRD 생성이 잠깁니다.

| 항목 | 상태 | 증거와 범위 |
| --- | --- | --- |
| QLT-PR-01 접근성·반응형·성능 | 확인됨(기록된 실행 기준) | [테스트 결과](../../../tasks/QLT-PR-01/test-results.md), [화면 증거](../QLT-PR-01/README.md). Browser flow는 deterministic API/session fixture를 사용했고, 실제 AI·Google 로그인은 호출하지 않았습니다. |
| QLT-PR-02 통합 경로·계약·AI 회귀 | 확인됨(기록된 실행 기준) | [테스트 결과](../../../tasks/QLT-PR-02/test-results.md), [QA 보고서](../../../tasks/QLT-PR-02/qa-report.md). 단위/계약, synthetic golden, desktop/mobile browser 결과는 fixture 범위이며 live provider와 실제 Google 로그인은 제외됐습니다. |
| QLT-PR-01 구현 PR | 병합됨 | [PR #66](https://github.com/donghyunlee-dev/ai-agent-blueprint/pull/66) |
| QLT-PR-02 구현 PR | 병합됨 | [PR #67](https://github.com/donghyunlee-dev/ai-agent-blueprint/pull/67) |
| QLT-PR-03A candidate Preview 브라우저 흐름 | 확인됨(fixture 범위) | PR #69 commit `2bcb28c` Preview에서 desktop/mobile 2/2 통과. [테스트 결과](../../../tasks/QLT-PR-03A/test-results.md). AI/document API는 deterministic fixture이며 live provider 검증은 아닙니다. |
| 현재 main Production 배포 식별 | 배포 정보 기록됨 | SHA [`9dea685145d76ca3ebe4c12ad2b3721d549c9256`](https://github.com/donghyunlee-dev/ai-agent-blueprint/commit/9dea685145d76ca3ebe4c12ad2b3721d549c9256), [Production URL](https://windsoft-agent-blueprint-itj1ns4s1.vercel.app). 이 항목은 배포 식별 정보를 연결하며, Production에서 live AI나 실제 사용자 전체 흐름을 검증했다는 뜻은 아닙니다. |
| 이전 경로 `/survey`, `/prd` | 공통 404로 확인됨(기존 검증) | [FND-PR-01 테스트 결과](../../../tasks/FND-PR-01/test-results.md), [QA 보고서](../../../tasks/FND-PR-01/qa-report.md), [404 화면 증거](../FND-PR-01/README.md). 두 경로는 자동 redirect되지 않고 공통 404를 표시합니다. |

## 미완료 release gate

- [ ] **Live AI provider**: 유효한 `OPENAI_API_KEY`와 등록 모델 설정으로 실제 대화, 요구사항 명세, PRD 생성·검토의 성공/실패·비용 동작을 확인한다. Synthetic golden 통과는 이를 대신하지 않습니다.
- [ ] **실제 Google 로그인**: 승인된 테스트 계정으로 OAuth 시작, callback, 로그아웃과 Preview/Production별 실제 callback 설정을 확인한다. 기존 API 계약 테스트와 브라우저 session fixture는 실제 계정 로그인 증거가 아닙니다.
- [ ] **지원 브라우저 결정**: 제품의 공식 지원 브라우저와 버전을 정하고 해당 범위로 검증한다. 현재 자동화 증거는 Chromium viewport 중심이며 다른 브라우저 지원을 주장하지 않습니다.
- [ ] **실제 참여자 세션 (QLT-606)**: 복수의 신규 사용자가 준비된 시나리오를 수행하도록 관찰하고, 성공 지표·혼란·실패 및 후속 조치를 기록한다. fixture 기반 QA는 실제 사용성 결과가 아닙니다.
- [ ] **최종 출시 판정 (QLT-PR-03)**: 위 결과, P0 상태와 성공 지표를 검토해 출시/보류를 결정한다.

## 해석 기준

- QLT-PR-01/02 증거는 기록된 코드/Preview와 deterministic test fixtures의 범위에서 유효합니다. 실제 provider 품질·지연, 실제 계정의 OAuth 여정, 실사용 데이터 보존을 검증한 결과가 아닙니다.
- `9dea685` Production 배포 정보는 main의 배포 대상을 식별합니다. 연결된 QLT Preview 결과를 Production runtime 증거로 확장하지 않습니다.
- 위 미완료 gate가 남아 있으므로 이 체크리스트는 **release-ready** 상태가 아닙니다.
