# UIR-PR-03E validation results

## Initial home composer and gutter implementation

The initial home focus change merged in PR #57 (merge commit `a74946ce825001c5bcc815e2a51dc392fe21ddce`). The short-viewport correction was cherry-picked onto latest `origin/main` `7e805ef398e3ddf21262234b18ead793eaaf778a` as `019604a`. This baseline follow-up was independently reviewed and QA-validated at exact HEAD `33488142712e90d2c44f59cff492385b4926f27f`.

- Focused Playwright browser coverage on final source: **12/12 passed** across desktop Chromium (1440×900) and mobile Chromium (390×844), covering UIR-03E focus/gutters, UIR-03D focus/role choices, UIR-02E keyboard focus, and UIR-03C internal scrolling.
- `npm run build`: passed; Vite emitted the existing large-chunk advisory.
- `git show --check`: passed.
- Computed textarea styles in pointer, keyboard, invalid, and invalid+keyboard states: `outline: none`, `border: 0px none`, `box-shadow: none`. Composer frame remained unchanged. Keyboard focus background differs from the unfocused background; invalid+keyboard remains distinguishable.
- Desktop geometry: conversation left inset **25px** and content-end spacer **25px**; summary right/bottom padding **26/25px**; no horizontal overflow.
- Mobile geometry: no horizontal overflow. The conversation scroller has `scrollHeight=959`, `clientHeight=606`, can scroll to `scrollTop=353`, while `window.scrollY` remains `0`. Summary content follows below the initial viewport.

## Conversation composer focus and responsive summary follow-up

- Exact source HEAD: `f40ab7ec98e2607d8f261fd9fbd59148955fe288`, based on latest `origin/main` `7e805ef398e3ddf21262234b18ead793eaaf778a`.
- Root cause: the conversation `AiTurnComposer` textarea inherited the global 3px `:focus-visible` outline. The earlier home-only selector did not cover `#ai-turn-draft`. The mobile summary icon rules were also limited to `min-width:1024px`, producing a 332px black SVG when focus scrolling exposed the summary.
- Fix: scope ring removal and background cue to the conversation textarea while preserving its neutral pill border; make the existing 26px icon container and 15px outlined SVG styles apply at mobile widths.
- Focused Playwright: **6/6 passed** at desktop and mobile; independent READY Preview suite: **30/30 passed** at the exact source HEAD. `npm run build` and `git diff --check` passed with the existing Vite large-chunk advisory.
- At 1440×900 and 390×844, pointer and real Tab/Shift+Tab focus have no outline or shadow, the neutral 1px border is unchanged, and the `:focus-visible` background cue is present. In Chromium, pointer focus also matches `:focus-visible`.
- At 390×844 the confirmed summary icon measures 26×26px; its 15×15px SVG has `fill:none`, visible white 2.2px stroke, and opacity 1. Focus scrolling moves `.conversation-stage-layout` internally by 351px while `window.scrollY` remains 0.
- Exact-source screenshots and JSON measurements are in [the evidence directory](../../delivery/evidence/UIR-PR-03E/README.md).

## Short desktop viewport correction

The PR's broad evidence workflow exposed that adding `padding-bottom:25px` directly to the conversation scroller makes the UIR-03D role-choice viewport check fail at 1024×768 (the last option remained at y=800.875, beyond the test's y<668 target). The same test passed on unchanged `origin/main`. Removing only the left padding did not change the failure; removing the scroller bottom padding restored the pass. The visible 25px end gap is now a flex spacer after the scroll content, leaving the scroller's viewport size intact.

After this correction, local Playwright checks passed **12/12** for UIR-03E gutters/focus, UIR-03D focus/role options, UIR-02E keyboard focus, and UIR-03C internal scrolling. The final independent latest-main QA then passed **28/28** across desktop and mobile for UIR-03E, UIR-03D, UIR-02E, and UIR-03C at exact HEAD `33488142712e90d2c44f59cff492385b4926f27f`. The spacer keeps the measured desktop content-end gap at 25px and preserves role-choice reachability at 1024×768. The independent latest-main review passed with no findings.

## Broader related-suite observations

The focused scope checks above pass. A broader conversation run also exposed a case outside this task's changed behavior:

- `prior answer edit`: the fixed composer intercepts the click on the answer-submit control and the test times out.
- full-canvas scroll: the fixture has equal `scrollHeight` and `clientHeight`, so it does not produce the expected scroll extent.

These were not changed because answer editing and conversation scroll ownership are excluded from UIR-PR-03E. They are recorded as follow-up findings, not as regressions established by this change.

## Pull request workflow checks

On PR #59 head `f40ab7e`, the `Capture home UI states` required check fails four desktop/mobile cases because the existing UIR-02C test expects `/blueprints/{id}/design` while the current route is `/blueprints/{id}`. Conversation evidence, proposal evidence, AI golden eval, and Vercel checks pass. This route assertion predates and is unrelated to UIR-PR-03E; it remains a merge gate blocker and was not changed in this task.

## Browser tooling

Agent Browser was absent from the enabled tool catalog and `command -v agent-browser` returned no executable. Playwright Chromium provided browser validation.
