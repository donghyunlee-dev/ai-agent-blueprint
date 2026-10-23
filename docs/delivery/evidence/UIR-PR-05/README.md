# UIR-PR-05 visual evidence

These screenshots were captured from implementation commit `02c61278ade6fd0b725dee6a4175e689cfd162be`, based on `0e27da5f5ccd4289309ac348e5340959e7f2a5b5`, using Playwright Chromium at the listed CSS viewport sizes. The design route is `/blueprints/uir-pr-05-project/design`; fixtures are seeded in the browser's IndexedDB. The later mobile semantics correction changes no pixels in the captured default design states.

Selected-group blocker captures below use UI HEAD `707b85ca517d36e3ac4e74a643594db29b451dab`; the screenshot-only E2E capture change was uncommitted. The fixture is synthetic: `회의실 예약` is confirmed and the non-first child `예약 충돌 처리` is proposed. Each image shows its blocker reason beside the owning section after the related item receives focus.

## Captures

| State | CSS viewport | Capture |
|---|---:|---|
| Insufficient, desktop | 1440×900 | [insufficient-desktop-1440x900.png](./insufficient-desktop-1440x900.png) |
| Insufficient, mobile | 390×844 | [insufficient-mobile-390x844.png](./insufficient-mobile-390x844.png) |
| Insufficient, exact reference viewport | 1586×992 | [design-reference-render-1586x992.png](./design-reference-render-1586x992.png) |
| Workable | 1440×900 | [workable-desktop-1440x900.png](./workable-desktop-1440x900.png) |
| Ready | 1440×900 | [ready-desktop-1440x900.png](./ready-desktop-1440x900.png) |
| Conflict | 1440×900 | [conflict-desktop-1440x900.png](./conflict-desktop-1440x900.png) |
| Selected group blocker, desktop | 1440×900 | [selected-group-blocker-desktop-1440x900.png](./selected-group-blocker-desktop-1440x900.png) |
| Selected group blocker, mobile | 390×844 | [selected-group-blocker-mobile-390x844.png](./selected-group-blocker-mobile-390x844.png) |

The mobile PNGs are 1024×2216 physical pixels because the Playwright mobile project uses device scale factor; their CSS viewport is 390×844.

## Reference comparison

Primary reference: [`회의실 예약 서비스 설계 준비 대시보드.png`](../../../blueprint-design/회의실%20예약%20서비스%20설계%20준비%20대시보드.png), source dimensions 1586×992. The exact 1586×992 browser capture above uses the same CSS viewport.

| Anchor | Reference | Render | Delta (render − reference) |
|---|---:|---:|---:|
| Main workspace top | y≈194 | y=196 | ≈+2 px |
| Five-card grid top | y≈462 | y=454 | ≈−8 px |
| Five-card grid left | x≈284 | x=278 | ≈−6 px |
| Five-card grid width | w≈1271 | w=1280 | ≈+9 px |
| Five-card grid height | h≈425 | h=292 | ≈−133 px |

The source layout contract is in [`docs/ui/01-workspace-shell.md`](../../../ui/01-workspace-shell.md): the selected stage owns the main workspace, secondary content is stage-specific, and desktop does not force three panels to remain open. [`docs/ui/03-design-board-and-inspector.md`](../../../ui/03-design-board-and-inspector.md) limits the design inspector to a selected item's detail. Therefore the 280 px right column is not a required default design-stage reservation. The implementation now hides it until an item or the explicit detail control opens it; selecting an item still opens its inspector. At the exact reference viewport, the main stage is 1337 px wide, with 24 px horizontal padding on each side, allowing a 1280 px readiness grid. Its width is within 9 px of the reference grid. The grid top is 8 px above the source anchor and within the 49 px threshold (5% of source height). Card height remains 133 px shorter because the app cards contain compact status and area summaries rather than the longer descriptive copy in the illustration.

The exact-reference capture shows all five cards in the first viewport. At 1440×900, the E2E assertion also requires the last card to be fully in view. Moving `SourceDocuments` below the design board and removing redundant vertical chrome recovered first-viewport visibility. Its existing upload, save, and notification behavior passed the regression flow. Requirements keeps the original SourceDocuments-before-document order.

Screenshot verification checks are encoded in `tests/e2e/uir-pr-05-design-readiness.spec.ts`: full visibility and anchor thresholds at 1440×900 and 1586×992, one-column cards and no horizontal overflow at 390×844, and the attachment/save notification flow.
