# UIR-PR-03E validation results

## Final implementation HEAD

Implementation and final focused validation were completed at `28abb915162f7e1097382a399555a1513921e814`, based on `origin/main` `d34dead5f006fc1cb94857688a05f2bee81d863c`.

- Focused Playwright browser coverage on final source: **12/12 passed** across desktop Chromium (1440×900) and mobile Chromium (390×844), covering UIR-03E focus/gutters, UIR-03D focus/role choices, UIR-02E keyboard focus, and UIR-03C internal scrolling.
- `npm run build`: passed; Vite emitted the existing large-chunk advisory.
- `git show --check`: passed.
- Computed textarea styles in pointer, keyboard, invalid, and invalid+keyboard states: `outline: none`, `border: 0px none`, `box-shadow: none`. Composer frame remained unchanged. Keyboard focus background differs from the unfocused background; invalid+keyboard remains distinguishable.
- Desktop geometry: conversation left inset **25px** and content-end spacer **25px**; summary right/bottom padding **26/25px**; no horizontal overflow.
- Mobile geometry: no horizontal overflow. The conversation scroller has `scrollHeight=959`, `clientHeight=606`, can scroll to `scrollTop=353`, while `window.scrollY` remains `0`. Summary content follows below the initial viewport.

## Short desktop viewport correction

The PR's broad evidence workflow exposed that adding `padding-bottom:25px` directly to the conversation scroller makes the UIR-03D role-choice viewport check fail at 1024×768 (the last option remained at y=800.875, beyond the test's y<668 target). The same test passed on unchanged `origin/main`. Removing only the left padding did not change the failure; removing the scroller bottom padding restored the pass. The visible 25px end gap is now a flex spacer after the scroll content, leaving the scroller's viewport size intact.

After this correction, local Playwright checks passed **12/12** for UIR-03E gutters/focus, UIR-03D focus/role options, UIR-02E keyboard focus, and UIR-03C internal scrolling. The spacer keeps the measured desktop content-end gap at 25px. Independent code review and QA passed on `cde4ca24e0503f81785fa90134a64ce0d2f8285f`; see [review notes](review-notes.md) and [QA report](qa-report.md).

## Broader related-suite observations

The focused scope checks above pass. A broader conversation run also exposed a case outside this task's changed behavior:

- `prior answer edit`: the fixed composer intercepts the click on the answer-submit control and the test times out.
- full-canvas scroll: the fixture has equal `scrollHeight` and `clientHeight`, so it does not produce the expected scroll extent.

These were not changed because answer editing and conversation scroll ownership are excluded from UIR-PR-03E. They are recorded as follow-up findings, not as regressions established by this change.

## Pull request workflow checks

On initial PR head `e7695dd`, repository-wide visual evidence workflows failed on unrelated older assertions: home creation tests expected `/blueprints/{id}/design` while the current route is `/blueprints/{id}`; conversation evidence additionally hit the prior-answer edit failure and the 1024×768 role-choice viewport case described above. The role-choice case was corrected by replacing scroller bottom padding with a content-end spacer, and its focused regression check passes on corrected source HEAD `28abb915`. The stale home-route and prior-answer edit failures remain outside this scope. The initial GitHub CI run is attached to the older head; latest-head CI status is pending confirmation.

## Browser tooling

Agent Browser was absent from the enabled tool catalog and `command -v agent-browser` returned no executable. Playwright Chromium provided browser validation.
