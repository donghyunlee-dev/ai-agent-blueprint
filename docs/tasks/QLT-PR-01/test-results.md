# QLT-PR-01 검증 결과

## 로컬 검증

| 범위 | 실행 | 결과 |
| --- | --- | --- |
| Unit/contract | `npm run test:unit` | 356 passed, 0 failed |
| Desktop Chromium | `npx playwright test tests/e2e/qlt-pr-01-responsive-contracts.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/uir-pr-03-stage-conversation.spec.ts --project=desktop-chromium --workers=1` | 13 passed |
| Mobile Chromium | 위 테스트 목록으로 `--project=mobile-chromium --workers=1` | 8 passed, 5 desktop-only skips |
| Screenshot capture | `npx playwright test tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts --workers=1` | 8 passed, 2 desktop-only skips; 캡처 생성 확인 |
| Build | `npm run build` | Passed. Vite reports the existing 500 kB chunk warning; JS entry is 527.60 kB and PDF worker is 1,232.30 kB before gzip. |
| Whitespace | `git diff --check` | Passed |

## 추가 회귀 조사

| 범위 | 실행 | 결과 |
| --- | --- | --- |
| Unknown 요청 복구 (desktop Chromium) | `npx playwright test tests/e2e/con-pr-03-conversation.spec.ts --project=desktop-chromium --workers=1 --grep 'AI_REQUEST_UNKNOWN blocks new intents'` | 수정 전 실패: 만료·상태 확인 뒤에도 이전 `logicalRequestId`가 재사용됨. 수정 후 1 passed. |
| Unknown 요청 복구 (mobile Chromium) | 위 명령의 `--project=mobile-chromium` | 1 passed. |
| 단위·계약 | `npm run test:unit` | 356 passed, 0 failed. |
| 변경 영향 브라우저 집합 (desktop Chromium) | `qlt-pr-01-responsive-contracts`, `uir-pr-04-proposal-review`, `doc-pr-01-requirements-generation`, `doc-pr-04-direct-edit-impact`, `uir-pr-03-stage-conversation` | 13 passed. |
| 변경 영향 브라우저 집합 (mobile Chromium) | 같은 테스트 목록, mobile Chromium | 8 passed, 5 desktop-only skips. |
| 대화 legacy 회귀 묶음 (desktop Chromium) | `npx playwright test tests/e2e/con-pr-03-conversation.spec.ts --project=desktop-chromium --workers=1` | 7 passed, 2 failed. 두 실패는 현재 대화 계약과 다른 오래된 fixture 기대다: 요약 패널에 `thread.summary`를 직접 렌더링한다고 가정하고, 고정 카탈로그 질문 문구·옵션을 기대한다. 이 범위는 현행 계약으로 갱신할 후속 테스트 정리 대상이다. |
| 전체 대화형 흐름 (desktop Chromium) | `npx playwright test tests/e2e/con-pr-05-conversation-flow.spec.ts --project=desktop-chromium --workers=1` | 6 passed. 자유 대화, contextual follow-up, 11개 런타임 후보, 명시적 제안 승인, Requirements/PRD 생성 경로를 포함한다. |
| 전체 대화형 흐름 (mobile Chromium) | 같은 명령의 `--project=mobile-chromium` | 6 passed. |

Unknown 결과는 기존 logical request의 재시도를 허용하지 않으므로, `AI_REQUEST_UNKNOWN` 저장 시 대기 turn을 해제한다. 24시간 만료 뒤 상태를 확인한 새 전송은 새 logical request와 사용자 메시지를 만든다. 확인용 E2E는 세 번의 요청 ID가 각각 달라지는 것을 검사한다.

CON-PR-05 흐름 테스트는 기존 프로젝트를 IndexedDB에 seed하고 turn/문서 API 응답을 mock한다. PRD `review_required` 생성까지는 검증하지만, 홈에서 프로젝트를 새로 만들거나 PRD 사용자 승인·내보내기까지 이어지는 한 번의 사용자 여정은 아직 검증하지 않는다. 이 통합 검증은 후속 제품 QA 범위로 남긴다.

모든 브라우저 실행은 로컬 Chromium과 결정적인 테스트 session/API fixture를 사용했다. Google 로그인, callback, logout은 호출하지 않았다. 태블릿 ToC 회귀는 기존 CSS에서 nav scrollTop이 0으로 남는 RED를 확인한 뒤 수정된 CSS에서 통과했다. 제안 검토 경계 테스트는 기존 1024px 카드 폭 393.8px의 실패를 확인한 뒤 1024·1279·1280px에서 통과했다. 대화 옵션 테스트는 320·360·390·768·1023·1024·1280·1440px에서 선택 보존, 아바타/아이콘 경계와 가로 넘침을 확인했다.

## Preview에서 확인할 항목

- PR의 배포 Preview URL과 리뷰 대상 HEAD가 일치하는지 확인
- 홈의 첫 주요 행동까지 5회 측정: 개별값, median, worst; NFR-003의 2.5초 기준 적용
- 긴 대화·문서 렌더 시간, 10 MiB 파일 검증/추출 시간, 자동 저장 응답 중 입력 유지 확인. 명세되지 않은 수치에는 임의의 합격 기준을 만들지 않는다.

Preview 성능 및 시각 확인 전에는 QLT-603과 PR 완료를 판정하지 않는다.

## 화면 캡처

`docs/delivery/evidence/QLT-PR-01/README.md`에 인증 fixture로 생성한 변경 화면 캡처를 보관한다. 대화(390×844, 1024×768, 1440×900), 제안 검토(390×844, 1024×1024, 1440×900), 요구사항 목차 drawer(390×844, 768×520, 1024×520)를 포함한다.
