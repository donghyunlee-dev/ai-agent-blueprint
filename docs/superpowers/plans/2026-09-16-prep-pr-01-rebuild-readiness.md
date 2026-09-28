# PREP-PR-01 리빌드 착수 준비 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리빌드 착수 전 문서 감사에서 발견된 설정/문서 불일치를 정리하고, DOC-004·GDE-504 제품 결정을 확정·반영해 27개 PR 단위표의 blocked 항목을 해소한다.

**Architecture:** 이 작업은 `docs/product/08-delivery-plan.md`의 27개 PR 단위표에 속하지 않는 사전 준비 unit(`PREP-PR-01`)이다. 요구사항 ID에 연결되지 않지만 `docs/delivery/development-pr-review-qa-workflow.md`의 PR 개발 단위 기준(검증 가능한 결과, 정상/실패 확인, 선행 조건 없음)을 동일하게 따른다. 코드 변경(Playwright 스캐폴드)과 문서 변경(가이드 재작성, 결정 반영, 표기 오차 수정)을 하나의 PR로 묶는다 — 서로 다른 파일이며 독립적으로 되돌릴 수 있지만, 모두 "리빌드 착수 조건"이라는 하나의 사용자 결과를 완성하므로 분리하지 않는다.

**Tech Stack:** Markdown 문서, `package.json`/`playwright.config.ts` (Vite + TypeScript 프로젝트), `@playwright/test`.

---

## 배경 근거 (구현자가 알아야 할 사실)

- 저장소는 리빌드 준비 단계이며 `docs/product/08-delivery-plan.md`가 정의한 인증 선행 → 0~6단계, `docs/delivery/development-pr-review-qa-workflow.md`가 정의한 27개 PR 단위표를 따른다.
- `AGENTS.md:28`, `CLAUDE.md`, `docs/delivery/development-pr-review-qa-workflow.md:157,257,318`은 모든 UI PR에 Playwright 캡처를 요구하는데, PR 단위표상 두 번째 PR인 `AUTH-PR-02`(로그인·보호 라우트, UI 포함)가 test 인프라를 정식으로 구성하는 `FND-PR-03`(6번째)보다 먼저 온다. 즉 Playwright가 필요한 시점이 그것을 준비하는 PR보다 앞선다. 이 계획은 최소 Playwright 스캐폴드를 지금 추가해 그 간극을 없앤다. `FND-PR-03`(`docs/delivery/00-foundation-and-contracts.md:109` FND-005)은 여전히 도메인/계약/컴포넌트 테스트 디렉터리 전체 구성을 담당하며 이 계획이 대체하지 않는다.
- `docs/product/10-decision-log.md`는 `DEC-001`~`DEC-039`까지 순번으로 기록돼 있다. 이번 결정은 `DEC-040`, `DEC-041`로 이어 붙인다.
- 사용자가 확정한 두 결정:
  - DOC-004: 문서 편집 영향 미리보기에서 사용자가 영향받는 항목을 **항목별로 선택 제외**하고 저장할 수 있다.
  - GDE-504: 설정 가이드의 명령어·버전은 **확정 설계와 업로드된 참고 자료에서 근거를 찾을 수 있는 내용만** 작성하고, 외부 최신 버전 사실 확인 없이 실행 전 확인이 필요하다는 **면책 문구**를 가이드 본문에 고정 삽입한다.

---

### Task 1: `docs/delivery/traceability.md`의 AI-003 표기 오차 수정

**Files:**
- Modify: `docs/delivery/traceability.md:11`

- [ ] **Step 1: 현재 오기 확인**

Run: `grep -n "AI-003" docs/delivery/traceability.md docs/product/03-requirements.md docs/product/13-prompt-and-response-contracts.md`
Expected:
```
docs/delivery/traceability.md:11:| AI-003 | AI-004 | 8개 block, 임의 UI 거절 | ready |
docs/product/03-requirements.md:43:### AI-003 상황별 응답 block — P0
docs/product/13-prompt-and-response-contracts.md:131:- 한 응답은 최대 6개 block이다.
```
근거: `docs/product/03-requirements.md:49`는 "최대 6개 block과 여러 atomic proposal", `docs/product/13-prompt-and-response-contracts.md:208`는 "한 답변에서 최대 8개 atomic proposal"이라고 명시한다. 추적표가 block 상한(6)과 proposal 상한(8)을 혼동해 "8개 block"으로 적었다.

