# FND-PR-01 — 런타임·화면 기반 정리

## 상태

**IN_PROGRESS** — implementation is complete and self-validation passed; independent review and QA are running.

## 사용자/시스템 결과

앱이 React 18.3.1 기준으로 계속 빌드되고, 로그인 화면과 임시 보호 `/` shell이 `@sfood/ui` 없이 Blueprint 소유 semantic HTML/CSS로 렌더링된다. 후속 UI 구현이 재사용할 app shell과 접근성·반응형 규약을 정한다. 제품 결정 DEC-018에 따라 리빌드 이전 `/survey`, `/prd` prototype 경로는 공통 404로 처리하며, 기존 prototype 기능을 새 화면으로 옮기지 않는다.

## 요구사항·결정 추적

- Delivery: `FND-001` 런타임 고정, `FND-002` UI reference 및 semantic HTML/CSS 계약
- Architecture: `docs/product/06-architecture.md` — React 18.3.1, 계층 경계, source structure, current routes and DEC-018 legacy route behavior
- UI contracts: `docs/product/07-ui-design.md`, `docs/product/09-ui-reference-integration.md`
- References: `docs/template/README.md`; login behavior/layout uses `docs/ui/screens/00-login-and-session.md`
- Accessibility: `NFR-001`; required desktop/mobile evidence follows `AGENTS.md` and delivery workflow.
- Prerequisite: AUTH-PR-01, AUTH-PR-02, AUTH-PR-03 are merged; PR #6 merged at the base commit `e89122036596b7dc516d54ce088e24a7984affd8`.

## 근거가 된 현재 저장소 상태

- `package.json` and lockfile already pin React and ReactDOM to `18.3.1`; this PR retains those versions and does not upgrade the runtime.
- `@sfood/ui` is still in `package.json`; imports remain in `src/main.tsx`, `src/pages/HomePage.tsx`, `src/pages/SurveyPage.tsx`, `src/pages/PrdPage.tsx`, and `src/components/survey/{BlueprintSidebar,ResultPanel,SurveyHeader}.tsx`.
- `tailwind.config.js` imports `@sfood/ui/tailwind.config.js` and scans its package distribution; `src/main.tsx` imports `@sfood/ui/global.css`.
- `.mcp.json` contains `ax-auth` at `https://ax-auth.s-food.ai/mcp`. No current product contract references this service; Google authentication is implemented through the app's `/api/auth/*` routes. Treat this as obsolete integration configuration and remove it in this migration.
- Current router still mounts legacy `SurveyPage` at `/survey` and `PrdPage` at `/prd`, although DEC-018 says both prior routes return the common 404 without redirect. This PR must align the router with that decision and remove the obsolete screens/imports instead of preserving their prototype flows.

## 범위

### 포함

- Remove `@sfood/ui` from package manifest and lockfile, all source imports, global stylesheet imports, Tailwind preset, and package-specific Tailwind content paths.
- Replace the imported controls used by the current pages/components with minimal Blueprint-owned semantic HTML and local CSS, preserving existing route behavior and user actions.
- Keep React/ReactDOM at `18.3.1`, current Vite/TypeScript setup, and the existing route/provider structure.
- Remove the obsolete `ax-auth` `.mcp.json` server entry; do not add a replacement MCP or UI framework.
- Establish only the shared app-shell, Button/FormField/Alert patterns, CSS custom-property conventions, visible focus, and responsive behavior required by current screens.
- Keep `/login` public and `/` protected by the existing `ProtectedRoute`; `/survey` and `/prd` resolve to the common 404 without redirect, as required by DEC-018. The root is a temporary authenticated shell until project-home work lands in a later PR.
- Remove obsolete survey/PRD prototype screens and components that are no longer reachable under the product route contract; do not recreate their functionality.
- Record relevant template references and semantic control mappings in the implementation evidence.

### 제외

- React, ReactDOM, Vite, TypeScript, Tailwind or Playwright version upgrades.
- New project repository, IndexedDB, domain state, AI calls, or completed Blueprint workspace features.
- Product-wide redesign or rewriting retired prototype page flows; new project-home and workspace functionality.
- New component library, external design system, MCP integration, or using screenshot images as app assets/backgrounds.

## Definition of Ready

- Latest main is `e89122036596b7dc516d54ce088e24a7984affd8`; AUTH-PR-03 PR #6 is merged.
- FND-001/FND-002 and their source documents define React 18.3.1 plus Blueprint-owned semantic HTML/CSS as the target; DEC-018 unambiguously retires `/survey` and `/prd` as 404 routes.
- Legacy package imports and Tailwind/global stylesheet coupling are enumerated above; the package is used only by the current UI files in this scope.
- Test/build/browser scripts exist in `package.json`; `.mcp.json` has no active product-contract dependency on `ax-auth`.
- Visual evidence sources are identified: `docs/template/image (17).png` for the project start/home hierarchy; `image (16).png` for the workspace/conversation shell; `docs/ui/screens/00-login-and-session.md` for the login screen's wireframe, copy, states, and interaction. The template reference set has no login screenshot, so the screen specification is the authoritative login visual source.
- No product behavior or technology decision remains unresolved.

## Acceptance criteria

