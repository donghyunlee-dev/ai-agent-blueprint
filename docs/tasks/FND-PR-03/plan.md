# FND-PR-03 — 테스트 기반 구성

> **상태: in_progress.** FND-PR-02 PR #8(52410c37e5640e29fc5823f501c303a0a39acabb)이 origin/main에 병합됐고, 현재 main에는 Node.js 내장 node:test unit/contract suite와 Playwright Chromium desktop/mobile E2E suite가 이미 있다. 이 PR은 두 runner를 교체하지 않고 표준 명령·실패 증거·산출물 위치를 정리한다. Implementation validation is recorded in `test-results.md`; independent review and QA remain pending.

## Overview

기존 unit/contract와 Playwright E2E 테스트 실행을 일관된 로컬·headless 명령으로 제공하고 component 테스트의 전용 구조를 준비한다. 성공 결과는 테스트 및 production build가 명시된 명령으로 재현되고, 실패 시 exit code와 실패 위치 또는 Playwright HTML report를 확인할 수 있는 것이다. 실제 GitHub Actions workflow 작성과 기능별 coverage 확대는 범위 밖이다.

## Background

PREP-PR-01에서 추가한 Playwright 설정은 이미 tests/e2e/smoke.spec.ts, desktop/mobile Chromium 프로젝트, test:e2e 및 test:e2e:ci를 제공한다. FND-PR-02는 tests/unit/*.test.js, tests/contract/*.test.js에서 Node.js 내장 node:test와 node:assert를 사용하고, npm run test:unit으로 실행한다. 이 테스트와 디렉터리는 목적지 구조에 이미 있으므로 다시 이동하거나 Vitest로 전환하지 않는다. Vite 프로젝트에 어떤 test runner가 적합한지 가정하는 대신, 실제 사용 중인 Node runner를 보존한다.

현재 저장소에는 tests/component/와 종합 test/test:ci command가 없다. playwright-report/와 test-results/는 ignore되지만 coverage/는 ignore되지 않는다. UI 컴포넌트 테스트는 실제 feature 컴포넌트가 추가되는 해당 feature PR에서 검증할 수 있도록 이 PR은 명확한 구조만 제공한다. 임의로 항상 성공하는 빈 테스트나 아직 존재하지 않는 DOM test harness는 추가하지 않는다.

## Scope

### 포함

- 현재 Node.js node:test 기반 unit/contract test command를 보존하고 npm test alias와 watch command를 추가
- tests/component/README.md에 컴포넌트별 테스트 위치·파일명·기능 PR에서 실제 사용자 행동을 검증해야 하는 기준을 기록
- 기존 Playwright E2E 설정과 두 viewport 프로젝트를 보존하고 test:e2e:ci가 실패 시 playwright-report/index.html과 test-results/ evidence를 남기게 설정
- npm run test:ci에서 unit/contract → desktop/mobile E2E → production build를 순서대로 실행
- .gitignore에 coverage artifact 경로 추가; 이미 ignore되는 playwright-report/와 test-results/ 설정 유지
- 임시 실패 fixture로 runner가 non-zero exit하는지 확인 후 fixture 제거

### 제외

- Vitest, jsdom, React Testing Library 또는 추가 test runner 도입; 현재 node:test와 Playwright로 범위의 검증이 가능하며 component test framework 결정은 실제 isolated DOM component test가 필요한 feature에서 수행
- FND-PR-02 unit/contract test의 내용 수정·재작성·위치 이동
- 기능별 coverage 확대와 신규 UI component behavior 테스트(각 feature PR이 수행)
- GitHub Actions 등 실제 CI workflow YAML 작성. 이 PR은 CI에서 그대로 호출 가능한 script를 제공하지만 CI vendor/required-check configuration은 별도 운영 작업이다.

## 연결 근거

- Delivery 작업: FND-005 ([foundation and contracts](../../delivery/00-foundation-and-contracts.md#fnd-005-테스트-기반))
- Workflow PR unit: FND-PR-03, FND-005 (docs/delivery/development-pr-review-qa-workflow.md)
- 테스트 유형별 예상: [architecture test strategy](../../product/06-architecture.md#테스트-전략)
- 선행 Playwright 스캐폴드: playwright.config.ts, tests/e2e/smoke.spec.ts
- 선행 PR: FND-PR-02 merged PR #8, main commit 52410c37e5640e29fc5823f501c303a0a39acabb

## 선행 조건 (Definition of Ready)

- [x] FND-PR-02는 PR #8로 main에 병합됐고 그 commit이 현재 최신 origin/main이다.
- [x] playwright.config.ts에 preview server와 desktop-chromium/mobile-chromium projects가 있고 tests/e2e/smoke.spec.ts가 존재한다.
- [x] package.json에 test:unit, test:e2e, test:e2e:ci, build command가 있고, locked dependencies에 @playwright/test가 포함된다.
- [x] 기존 unit/contract tests는 Node built-in node:test를 이미 사용하므로 runner choice는 추가 제품 결정을 요구하지 않는다.
- [x] 실제 component test target/framework 부재는 이번 범위에서 구조만 만들고 feature PR의 behavior test로 다루기로 제한했다. Dummy smoke test와 테스트 대상이 없는 framework 추가는 요구하지 않는다.
- [x] playwright-report/ 및 test-results/ ignore 설정이 있고 GitHub Actions workflow는 FND-005 scope에서 제외돼 CI vendor 결정이 필요 없다.
- [x] 정상·실패·경계 acceptance와 검증 명령이 이 plan에 지정됐다.

## 작업 단위별 구현 개요

### FND-005 테스트 기반

1. 기존 npm run test:unit을 기준으로 "test": "npm run test:unit", node --test --watch를 사용하는 "test:watch" script를 추가한다. 기존 test:unit script는 unit/contract suite를 유지한다.
2. tests/component/README.md를 추가해 component test 파일 규칙과 각 feature PR이 behavior coverage를 보유해야 하는 계약을 기록한다. 빈 pass-only test를 만들지 않는다.
3. 기존 test:e2e:ci에 Playwright line reporter와 HTML reporter를 함께 지정해 종료 상태는 stdout에서 확인하고 보고서는 playwright-report/에 생성되게 한다. 기존 config의 두 Chromium viewport와 trace/screenshot 수집 설정은 유지한다.
4. "test:ci" script를 npm run test:unit && npm run test:e2e:ci && npm run build로 구성한다. 첫 실패에서 종료 코드가 non-zero로 전파되어 이후 단계는 실행되지 않는다.
5. .gitignore에 coverage/만 추가한다. playwright-report/와 test-results/는 이미 무시되므로 중복 규칙을 추가하지 않는다.
6. 실패 검증 동안만 tests/unit/에 의도적 실패 test를 임시 추가하고 npm run test의 non-zero 및 테스트명 출력을 확인한 뒤 즉시 제거한다. Playwright smoke 실패 시 HTML report 생성 위치를 확인한다.
7. npm run test:ci, git diff --check, git status --short 결과를 기록하고 테스트 fixture/report가 tracked root file로 남지 않는지 확인한다.

## 프로세스 / 상태 전이

이 PR은 제품 도메인 state를 변경하지 않는다. 검증 pipeline의 순서와 fail-fast 동작은 다음과 같다.

~~~mermaid
flowchart TD
    A[npm run test:ci] --> B[npm run test:unit: node:test unit + contract]
    B -->|실패| B1[non-zero exit, 실패 테스트와 stack을 stdout에 표시]
    B -->|통과| C[npm run test:e2e:ci]
    C --> D[Playwright desktop-chromium + mobile-chromium]
    D -->|실패| D1[non-zero exit, playwright-report/index.html + test-results artifacts]
    D -->|통과| E[npm run build]
    E -->|실패| E1[non-zero exit, tsc/Vite diagnostics]
    E -->|통과| F[local/CI command 성공]
~~~

## 데이터/API 영향

없음. package.json, Playwright test reporting, ignore rules와 test directory guidance만 변경한다. CI vendor integration은 이 PR에서 만들지 않는다.

## Acceptance Criteria

### Happy Path

Given clean checkout and installed locked dependencies, when npm run test is run, then all current unit/contract tests execute via node:test, pass, and return exit code 0.

Given the same checkout, when npm run test:ci is run, then unit/contract tests, test:e2e:ci on desktop and mobile Chromium, and production build run in that order and all pass.

Given a component behavior is introduced in a later feature PR, when that PR adds a component test, then its test file and rationale follow tests/component/README.md; this infrastructure PR does not claim component behavior coverage before such a target exists.

### Failure Case

Given one unit test is temporarily made to fail, when npm run test is run, then it exits non-zero and prints the failing test name and assertion/stack; the temporary failure is removed before commit.

Given an E2E smoke test fails, when npm run test:e2e:ci is run, then it exits non-zero and emits an HTML report at playwright-report/index.html plus Playwright failure artifacts under test-results/.

Given unit tests fail during npm run test:ci, then the aggregate command stops before E2E/build and preserves the failing unit test exit code.

### Boundary

Given the complete suite is run, when repository status is inspected, then screenshots, traces, HTML reports and temporary failure files are absent from tracked/root paths; reports remain in ignored output directories.

Given no CI workflow YAML is in scope, when the PR is reviewed, then the local test:ci entry point and its exact sequence are documented without claiming GitHub Actions or required checks were installed.

## 예상 변경 파일

- package.json (test aliases, watch and aggregate headless scripts)
- playwright.config.ts or its test:e2e:ci CLI arguments (line + HTML reporter configuration)
- tests/component/README.md (component test placement/behavior contract; no dummy test)
- .gitignore (coverage/ 추가; existing Playwright output ignore preserved)

## 테스트 계획

- npm run test — current node:test unit/contract suite, pass and temporary failure/non-zero case
- npm run test:e2e:ci — Playwright smoke suite across desktop-chromium and mobile-chromium; verify HTML report and test-results/ artifacts on a controlled failure
- npm run test:ci — exact aggregate ordering, short-circuit behavior, and final success result
- npm run build — production TypeScript/Vite build
- git diff --check and git status --short — whitespace and report/fixture cleanup

## UI 증거 계획

해당 없음 — 제품 UI를 수정하지 않는다. Playwright는 실행 인프라 검증으로 실행하며 새 visual product screenshots는 요구하지 않는다.

## 코드 리뷰·QA 체크리스트

- 기존 node:test unit/contract tests가 내용 변경이나 누락 없이 기존 script에서 실행되는가
- runner choice가 현재 사용 중인 Node test runner를 유지하고 불필요한 devDependency를 추가하지 않는가
- test:ci가 unit/contract → desktop/mobile E2E → build를 순서대로 fail-fast 실행하는가
- E2E 실패 report가 실제 playwright-report/index.html에 생성되고 raw artifacts가 ignored test-results/에 남는가
- temporary failure probe가 non-zero를 입증한 뒤 삭제됐는가
- GitHub Actions workflow가 설정됐다고 오인할 문구가 없는가
- report, coverage, trace와 screenshot output이 repository root pollution을 만들지 않는가

## Done Checklist

- [ ] Requirements implemented
- [ ] Acceptance criteria verified
- [ ] 독립 코드 리뷰 pass
- [ ] 독립 QA pass
- [ ] 화면 변경 시 desktop/mobile 캡처 완료 (해당 없음 — 화면 변경 없음)
- [ ] 사용자 PR 머지 확인

## 실행 시 추가 문서

- 구현 후 test-results.md, review-notes.md, qa-report.md에 실제 실행 명령·결과와 독립 gate 결과를 기록한다.
