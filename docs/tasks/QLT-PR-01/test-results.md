# QLT-PR-01 검증 결과

## 변경 HEAD 기준 로컬 검증

아래 로컬 결과는 QLT-PR-01 작업 브랜치에서 확인했다. 모바일 요약 버튼 겹침 수정은 Preview SHA `cc7db6a658518266da28110caccade23d9f9a7f5`에서 별도로 검증했다. 상세 성능 측정은 이전 기준 UI SHA c8에, 수정 후 화면 검증은 cc7db6a에 해당한다.

| 범위 | 실행 | 결과 |
| --- | --- | --- |
| Unit/contract | `npm run test:unit` | 356 passed, 0 failed |
| 화면·접근성·프로세스 브라우저 묶음 | `npx playwright test tests/e2e/qlt-pr-01-keyboard-flow.spec.ts tests/e2e/qlt-pr-01-overlay-focus.spec.ts tests/e2e/qlt-pr-01-responsive-contracts.spec.ts tests/e2e/uir-pr-04-proposal-review.spec.ts tests/e2e/doc-pr-01-requirements-generation.spec.ts tests/e2e/doc-pr-04-direct-edit-impact.spec.ts tests/e2e/uir-pr-03-stage-conversation.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` | 35 passed, 5 expected desktop-only skips, 0 failures |
| 지연 자동 저장 중 제목 입력 | `npx playwright test tests/e2e/prj-pr02.spec.ts --grep 'project title stays editable while autosave is in flight' --project=desktop-chromium --project=mobile-chromium --workers=1` | 2 passed. Save 요청을 지연시킨 동안 최신 제목 입력을 받고, 지연 해제 후 최신 값이 저장됨 |
| Build | Playwright `webServer`의 `npm run build && npm run preview -- --port 4173` | Passed. Vite의 기존 500 kB chunk warning이 남아 있음 |
| 공백 검사 | `git diff --check` | Passed |

브라우저 여정은 홈에서 프로젝트를 만들고 대화에서 문맥 기반 추천 11개를 확인한 뒤 하나를 선택한다. 제안을 승인하고 설계를 확인한 후 요구사항 명세를 작성·검토 완료하고 PRD를 작성해 Markdown으로 다운로드한다. 이 여정은 desktop과 mobile Chromium에서 통과했다. API 응답은 deterministic fixture로 대체했으며 Google 로그인·callback·logout 요청이 없음을 테스트에서 확인한다.

접근성·반응형 테스트는 홈, 대화, 설계와 근거, 제안 검토, 요구사항 명세, PRD를 390×844, 768×1024, 1024×768, 1280×800, 1440×900 viewport에서 확인한다. 이름이 있는 main landmark, heading 순서, 입력·선택 이름, 표시 텍스트 대비, 수평 overflow를 검사한다. Overlay는 초기 focus, Tab 순환, Escape, trigger focus 복귀를 검사한다. 축소 모션 환경과 720×450 CSS viewport(200% 확대 대응)도 확인한다.

## 기준 UI Preview 검증 — SHA c8

- 배포 SHA: `c8cc94cf538312717e4188b15373234538ec815c`; GitHub PR #66의 Vercel check는 `pass`였다.
- Vercel deployment: `dpl_7zqMcm9DsiuYzjZMeBLwK49eU6Ai`, 상태 `READY`, `https://windsoft-agent-blueprint-cvoj3e4nh.vercel.app`. Vercel API metadata의 `githubCommitSha`가 위 SHA와 일치했다. 보호 Preview의 `vercel curl ... -I`는 HTTP 200을 반환했다.
- 보호된 Preview에 origin 제한 OIDC header를 적용한 `vercel env run -- sh -c 'PLAYWRIGHT_PREVIEW_URL=<preview-url> npx playwright test --config playwright.preview.config.mjs --workers=1'` 결과: desktop/mobile **2 passed**. 홈→프로젝트 생성→문맥 기반 11개 추천→선택·제안 승인→요구사항 명세 작성 및 검토 완료→PRD 생성→Markdown 다운로드를 실행했다. Google 로그인·callback·logout은 요청되지 않았다.
- 홈의 첫 주요 입력 가능 상태 5회(ms): `722, 591, 696, 902, 865`; median `722ms`, worst `902ms`. 모든 회차 HTTP 200, 입력 및 시작 버튼 활성, page error 0건이었다. NFR-003 2.5초 목표를 만족했다.
- 합성 대화 5,000개에서 10개 표시 행 렌더 `776ms`; 제목 입력 응답 `87ms`; IndexedDB 저장 확인. 합성 요구사항 문서 11개 section·82,081자 렌더 `449ms`. 합성 TXT `10,485,760 bytes` 추출 후 같은 길이의 텍스트가 저장되고 `ready`가 되기까지 `2,419ms`였다.
- 긴 대화·문서·파일 측정은 모두 합성 fixture와 local IndexedDB를 사용했다. 실제 AI provider, 사용자 계정/OAuth, 원격 persistent storage의 성능이나 동작 증거는 아니다. 별도의 지연 자동 저장 입력 테스트는 로컬 fixture에서 desktop/mobile 2/2 통과했다.

