# UIR-PR-03G test results

## Self-validation

- Before the CSS fix, the new desktop browser assertion reproduced the defect: the conversation card had `0px` left inset instead of `26px`; the existing mobile layout passed.
- After the CSS fix, `npx playwright test tests/e2e/uir-pr-03e-focus-and-gutters.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1` passed **6/6**.
- The focused browser case checks 1440×900 outer card gutters and composer bounds, 1024×768 transition overflow/composer containment, and 390×844 stacked layout and 10px inset.
- `npm run build` passed. Vite emitted its existing large-chunk advisory.
- `git diff --check` passed.
- `PUPPETEER_EXECUTABLE_PATH=/home/donghyunlee/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell npm run docs:check:mermaid` passed: **44/44**. The default Puppeteer browser cache was incomplete, so the installed Playwright Chromium shell was selected explicitly.

## Measurements

At 1440×900, the Playwright fixture measured the stage at `(249,196)`, size `1191×704`; the conversation card at `(275,196)`, size `817×678`; the summary card at `(1105,196)`, size `309×678`; and the composer at `(305,786)`, size `757×78`. This gives 26px left and bottom outer gaps, with the composer 30px inside the conversation card on each horizontal side and 10px above its bottom edge. Horizontal overflow was false.

At 390×844, the existing 10px layout inset and stacked summary behavior remain; horizontal overflow was false.

Final source-render SHA: `f8d78c2bb2440cce7c51391ec489c19b40f6ae8d`. The Playwright rerun after this commit passed 6/6 and regenerated the desktop/mobile captures and measurements at that exact SHA. See [the UI evidence README](../../delivery/evidence/UIR-PR-03G/README.md).

The independent reviewer, QA reviewer, and required GitHub checks have not yet run for this PR unit.
