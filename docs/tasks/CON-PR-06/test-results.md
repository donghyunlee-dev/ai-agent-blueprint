# CON-PR-06 검증 결과

## 기능 단위 검증

| 검증 | 결과 |
| --- | --- |
| TDD RED — 관계가 없는 기존 설계 상세에서 관계 편집 UI가 없음 | 실패 확인 후 구현 |
| `node --test tests/unit/con-pr-06-decision-relationship.test.js tests/unit/con-pr-06-decision-diagram.test.js tests/unit/con-pr-05-decision-summary.test.js` | 10/10 통과 |
| `npx playwright test tests/e2e/con-pr-06-decision-diagram.spec.ts tests/e2e/dsg-pr-03-design-readiness.spec.ts --workers=1 --reporter=line` | 데스크톱·모바일 8/8 통과 |
| `npm run test:unit` | 364/364 통과 |
| `npm run build` | 통과. 기존 500 kB 초과 chunk 경고가 출력됨 |
| `git diff --check` | 통과 |

브라우저 흐름은 설계 상세에서 확정 결정 관계를 저장하고, 양쪽 `relatedItemIds` 및 revision이 갱신되는지 확인한다. 대화로 이동해 텍스트 기본 보기, 도식 전환, 관계 표현, 압축된 원본 메시지 탐색을 검증한다. 관계가 없을 때 모바일 요약은 텍스트로 남고 도식 전환은 노출되지 않는다.

## 전체 브라우저 회귀 상태

Google 로그인 파일을 제외한 전체 Playwright 실행은 262개 테스트 중 62개 통과, 다수의 기존 계약 불일치 실패를 확인한 뒤 로그인 시나리오가 `smoke.spec.ts`에 포함된 사실을 발견해 중단했다. 확인된 오래된 기대는 고정 질문 카드, 최근 프로젝트 6개 표시, 프로젝트 생성 후 `/design` 경로, 이전 workspace 패널 이름 등 현재 main의 자유 대화·새 홈 시안과 맞지 않는다. 따라서 이 실행은 통과로 간주하지 않는다. 로그인은 미포함이며, 관련 테스트 정리는 별도 작업으로 남긴다.