- [ ] **Step 2: 수정**

`docs/delivery/traceability.md:11`을 다음으로 교체한다.

```markdown
| AI-003 | AI-004 | 6개 block, 8개 proposal 상한, 임의 UI 거절 | ready |
```

- [ ] **Step 3: 검증**

Run: `grep -n "AI-003" docs/delivery/traceability.md`
Expected: `8개 block` 문자열이 더 이상 나오지 않고 `6개 block, 8개 proposal 상한`이 출력된다.

- [ ] **Step 4: Commit**

```bash
git add docs/delivery/traceability.md
git commit -m "docs: AI-003 추적표의 block/proposal 상한 표기 오차 수정"
```

---

### Task 2: `docs/guide/deploy-guide.md`를 현재 아키텍처로 재작성

**Files:**
- Modify (전체 교체): `docs/guide/deploy-guide.md`

**배경:** 현재 파일은 `public/index.html` 정적 사이트, `survey.html → index.html` 링크 점검 등 리빌드 이전 설문 앱 배포법을 그대로 담고 있다. `docs/product/06-architecture.md:17-45`가 정의한 구조는 `Vercel Serverless API`(`api/auth/*`, `api/blueprint/*`) + `React SPA`(Vite build) + `AX Login` + `OpenAI Responses API`이며 서버 DB 없이 브라우저 IndexedDB만 사용한다. 정적 파일 서빙이 아니라 서버리스 함수 배포가 핵심이므로 사내 서버 Nginx 정적 서빙, 로컬 Python `http.server` 안내는 아키텍처와 맞지 않는다.

- [ ] **Step 1: 기존 파일 내용을 새 내용으로 전체 교체**

`docs/guide/deploy-guide.md` 전체를 아래 내용으로 덮어쓴다.