## 모바일 겹침 수정 Preview 검증

- 수정 SHA: `cc7db6a658518266da28110caccade23d9f9a7f5`; Vercel deployment `dpl_HEYHTqELY9Ns2Fw7zcGcVLfk1F17` (`READY`), [Preview](https://windsoft-agent-blueprint-ivf9k14hx.vercel.app). Vercel API metadata의 `githubCommitSha`가 수정 SHA와 일치했다.
- 보호된 Preview에서 `vercel env run --environment preview -- sh -c 'PLAYWRIGHT_PREVIEW_URL=<preview-url> npx playwright test --config playwright.preview.config.mjs --workers=1'`: desktop/mobile **2 passed**. Google OAuth 시작·callback·logout 요청은 0건이었다.
- QA가 실제 390×844 Preview DOM에서 요약 버튼과 첫 사용자 메시지 시간 사이에 **25px 간격**을 확인했다. 1440×900에서는 요약 버튼이 표시되지 않는다. 수정된 두 화면 캡처는 실제 Preview에서 CSS 픽셀 크기로 생성했다.
- 독립 코드 리뷰와 독립 Preview QA 모두 blocker 없음으로 확인했다.

## 검증 범위와 제한

- 흐름 테스트는 test session과 합성 IndexedDB 데이터를 사용하며 AI turn, Requirements, PRD API를 mock한다. 실제 AI provider 품질·지연, OAuth 로그인, 서버 저장소를 검증한 결과가 아니다.
- 자동 저장 테스트는 지연된 repository save를 fixture에서 주입해 입력 가능 상태와 최종 저장 값을 확인한다. 별도의 최대 입력 지연 목표는 문서에 정의되어 있지 않아 latency 합격 기준을 만들지 않았다.
- 접근성 검사는 이번 흐름에서 heading, landmark, 이름/description 연결, radio/checkbox 이름, 대비와 keyboard overlay 동작을 확인한다. 모든 상태의 live-region 발화와 모든 애니메이션 속성에 대한 전수 검증이나 WCAG 인증을 뜻하지 않는다.
- 별도 실행에서 `tests/e2e/prj-pr02.spec.ts` 전체를 돌렸을 때 오래된 홈 빈 상태 assertion이 현재 홈의 예시 프로젝트 표시와 불일치했다. 이 파일 전체를 QLT acceptance로 간주하지 않고, 이번 변경에 추가한 지연 자동 저장 테스트만 desktop/mobile에서 재실행해 통과를 확인했다.

## 기존 Preview 기록 — 현재 변경 이전 HEAD

아래는 직전 배포 SHA `473461dc7760b74588e979ae102e694da0c9e74e`의 역사적 측정이며, 위 c8 배포 검증으로 대체됐다.

- 당시 배포: `dpl_2akqVZfmEEAx7NCwMTZDaKR2erLi`, target `preview`, URL `https://windsoft-agent-blueprint-gyw7n40fk.vercel.app`.
- 당시 홈 첫 행동 상호작용 5회는 `427, 446, 386, 415, 429ms`였고 median `427ms`, worst `446ms`였다. 당시 측정된 NFR-003의 2.5초 이내였다.
- 합성 메시지 5,000개에서 대화 행 10개 렌더 `328ms`; 입력 반응 `29ms`; 11개 섹션·82,081자 문서 렌더 `388ms`; 합성 TXT 10 MiB 추출 `1,140ms`였다.
- 당시 Preview는 실제 AI provider와 server persistence를 검증하지 않았고 자동 저장 지연을 주입하지 않았다.

## 화면 캡처

`docs/delivery/evidence/QLT-PR-01/README.md`의 `conversation` 두 이미지는 겹침 수정 Preview SHA `cc7db6a`에서, 나머지 기본 `home`, `design`, `proposal`, `requirements`, `prd` 이미지는 Preview SHA c8에서 캡처한 390×844 및 1440×900 화면이다. UI는 Preview 자산에서 실제로 렌더링했으며, 세션과 생성 API는 deterministic fixture로 대체했다.
