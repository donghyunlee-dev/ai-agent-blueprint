# UIR-PR-03E independent QA

- Result: **PASS** on exact HEAD `8d88a6d79cd9ef09a77e695e1c98dd0aa44e3f6e`.
- Playwright Chromium coverage: UIR-03E **4/4**, UIR-02E keyboard focus **2/2**, UIR-03C internal conversation scrolling **2/2**, and UIR-03D textarea focus **2/2**.
- At 1440×900 and 390×844, computed textarea outline, border, and shadow are absent; the outer composer frame remains intact. Desktop conversation left/bottom insets are **25/25px**, summary right/bottom insets **26/25px**. Mobile has no horizontal overflow and conversation scrolling does not move the window.
- Final screenshots and measurements: [evidence README](../../delivery/evidence/UIR-PR-03E/README.md).
- Agent Browser was unavailable in the tool catalog and PATH; Playwright Chromium covered the browser path.
- Reference comparison: primary home and conversation screenshots were inspected, with template screenshots for focus/in-progress states absent from the new designs. Detailed anchors and the viewport mapping are in the evidence README.
- Limit: the blue background cue appears for pointer-focused textareas in Chromium as well as keyboard-focused textareas; neither state has a ring. The visual focus cue remains background-only.

## Latest-main follow-up QA

The latest-main follow-up passed independent QA on exact HEAD `33488142712e90d2c44f59cff492385b4926f27f`, based on `7e805ef398e3ddf21262234b18ead793eaaf778a`.

- Playwright Chromium: **28/28 passed** across desktop and mobile for UIR-03E focus/gutters, UIR-03D question choices, UIR-02E home focus, and UIR-03C conversation scrolling.
- The textarea has no outline, border, or box-shadow in focus; the composer frame remains intact. Desktop gutters are 25px on conversation left/content end and 26/25px on summary right/bottom. Mobile conversation scrolling stays internal without horizontal overflow.
- The 1024×768 role-choice viewport remains reachable after replacing scroller bottom padding with a 25px end spacer.
- The Playwright webServer build passed with the existing Vite large-chunk advisory. Agent Browser was unavailable in the tool catalog and PATH; Playwright Chromium covered the browser flow.
- The anchor comparison and preserved composer-size exception are documented in the evidence README. Fresh screenshots and measurements are attached at this exact HEAD.