1. React and ReactDOM remain at version `18.3.1`, with one dependency line for each.
2. `@sfood/ui` is absent from `package.json`, lockfile, source imports, Vite aliases, Tailwind preset/content configuration, and built output.
3. No external design-system global stylesheet is imported; `.mcp.json` contains no obsolete `ax-auth` integration, and no replacement UI MCP is added.
4. `/login` remains public and `/` remains protected; both render without missing component imports. `/survey` and `/prd` return the common 404 without redirect, matching DEC-018; retired prototype actions are not migrated.
5. Current UI controls use appropriate semantic elements, accessible labels/descriptions, visible keyboard focus, and Blueprint-owned local CSS/custom properties.
6. `/`, `/login`, `/survey`, and `/prd` have no horizontal overflow at 1440×900 and 390×844; no product reference screenshot is included in the app bundle or rendered as UI.
7. PR evidence lists reference filenames and semantic mappings, and includes final-HEAD Playwright screenshots at both required viewport sizes. Verify changed loading/error states as applicable.

## 구현 순서

1. Confirm imports and route behavior against DEC-018; map current login controls and temporary `/` shell elements to semantic controls.
2. Add/update smoke coverage for `/`, `/login`, and the `/survey`/`/prd` 404 behavior before removing legacy screen imports.
3. Remove the retired survey/PRD route elements and obsolete prototype screens/components; preserve the auth provider and protected root shell.
4. Replace remaining `@sfood/ui` controls/global styling in the in-scope login/root surfaces with local semantic markup and CSS.
5. Remove `@sfood/ui` from manifest/lockfile, Tailwind preset/source scan and all imports; remove the obsolete `ax-auth` MCP configuration.
6. Build, run unit and browser tests, inspect the dependency tree and scan tracked source/config for remaining package references.
7. Verify desktop/mobile routes and keyboard focus. Capture `/` and `/login` on final HEAD and attach evidence to the PR.

## Validation matrix

| Scenario | Command/evidence | Pass condition |
| --- | --- | --- |
| Dependency tree | `npm ls react react-dom` | One React 18.3.1 and ReactDOM 18.3.1 line; no `@sfood/ui` |
| Package/config/source cleanup | focused `rg` over `package.json`, lockfile, `src`, Vite/Tailwind and `.mcp.json` | No `@sfood/ui`, its preset/global CSS paths, or obsolete `ax-auth` config |
| Build | `npm run build` | Typecheck and Vite production build succeed |
| Unit/contract regression | `npm run test:unit` | All current tests pass |
| Browser smoke | `npm run test:e2e` | `/` is protected, `/login` is public, `/survey` and `/prd` return the common 404 with no redirect; no console/page errors |
| Desktop visual | Playwright Chromium 1440×900 | Temporary protected shell and login hierarchy render without overflow |
| Mobile visual | Playwright Chromium 390×844 | Shell/login controls fit, no horizontal overflow, primary login action remains usable |
| Keyboard | Playwright Chromium; Agent Browser too if available | Tab/Enter/Space operation and visible focus for changed controls |
| Reference/source mapping | implementation evidence | Names `image (17).png`, `image (16).png`, and login wireframe source; no template image shipped as product asset |
| Patch hygiene | `git diff --check` | No whitespace errors |

## 자체 검증 결과

- `npm run build`: passed.
- `npm run test:unit`: 76/76 passed.
- `npm run test:e2e -- --workers=2`: 34/34 passed across desktop and mobile Chromium on implementation HEAD `e342d8de6dbed3508f00d430f5cf7b6bf6946c41`.
- `npm ls --depth=0 react react-dom`: React and ReactDOM remain at 18.3.1.
- `git diff --check`: passed; package/source/config scan found no `@sfood/ui` coupling or `ax-auth` entry.
- Agent Browser was absent from the tool catalog and no executable was available; Playwright Chromium covered the same changed routes and keyboard/viewport checks.
- Final screenshots: [evidence README](../../delivery/evidence/FND-PR-01/README.md), with `/`, `/login`, and shared 404 at 1440×900 and 390×844.
- Regression correction: loading the existing PRD session cleanup listener from app bootstrap preserves logout cleanup after retiring the old PRD page; the logout storage regression test passed.
- Live Google sign-in was not tested; browser runs use deterministic mocked sessions.
- Independent code review: `pass` on final evidence HEAD `3f4c4db57aa363534891b7c7ef01fd9f7382b060`; all P2 findings (brand spelling and stale/missing captures) were corrected and re-reviewed.
- Independent QA: `pass` on implementation HEAD `3f4c4db57aa363534891b7c7ef01fd9f7382b060`; see `qa-report.md`.

Agent Browser is preferred when available. If absent, record tool-catalog and executable checks and complete the same interaction/viewport QA in Playwright Chromium; its absence alone does not block QA.

## Risks and handling

- Removing the shared global stylesheet may reveal hidden visual assumptions. Replace only styles needed by current surfaces and verify all listed routes.
- Legacy controls may carry implicit semantics or pending/disabled behavior. Inventory each usage before replacing it and preserve keyboard/action behavior.
- DEC-018 conflicts with the current router's old `/survey` and `/prd` routes; the product decision is authoritative. Retire these prototype screens and test 404 behavior rather than carrying the old flows forward.
- The login screen has no dedicated `docs/template/` bitmap. Follow the exact layout, copy, state and focus contract in `docs/ui/screens/00-login-and-session.md`; use the template index only for applicable broader shell patterns.
- `.mcp.json`'s `ax-auth` endpoint has no active product-contract reference and is obsolete after the app-owned OIDC implementation; if implementation discovers a current required consumer, stop and report the exact reference rather than silently retaining or replacing it.

## Done checklist

- [ ] FND-001/FND-002 acceptance criteria verified.
- [ ] React 18.3.1, package cleanup, local CSS, and MCP cleanup verified.
- [ ] Build, unit tests, browser smoke, keyboard, desktop/mobile checks pass.
- [ ] Final-HEAD evidence identifies references and screenshots.
- [ ] Independent code review and independent QA pass.
