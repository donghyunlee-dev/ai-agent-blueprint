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

The rendered hierarchy retains the approved conversation canvas: stage navigation above a conversation-first workspace, contextual cards inside the conversation, a fixed composer, and a right-side aggregate summary on desktop. Recommendation cards now include source excerpts and an accessible action to move to the cited conversation turn. Mobile keeps the conversation first and opens the same summary in a keyboard-accessible dialog.

### Matched canvas layout comparison (content parity not established)

- Reference: [`회의실 예약 서비스 UI 캔버스.png`](../../../blueprint-design/회의실%20예약%20서비스%20UI%20캔버스.png)
- Render: [desktop-canvas contextual follow-up](./desktop-canvas-contextual-question.png)
- Route/state: `/blueprints/con-pr-05-conversation-flow`, contextual follow-up card
- CSS viewport: 1672×941 for both images; render uses deterministic API/session fixtures
- Coverage: this pair is a layout/anchor comparison only. The reference shows three confirmed bullets and three remaining decisions; the rendered contextual-follow-up fixture has an empty decision summary. It does not establish same-data summary content or visual parity. Populated summary states are captured separately in [desktop](./desktop-chromium-confirmed-summary.png) and [mobile](./mobile-chromium-confirmed-summary.png) evidence.
- Anchor measurements (approximate): left rail ends at x=249 in both; conversation stage begins at y=196 in both; summary is x=1338–1646 in the reference and x=1337–1646 in the render (-1px left, same right edge). Composer is x=278–1638 in the reference and x=305–1638 in the render (+27px left, -27px width; 2.0% of reference width), with the same 34px right margin. Its bottom is approximately 36px from the render viewport edge versus 11px in the reference (25px vertical offset, 2.7% of viewport height).
- Exception: the 27px composer left/width difference follows the current conversation panel's 26px inner gutter. The composer still spans beneath the summary column and the measured horizontal/vertical deltas stay below the repository's 5% position and 10% size thresholds.
- Evidence source SHA: application code `caf2e01ce23052dc4f10016746e1fef415ba9eb4`. These measurements do not substitute for the separate behavior and populated-summary screenshots.