```markdown
# 배포 가이드

> Vercel Serverless API + React SPA + AX Login 구조의 배포 절차

## 아키텍처 요약

Blueprint는 정적 파일 서빙이 아니라 Vercel Serverless Functions로 `api/auth/*`, `api/blueprint/*`를 배포하고, 빌드된 React SPA를 같은 프로젝트에서 서빙한다. 서버 DB는 없으며 프로젝트 데이터는 인증된 사용자의 브라우저 IndexedDB에만 저장된다. 상세 구조는 [아키텍처 명세](../product/06-architecture.md)를 따른다.

## 최초 배포

```bash
npm install -g vercel
cd SFOOD-AGENT-BLUEPRINT
vercel
```

안내 프롬프트에서 다음을 선택한다.

- Set up and deploy? Y
- Which scope? (사내 조직 계정 선택)
- Link to existing project? 기존 프로젝트가 있으면 Y, 없으면 N
- Project name: 저장소와 동일한 이름 사용 권장
- Directory: `./`

Vercel은 `npm run build`(`tsc -b && vite build`)로 SPA를 빌드하고 `api/` 디렉터리의 파일을 서버리스 함수로 자동 배포한다. 별도 서버 설정 파일은 필요하지 않다.

## 프로덕션 배포

```bash
vercel --prod
```

## 환경 변수

다음 값은 Vercel 대시보드의 **Settings → Environment Variables** 또는 `vercel env add <NAME>`으로만 등록하고, 저장소나 클라이언트 번들에 포함하지 않는다.

| 변수 | 용도 |
| --- | --- |
| `AX_AUTH_CLIENT_SECRET` | AX Login backend redirect client 인증 |
| `AX_SESSION_SECRET` | Blueprint HttpOnly 세션 서명 |
| `OPENAI_API_KEY` | OpenAI Responses API 호출 |
| `AI_MODEL_LIGHT`, `AI_MODEL_DEFAULT`, `AI_MODEL_FINAL` | 논리 model profile의 물리 model ID 매핑 |

AX client 등록값과 callback URI는 배포 전 `ax-auth` MCP의 `get_client_config`로 환경별 실제 값을 대조한다. 자세한 계약은 [AX Login 인증 설계](../product/11-ax-login-authentication.md)를 따른다.

로컬 개발은 `.env`(git 추적 제외)에 동일한 키를 넣고 `npm run dev`로 실행한다.

## 배포 전 체크리스트

```
☐ .env가 .gitignore에 포함되어 있는가
☐ API 키·AX secret이 소스코드나 커밋 이력에 없는가
☐ npm run build가 로컬에서 성공하는가
☐ /login, /, /blueprints/new, /blueprints/:projectId 라우트가 배포 환경에서 401/404를 올바르게 반환하는가
☐ 데스크톱·모바일 레이아웃 확인
☐ HTTPS 적용 여부 확인 (Vercel은 기본 제공)
```

## 도메인 연결

1. Vercel 대시보드 → 프로젝트 → **Settings** → **Domains**
2. 사내 도메인 입력 → **Add**
3. 도메인 구매처 DNS에 안내된 CNAME 레코드 등록
```

- [ ] **Step 2: 검증**

Run: `grep -n "survey.html\|public/index.html\|http.server\|Nginx" docs/guide/deploy-guide.md`
Expected: 아무 결과도 출력되지 않는다(레거시 정적 배포 안내가 모두 제거됨).

Run: `grep -n "AX_AUTH_CLIENT_SECRET\|Vercel Serverless" docs/guide/deploy-guide.md`
Expected: 두 문자열 모두 매치된다(현재 아키텍처 반영 확인).

- [ ] **Step 3: Commit**

```bash
git add docs/guide/deploy-guide.md
git commit -m "docs: 배포 가이드를 Vercel Serverless + AX Login 구조로 재작성"
```

---

### Task 3: `docs/guide/openai-prompt-guide.md`를 Responses API 정책으로 재작성

**Files:**
- Modify (전체 교체): `docs/guide/openai-prompt-guide.md`

**배경:** 현재 파일은 Chat Completions의 `system/developer/user/assistant` 메시지 배열과 `model: gpt-5.3` 예시를 설명한다. `docs/product/12-ai-orchestration-and-model-policy.md:138-146`과 `docs/product/13-prompt-and-response-contracts.md:11-98`은 `POST /v1/responses`, `store:false`, `truncation:"disabled"`, `ContextManifest`, `AiResponseEnvelope`, versioned prompt/schema registry를 사용하는 Responses API 기반 정책을 규정한다. 이 가이드를 그대로 참고해 구현하면 아키텍처와 다른 API 형태의 코드를 작성하게 된다.

- [ ] **Step 1: 기존 파일 내용을 새 내용으로 전체 교체**

`docs/guide/openai-prompt-guide.md` 전체를 아래 내용으로 덮어쓴다.

```markdown
# OpenAI Responses API 프롬프트 적용 가이드

> Blueprint는 Chat Completions가 아니라 Responses API(`POST /v1/responses`)를 사용한다. 이 문서는 System/Developer 지침을 앞세우는 메시지 구조를 Responses API 기준으로 설명한다.

## 개요

지침을 "먼저 읽히는" 방식은 별도 기능이 아니라 입력 순서 설계다. Responses API도 입력 항목을 순서대로 처리하므로, 시스템 규칙과 작업별 개발자 규칙을 사용자 요청보다 앞에 배치한다. 실제 System/Developer 문구와 변수는 [AI Prompt Template 명세](../product/15-ai-prompt-template-spec.md)를, task·model profile 매핑은 [AI 오케스트레이션과 모델 정책](../product/12-ai-orchestration-and-model-policy.md)을 따른다.

## 입력 계층

Blueprint는 다음 순서로 입력을 구성한다([프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md) 컨텍스트 계층 참고).

1. System 규칙 — 모든 task에서 유지되는 절대 규칙(한국어 응답, 미확정 사실 단정 금지 등)
2. Developer 규칙 — task별 목적, 입력 범위, 금지 결과
3. Context manifest — 이번 요청에 포함된 확정 설계, 충돌, source excerpt의 ID 목록
4. 사용자 요청 — 실제 질문/답변/편집 대상

## 요청 형태

```ts
const response = await client.responses.create({
  model: resolveModelId(profile), // LIGHT/DEFAULT/FINAL → AiModelRegistry
  input: [
    { role: "system", content: systemRules },
    { role: "developer", content: taskDeveloperRules },
    { role: "user", content: userTurnPayload },
  ],
  text: { format: { type: "json_schema", schema: taskSchema, strict: true } },
  reasoning: { effort: "low" },
  store: false,
  truncation: "disabled",
  safety_identifier: hashedOwnerKey,
});
```

- `model`은 물리 model ID를 직접 쓰지 않고 `AiModelRegistry`에서 논리 profile(`LIGHT`/`DEFAULT`/`FINAL`)로 조회한다.
- `store: false`를 항상 명시한다. prompt cache는 사내 데이터 정책 확인 후 서버에서만 별도로 켠다.
- `truncation: "disabled"`를 사용하고, provider 자동 truncation 대신 서버 token budgeter가 컨텍스트 생략 범위를 결정한다.
- 구조화 출력이 필요한 모든 task는 `text.format`에 `json_schema` + `strict: true`를 사용한다. 자유 텍스트만 반환하는 task는 없다.
- `safety_identifier`에는 인증 `ownerKey`에서 파생한 비식별 ID만 사용하고 이메일·프로젝트명·원문을 넣지 않는다.

## Stateless 처리와 대화 이어가기

Responses API도 상태를 서버가 자동으로 유지하지 않는다(`store:false`이므로 더더욱 그렇다). 각 요청은 다음을 함께 전달한다.

- 최근 대화 메시지 중 관련된 것만(`ContextManifest.recentMessageIds`)
- 오래된 대화는 원문 대신 `CONTEXT_COMPACT` task로 만든 구조화 요약(`summaryIds`)

## 검증

- 응답은 `AiResponseEnvelope`(`task`, `promptVersion`, `schemaVersion`, `designRevision`, `payload`, `referencedItemIds`, `referencedSourceIds`, `warnings`)로 감싸 반환한다.
- 서버가 요청 시점의 `task`/`promptVersion`/`schemaVersion`을 응답과 대조하고, 불일치하거나 `ContextManifest` 밖의 ID를 참조하면 전체 응답을 거절한다.
- 허용된 `DisplayBlock` enum 밖의 값, HTML, 임의 UI component 이름은 `AI_INVALID_OUTPUT`으로 처리하고 프로젝트 상태에 반영하지 않는다.

## 지침 작성 원칙

- system/developer 지침은 versioned prompt registry(`docs/product/13-prompt-and-response-contracts.md`)로 관리하고 코드에 inline 문자열로 흩어놓지 않는다.
- 문구를 바꿔도 모델 행동이 달라질 수 있으면 `promptVersion`을 올린다.
- prompt/model/schema를 바꾸면 golden eval을 다시 통과해야 배포한다([AI 예산·평가·운영](../product/14-ai-budget-evaluation-and-operations.md)).

## 참고

- [AI 오케스트레이션과 모델 정책](../product/12-ai-orchestration-and-model-policy.md)
- [프롬프트·응답 계약](../product/13-prompt-and-response-contracts.md)
- [AI Prompt Template 명세](../product/15-ai-prompt-template-spec.md)
- [AI 호출 예산·평가·운영 명세](../product/14-ai-budget-evaluation-and-operations.md)
```

- [ ] **Step 2: 검증**

Run: `grep -n "gpt-5.3\|Chat API\|role.*assistant" docs/guide/openai-prompt-guide.md`
Expected: 매치 없음(Chat Completions 예시 제거 확인).

Run: `grep -n "responses.create\|store: false\|truncation" docs/guide/openai-prompt-guide.md`
Expected: 세 문자열 모두 매치된다.

- [ ] **Step 3: Commit**

```bash
git add docs/guide/openai-prompt-guide.md
git commit -m "docs: OpenAI 프롬프트 가이드를 Responses API 정책으로 재작성"
```

---

### Task 4: Playwright 최소 스캐폴드 추가 (UI PR 착수 전 선행 구성)

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `.gitignore`

- [ ] **Step 1: 의존성 추가**

Run: `npm install -D @playwright/test`
Expected: `package.json`의 `devDependencies`에 `@playwright/test`가 추가되고 `package-lock.json`이 갱신된다.

- [ ] **Step 2: package.json script 등록**

`package.json`의 `scripts` 블록을 다음으로 교체한다(기존 4개 script 유지 + 2개 추가).

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "docs:check:mermaid": "node scripts/validate-mermaid.mjs",
    "test:e2e": "playwright test",
    "test:e2e:ci": "playwright test --reporter=line"
  },
```

- [ ] **Step 3: Playwright 설정 파일 생성**

`playwright.config.ts`를 생성한다.

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
});
```

- [ ] **Step 4: smoke 테스트 파일 생성**

`tests/e2e/smoke.spec.ts`를 생성한다.

```ts
import { test, expect } from "@playwright/test";

test("앱 셸이 로드된다", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("#root")).toBeVisible();
});
```

- [ ] **Step 5: `.gitignore`에 Playwright 산출물 경로 추가**

`.gitignore` 파일을 Read로 먼저 확인한 뒤, 다음 3줄이 없으면 파일 끝에 추가한다.

```
playwright-report/
test-results/
.pr-artifacts/
```

- [ ] **Step 6: 실행 검증**

Run: `npx playwright install --with-deps chromium`
Expected: chromium 바이너리 설치 성공(사내 네트워크 제한으로 실패하면 실패 메시지를 그대로 기록하고 다음 단계에서 "로컬 실행 불가, CI에서 확인 필요"로 남긴다 — 성공으로 표시하지 않는다).

Run: `npm run build`
Expected: 기존과 동일하게 성공한다(신규 script가 build를 깨지 않음).

Run: `npm run test:e2e:ci`
Expected: `smoke.spec.ts`의 두 프로젝트(desktop/mobile) 테스트가 통과한다. 브라우저 설치가 안 됐으면 실행 실패 메시지를 그대로 기록한다.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e/smoke.spec.ts .gitignore
git commit -m "test: UI PR 선행 요구사항 충족을 위한 Playwright 스캐폴드 추가"
```

---

### Task 5: DOC-004·GDE-504 결정 반영 및 blocked 상태 해소

**Files:**
- Modify: `docs/product/10-decision-log.md`
- Modify: `docs/delivery/04-documents.md:15,135`
- Modify: `docs/delivery/05-sources-guides-export.md:14,98`
- Modify: `docs/delivery/traceability.md:48,66-69`
- Modify: `docs/delivery/development-pr-review-qa-workflow.md:288,292`
- Modify: `docs/delivery/README.md:97-101`
- Modify: `docs/product/02-prd.md:249-252`

- [ ] **Step 1: 결정 로그에 신규 결정 추가**

`docs/product/10-decision-log.md` 끝에 다음 절을 추가한다.

```markdown

## 2026-09-16 문서·가이드 검증 결정

| ID | 결정 | 반영 문서 |
| --- | --- | --- |
| DEC-040 | 문서 편집 영향 미리보기에서 사용자는 영향받는 항목 중 일부를 선택적으로 제외하고 저장할 수 있다. 제외한 항목은 공통 설계에 반영하지 않고 해당 문서 섹션에서도 stale로 전환하지 않는다. | 문서 생성, 데이터, UI, 개발 계획 |
| DEC-041 | 설정 가이드의 명령어·버전은 확정 기술 결정과 업로드된 참고 자료에서 근거를 찾을 수 있는 내용만 작성한다. 가이드 본문 상단에 "실행 전 최신 버전과 명령어를 직접 확인하라"는 고정 면책 문구를 포함한다. | 자료·가이드, 요구사항, 개발 계획 |
```

- [ ] **Step 2: `docs/delivery/04-documents.md`의 DOC-405 반영**

`docs/delivery/04-documents.md:15`의 다음 줄

```markdown
- 차단 gate: 영향 미리보기 부분 제외 정책
```

을 삭제한다(더 이상 차단 항목이 아니므로 "연결 기준" 목록에서 제거).

`docs/delivery/04-documents.md:135`의 다음 줄

```markdown
- 부분 제외 제공 여부는 관련 결정 gate 전까지 구현하지 않는다.
```

을 다음으로 교체한다.

```markdown
- 사용자는 영향받는 항목 목록에서 개별 항목의 체크를 해제해 제외할 수 있다(`DEC-040`).
- 제외한 항목은 공통 설계에 반영하지 않으며 해당 항목을 참조하는 문서 섹션도 stale로 전환하지 않는다.
```

- [ ] **Step 3: `docs/delivery/05-sources-guides-export.md`의 GDE-504 반영**

`docs/delivery/05-sources-guides-export.md:14`의 다음 줄

```markdown
- 차단 gate: 설정 가이드 명령·버전 검증, 추출 텍스트 수정 정책, 설정 가이드 완료 필수 여부
```

에서 "설정 가이드 명령·버전 검증"만 제거하고 나머지는 유지한다(추출 텍스트 수정 정책과 완료 필수 여부는 이번 결정 범위 밖).

```markdown
- 차단 gate: 추출 텍스트 수정 정책, 설정 가이드 완료 필수 여부
```

`docs/delivery/05-sources-guides-export.md:98`의 다음 줄

```markdown
- 명령·버전의 검증 표현은 결정 gate 확정 후 수용 기준을 보완한다.
```

을 다음으로 교체한다.

```markdown
- 명령·버전은 확정 기술 결정과 업로드된 source excerpt에서 근거를 찾을 수 있는 내용만 작성한다(`DEC-041`).
- 가이드 본문 상단에 "실행 전 최신 버전과 명령어를 직접 확인하라"는 고정 면책 문구를 포함한다.
- 근거 없는 버전·명령을 추측해 작성하지 않는다. 근거가 부족하면 해당 항목을 오픈 이슈로 표시한다.
```

- [ ] **Step 4: `docs/delivery/traceability.md` blocked 해소**

`docs/delivery/traceability.md:48`의 다음 줄

```markdown
| DOC-004 | DOC-405 | 영향 미리보기와 transaction | blocked |
```

을 다음으로 교체한다.

```markdown
| DOC-004 | DOC-405 | 영향 미리보기와 항목별 제외, transaction | ready |
```

`docs/delivery/traceability.md:51`의 다음 줄

```markdown
| DOC-007 | GDE-504 | 전체 생성, draft와 검증 | blocked |
```

을 다음으로 교체한다.

```markdown
| DOC-007 | GDE-504 | 전체 생성, 근거 기반 명령·버전과 면책 문구, draft 검증 | ready |
```

`docs/delivery/traceability.md`의 "## 현재 차단 항목" 표(65-69행)에서 `DOC-004`, `DOC-007` 행 두 개를 삭제하고 `NFR-002`(브라우저 지원 범위, 여전히 미결정) 행만 남긴다.

- [ ] **Step 5: PR 단위표 상태 갱신**

`docs/delivery/development-pr-review-qa-workflow.md:288`의 다음 줄

```markdown
| 20 | `DOC-PR-04` 직접 편집 영향 | DOC-405 | 영향 preview 후 원자 적용과 stale 계산 | blocked |
```

을 다음으로 교체한다.

```markdown
| 20 | `DOC-PR-04` 직접 편집 영향 | DOC-405 | 영향 preview 후 항목별 제외·원자 적용과 stale 계산 | planned |
```

`docs/delivery/development-pr-review-qa-workflow.md:292`의 다음 줄

```markdown
| 24 | `GDE-PR-01` 설정 가이드 | GDE-504 | 근거 있는 전체 가이드 생성·검토 | blocked |
```

을 다음으로 교체한다.

```markdown
| 24 | `GDE-PR-01` 설정 가이드 | GDE-504 | 근거 있는 전체 가이드 생성·검토, 면책 문구 포함 | planned |
```

- [ ] **Step 6: `docs/delivery/README.md`의 차단 후보 목록 갱신**

`docs/delivery/README.md`의 "## 미결정 차단 규칙" 아래 "현재 차단 후보" 목록에서 다음 두 줄

```markdown
- 설정 가이드의 명령어·버전 검증 방식: 5단계 생성·승인 작업 전에 필요
- 문서 편집 영향 미리보기의 부분 제외 여부: 4단계 편집 저장 작업 전에 필요
```

을 삭제하고, `- 브라우저 지원과 프로젝트 백업: 관련 단계 시작 전 필요` 줄만 남긴다.

- [ ] **Step 7: `docs/product/02-prd.md`의 오픈 이슈 갱신**

`docs/product/02-prd.md:249-252`의 "## 오픈 이슈" 절

```markdown
## 오픈 이슈

- Agent가 생성한 설정 가이드의 명령어와 버전 정보를 어떻게 검증할지
- 문서 섹션 편집 영향 미리보기에서 항목별 제외를 허용할지
```

을 다음으로 교체한다.

```markdown
## 오픈 이슈

이전 오픈 이슈였던 설정 가이드 검증 방식과 편집 영향 미리보기 항목별 제외는 `DEC-040`, `DEC-041`로 확정됐다(`docs/product/10-decision-log.md`).
```

- [ ] **Step 8: 검증**

Run: `grep -rn "blocked" docs/delivery/traceability.md docs/delivery/development-pr-review-qa-workflow.md`
Expected: `DOC-004`, `DOC-007`, `DOC-PR-04`, `GDE-PR-01` 행에 더 이상 `blocked`가 없다. (`NFR-002` 등 다른 blocked 항목은 이번 범위가 아니므로 남아 있어도 된다.)

Run: `grep -n "DEC-040\|DEC-041" docs/product/10-decision-log.md docs/delivery/04-documents.md docs/delivery/05-sources-guides-export.md`
Expected: 세 파일 모두에서 매치된다(결정이 실제 구현 계약 문서에 연결됨).

Run: `npm run docs:check:mermaid`
Expected: 이번 작업에서 Mermaid 다이어그램을 건드리지 않았으므로 기존과 동일하게 통과한다.

- [ ] **Step 9: Commit**

```bash
git add docs/product/10-decision-log.md docs/delivery/04-documents.md docs/delivery/05-sources-guides-export.md docs/delivery/traceability.md docs/delivery/development-pr-review-qa-workflow.md docs/delivery/README.md docs/product/02-prd.md
git commit -m "docs: DOC-004/GDE-504 결정 반영하고 관련 PR 단위 blocked 상태 해소"
```

---

## 완료 정의

- [ ] Task 1~5의 모든 커밋이 완료됨
- [ ] `npm run build` 성공
- [ ] `npm run docs:check:mermaid` 성공
- [ ] `npx playwright install --with-deps chromium` 및 `npm run test:e2e:ci` 실행 결과 기록(성공 또는 "환경 제약으로 미실행"을 제한사항으로 명시, 성공으로 위장하지 않음)
- [ ] `git diff --check` 통과 (trailing whitespace 등 없음)
- [ ] 이 plan 문서를 링크하는 PR 생성, `docs/delivery/development-pr-review-qa-workflow.md`의 PR 본문 계약 형식 준수
- [ ] 독립 코드 리뷰 `pass`, QA `pass` 후 `ready_to_merge`에서 사용자 머지 대기
