# QLT-PR-03A — 기술 출시 준비 Implementation Plan

**Status:** merged in [PR #69](https://github.com/donghyunlee-dev/ai-agent-blueprint/pull/69), merge commit `fa5140a27905ad0611d71a903439dcd4b8f22984`.

**Goal:** 실제 사용자 관찰과 최종 출시 판정을 보류한 채, 현재 서비스와 일치하지 않는 설치·배포 정보와 사용하지 않는 이전 구현을 정리하고 기술 증거를 연결한다.

**Architecture:** QLT-PR-01/02의 검증 결과와 기존 `/survey`, `/prd` 404 검증을 재사용한다. `src/main.tsx`에서 도달할 수 없고 앱·테스트에서 참조되지 않는 이전 화면/기능만 제거하며, PRD 세션 정리에 사용하는 `src/features/prd/contextStorage.ts`와 현재 공유 타입·API 계약은 보존한다. 사람 대상 사용성 결과와 최종 출시 승인은 QLT-PR-03에 남긴다.

**Tech Stack:** React 18, TypeScript, Vite, Node test runner, Playwright, Vercel Serverless Functions.

**Spec:** [QLT-PR-03](../QLT-PR-03/plan.md), [quality and release](../../delivery/06-quality-and-release.md), [deployment guide](../../guide/deploy-guide.md).

## Global Constraints

- `/survey`와 `/prd`는 리다이렉트하지 않고 공통 404 화면을 보여준다.
- 현재 대화·제안·요구사항명세서·PRD 생성 흐름과 IndexedDB 데이터 계약을 바꾸지 않는다.
- 서버 비밀값은 브라우저 번들이나 저장소에 추가하지 않는다.
- 사용자 관찰 결과와 최종 출시 준비 완료를 이 작업에서 주장하지 않는다.
- 직접 참조되는 API handler와 fixture 계약은 사용되지 않는 것으로 추정해 삭제하지 않는다.

## Review Focus

- 이전 이름의 모듈이 현재 대화에서 공유 타입/상수를 제공하는지: 참조 검색과 TypeScript build로 확인한다.
- legacy route가 자동 이동 없이 공통 404를 렌더하는지: 기존 PRJ-PR-01 Playwright 경로를 실행한다.
- 환경 변수의 서버 전용/선택 여부가 코드와 맞는지: `process.env` 사용과 OAuth/AI 설정 명세를 대조한다.
- 출시 근거와 미완료 사용자 gate가 구분되는지: checklist에서 사람 검증, live provider, OAuth, 브라우저 범위를 별도 상태로 기록한다.
- 현재 홈과 무관한 마케팅 화면 스타일이 살아 있는지: CSS selector 사용처를 확인하고 현재 홈 셸 스타일은 보존한다.

## Tasks

### Task 1: QLT-PR-03을 기술 준비와 사람 검증으로 분리

**Files:**
- Create: `docs/tasks/QLT-PR-03A/plan.md`
- Modify: `docs/tasks/QLT-PR-03/plan.md`
- Modify: `docs/tasks/README.md`
- Modify: `docs/delivery/development-pr-review-qa-workflow.md`
- Modify: `docs/delivery/traceability.md`

- [x] QLT-PR-03A를 QLT-607 기술 정리 unit으로 등록하고, QLT-PR-03에는 관찰 세션·성공 지표 대조·최종 판정만 남긴다.
- [x] PR #67 merge commit `9dea685145d76ca3ebe4c12ad2b3721d549c9256`와 QLT-PR-01 merge 증거를 기록한다.
- [x] QLT-PR-03의 선행 조건을 QLT-PR-03A 병합, P0 상태 확인, 복수 신규 사용자와 시나리오 준비로 명시한다.

### Task 2: 참조되지 않는 이전 UI와 흐름 제거

**Files:**
- Delete only files under `src/components/home/`, `src/hooks/`, `src/features/survey/`, `src/features/prd/`, `src/features/conversation/`, or `src/features/docs/` proven unreachable from `src/main.tsx` and unreferenced by tests.
- Preserve `src/features/prd/contextStorage.ts` and every module used by `ProjectPage`, current document generation, shared API handlers, or tests.

- [x] App imports and test references are checked before deletion; no deletion is based only on a filename or folder name.
- [x] Remove the old fixed-question/recommendation flow and marketing components only where no live entrypoint references them.
- [x] Remove CSS rules only when their selectors belong exclusively to deleted components; no CSS rules were removed because `src/styles/home.css` is imported by the active `HomePage` and defines its current `.home-shell`, recent-project, and project-start selectors.
- [x] Confirm no imports point to removed paths and run the application build. `contextStorage.ts` retains its validated context type locally so it no longer imports the removed legacy survey/PRD modules.

### Task 3: Update product and deployment instructions

**Files:**
- Modify: `README.md`
- Modify: `docs/guide/deploy-guide.md`

- [x] Replace rebuild-preparation language with the shipped conversation-to-Requirements-to-PRD product description and current design-document links.
- [x] Inventory every app-configured environment variable, explain required/optional environment and server-only scope, and identify Vercel-provided variables as platform values.
- [x] Keep local install, build, Vercel deployment, Redis authentication, and production/Preview caveats consistent with current code.

### Task 4: Prepare an evidence-linked technical release checklist

**Files:**
- Create: `docs/delivery/evidence/QLT-PR-03A/release-checklist.md`
- Create: `docs/tasks/QLT-PR-03A/test-results.md`

- [x] Link QLT-PR-01/02 test and browser evidence, the current production deployment SHA, and existing `/survey`/`/prd` 404 coverage.
- [x] Mark live provider calls, real Google login, support-browser decision, and QLT-606 participant sessions as pending unless current evidence directly verifies them.
- [x] Do not mark the product release-ready; leave final P0/user-metric review to QLT-PR-03.

### Task 5: Verify the technical scope

- [x] Run `npm run test:unit` and `npm run build`.
- [x] Run `npm run test:e2e:ci -- tests/e2e/prj-pr01.spec.ts` to verify legacy routes remain common non-redirecting 404s.
- [x] Run `git diff --check` and confirm no deleted path remains imported.
- [x] Verify the same committed application on its Vercel Preview; browser tests continue to use an authenticated session fixture, not Google OAuth. PR #69 commit `2bcb28c` was READY on Vercel and passed desktop/mobile browser flow 2/2 with the page origin asserted against the Preview URL.
