# CON-PR-05 browser evidence

Playwright Chromium captures from the deterministic test session and mocked API fixtures. Desktop images are 1440×900 CSS pixels; mobile images are 390×844 CSS pixels. The route is the test project's `/blueprints/<projectId>` conversation route, followed by its Requirements and PRD routes. Google OAuth is not included.

The primary visual reference is [`회의실 예약 서비스 UI 캔버스.png`](../../../blueprint-design/회의실%20예약%20서비스%20UI%20캔버스.png). The images below record empty, contextual, recommendation, pending, approved, insufficient-context, mobile-summary, and PRD states. The screenshots are browser evidence, not product assets.

## Desktop — 1440×900

- [Empty decision summary](./desktop-chromium-empty-summary.png)
- [Contextual follow-up](./desktop-chromium-contextual-question.png)
- [Insufficient recommendation context](./desktop-chromium-insufficient-recommendation-context.png)
- [11 recommendation candidates](./desktop-chromium-recommendation-11.png)
- [Compacted source turn revealed](./desktop-chromium-compacted-source-revealed.png)
- [Missing source fallback](./desktop-chromium-missing-source-fallback.png)
- [Pending proposal](./desktop-chromium-pending-proposal.png)
- [Approved proposal and aggregate summary](./desktop-chromium-confirmed-summary.png)
- [PRD reviewable draft](./desktop-chromium-prd-review-required.png)

## Mobile — 390×844

- [Empty decision summary](./mobile-chromium-empty-summary.png)
- [Contextual follow-up](./mobile-chromium-contextual-question.png)
- [Insufficient recommendation context](./mobile-chromium-insufficient-recommendation-context.png)
- [11 recommendation candidates](./mobile-chromium-recommendation-11.png)
- [Compacted source turn revealed](./mobile-chromium-compacted-source-revealed.png)
- [Missing source fallback](./mobile-chromium-missing-source-fallback.png)
- [Pending proposal](./mobile-chromium-pending-proposal.png)
- [Approved proposal conversation](./mobile-chromium-confirmed-summary.png)
- [Decision summary dialog](./mobile-chromium-summary-open.png)
- [PRD reviewable draft](./mobile-chromium-prd-review-required.png)

## Comparison record

The rendered hierarchy retains the approved conversation canvas: stage navigation above a conversation-first workspace, contextual cards inside the conversation, a fixed composer, and a right-side aggregate summary on desktop. Recommendation cards now include source excerpts and an accessible action to move to the cited conversation turn. Mobile keeps the conversation first and opens the same summary in a keyboard-accessible dialog. The independent QA report will record matched source/render anchor measurements and any material exceptions against the reference.
