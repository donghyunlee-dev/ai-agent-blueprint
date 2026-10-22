# UIR-PR-02C — Home pixel-parity correction

## Outcome

Rebuild the current home presentation against `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png` after the user reported that merged UIR-PR-02B still does not match the design. The user explicitly authorized the design's sample recent-project copy for the visible home cards. Preserve the existing authenticated create, attach, resume, retry, and project-limit behavior wherever the design controls correspond to those actions.

## Scope

- Home route shell, backdrop, header, sidebar, hero, idea composer, recent-project row, and start cards.
- Exact design copy, icon count/order, card count, colors, positions, sizes, and cropped visual assets from the supplied design reference.
- Deterministic visual comparison and focused browser coverage for existing home behavior and responsive layout.
- No project workspace routes, API, AI, authentication, or persistence schema changes.

## Reference and baseline

- Primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`, 1672×941.
- `docs/template/README.md` is for error, empty, loading, and other states absent from the new design.
- Baseline HEAD: merge commit `45649ab6dd46d2dbcea72919aadca760a6c0bee2`.
- Baseline at 1672×941: hero y=217; composer x=412/y=345/w=985/h=238; recent section y=607. The approximate reference composer is 171px high, recent section starts near y=570. The previous 4-row exception is not accepted for this correction.

## Acceptance

1. At 1672×941, a deterministic reference state passes a pixel-level match rate of at least 95%: percentage of pixels whose maximum per-channel RGB difference is ≤24, across the full viewport with no masked regions. The comparison method, source, output, and result are included in the artifact.
2. A separate visual inventory confirms all visible reference text, icon count/order, card count, colors, and major geometry. The score alone cannot satisfy these checks.
3. The 1440×900, 1280×800, 1024×768, 768×1024, and 390×844 captures remain legible and have no horizontal overflow, clipped controls, or lost functionality. Mobile may adapt layout where no mobile reference exists.
4. Existing real-user create/open, examples-without-autosubmit, attachment type/size/count, recent project states, retry, project limit, keyboard, focus, and 200% zoom behavior remain verified. The approved sample copy affects only visible home presentation; persistence remains based on existing project data.
5. Final-HEAD screenshots and comparison artifacts cover empty, recent, validation, attachment, create error/success, loading/error retry, and project-limit states.
6. Focused Playwright, relevant unit/contract tests, `npm run build`, and `git diff --check` pass. Independent code review and QA inspect the same final HEAD and reference comparison before `ready_to_merge`.

## Required visual evidence

- Reference/render pair, pixel-difference heatmap, overlay, full-page pixel match report, and text/icon/card inventory under `.pr-artifacts/UIR-PR-02C/`.
- Final HEAD, route/state, viewport, and screenshot artifact paths in the report.
- Do not use the full screenshot as a page background. Recreate the controls as real accessible UI and use only extracted visual assets needed to reproduce the reference backdrop/brand/avatar.

## Delivery state

- Predecessors verified: UIR-PR-02 (#35), UIR-PR-02A (#36), UIR-PR-02B (#37) merged to `main`.
- Current unit: `ready_to_merge`, PR #38 open and intentionally not merged.
- Final code HEAD: `65dd93e65566c496bede041c181e96d031bdb47c`.
- Final CI evidence: workflow run `39750688902`, 22/22 focused Playwright checks, 96.0078% unmasked pixel match at 1672×941, 0 transparent background pixels, inventories and report source hashes aligned.
- Independent code review and QA passed at the same code HEAD. QA used a deterministic session fixture; it verified dynamic email rendering, not a live Google OAuth session.
- Next UIR-PR-03 remains blocked until this correction is merged.
