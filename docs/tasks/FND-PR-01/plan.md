# FND-PR-01 — 런타임·화면 기반 정리

## 사용자/시스템 결과

앱이 React 18 기준으로 빌드되고, 신규 Blueprint 화면의 기본 구조와 시각 기준이 `docs/template/` 캡처 및 semantic HTML/CSS 계약으로 고정된다. 레거시 UI library 의존성과 import는 이 PR에서 함께 제거한다.

## 범위

- React 18 및 TypeScript 기반 확인
- `legacy external UI package` 의존성, import, 전역 stylesheet, Tailwind preset과 MCP 설정 제거
- 기존 prototype 화면을 앱 소유 semantic HTML/CSS로 전환하여 전체 build 유지
- `docs/template/README.md` reference map에 연결된 기본 app shell 샘플 구현
- 접근성, CSS custom property, responsive layout conventions 정리

제외: 완성된 대화·설계·문서 기능, 도메인 저장, 외부 UI library 도입, template screenshot을 제품 asset으로 사용하는 것.

## 연결 기준

- Delivery: `FND-001`, `FND-002`
- Product: [Architecture](../../product/06-architecture.md), [UI design](../../product/07-ui-design.md), [UI reference integration](../../product/09-ui-reference-integration.md)
- Screen: [UI reference index](../../template/README.md), [UI specifications](../../ui/README.md)
- Validation: `npm run build`, `npm run test:unit`, `git diff --check`

## 선행 조건

- Authentication contract is fixed; unrelated Google OAuth configuration is not changed.
- `.mcp.json` retains only MCP servers required by active product contracts.
- The reference image for the app shell and login state is identified in the task implementation report.

## Acceptance criteria

1. `package.json`, lockfile, Vite, Tailwind, and source contain no `legacy external UI package` dependency, alias, preset, or global stylesheet import.
2. `.mcp.json` has no legacy UI integration MCP entry.
3. `npm run build` succeeds and existing routes render without runtime component import errors.
4. The base shell follows the relevant template screenshot while preserving semantic landmarks, keyboard focus, and 1440×900/390×844 layouts.
5. No reference screenshot is imported into the application bundle or rendered as a background.
6. The PR includes current implementation screenshots and Playwright plus Agent Browser evidence for the changed visible flow.

## Validation matrix

| Scenario | Evidence |
| --- | --- |
| Fresh install dependency tree | `npm ls react react-dom` has one React 18 line and no `legacy external UI package` |
| Build and unit tests | Exact command and output in PR |
| Desktop shell | Playwright image at 1440×900 |
| Mobile shell | Playwright image at 390×844; no horizontal overflow |
| Keyboard flow | Agent Browser verifies focus, navigation, controls, and focus visibility |
| Design references | Report lists relevant `docs/template/` image filenames |

## Implementation sequence

1. Confirm the actual runtime files importing the legacy package and map current screen elements to semantic controls.
2. Add/update tests or smoke checks for retained route behavior before removing components.
3. Replace imports and global CSS with local React/HTML/CSS implementations; keep behavior and accessibility contracts.
4. Remove package, lockfile entry, Tailwind preset/source scan, MCP entry, and obsolete documentation together.
5. Build, run focused tests, and verify desktop/mobile behavior.
6. Attach current screenshots, submit the PR, then let independent code review and QA gates run through `$pr-development-loop`.

## Risks and handling

- Legacy UI components may hide existing layout or state behavior. Inventory props and render states before replacing each import.
- Removing a global stylesheet may expose latent app assumptions. Capture before/after and validate all current routes.
- If reference imagery conflicts with product behavior or accessibility, follow product behavior/accessibility and record the visual deviation.

## Done checklist

- [ ] Product, package, Tailwind, and MCP config contain no legacy external UI integration.
- [ ] Relevant reference image filenames are linked in the implementation evidence.
- [ ] Desktop, mobile, keyboard, Playwright, and Agent Browser checks pass.
- [ ] Build, targeted tests, and `git diff --check` pass.
- [ ] Independent code review and independent QA pass on final HEAD.
