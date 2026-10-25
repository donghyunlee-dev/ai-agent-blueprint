# UIR-PR-03E visual evidence

## Capture details

- Follow-up source commit: `019604a` on latest `origin/main` `7e805ef398e3ddf21262234b18ead793eaaf778a`; screenshots and measurements were regenerated at branch HEAD `9bb1aba`.
- Routes/fixtures: home with deterministic UIR-03E fixture; `/blueprints/uir-pr-03e-meeting-room` with deterministic meeting-room aggregate.
- Browser: Playwright Chromium. The reference PNGs are 1672×941. For 1440×900 comparisons, fit proportionally to viewport width (`scale=0.8612`) and center vertically (`y offset=44.8px`); do not stretch. At mobile width, no mapped mobile reference exists.
- The design references do not depict focused or invalid focus states. The template focus screenshots are used for those states; those captures are checked for state behavior, not design parity.

Reference coordinates below are measured on the source canvas, then mapped by that transform. Render coordinates come from the final-source Playwright measurements and screenshot.

## Home, 1440×900

Primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; focus-state fallback: `docs/template/image (17).png`. Route: home; deterministic idea input fixture.

| Anchor | Reference crop | Render | Delta |
| --- | ---: | ---: | ---: |
| Sidebar boundary x | 249px (mapped 214.4px) | 249px | +34.6px / +2.4% viewport width |
| Composer x | 413px (mapped 355.7px) | 352.5px | -3.2px / -0.2% viewport width |
| Composer y | 345px (mapped 341.9px) | 320.7px | -21.2px / -2.4% viewport height |
| Composer width | 984px (mapped 847.5px) | 985px | +137.5px / +16.2% mapped reference width |
| Composer height | 171px (mapped 147.3px) | 171px | +23.7px / +16.1% mapped reference height |

Composer bounds and outer border remain unchanged across focus states. The focused capture shows background-only focus with no outline, border, or shadow.

- Default: [desktop](home-default-1440x900.png), [mobile](home-default-390x844.png)
- Keyboard focus: [desktop](home-keyboard-1440x900.png), [mobile](home-keyboard-390x844.png)
- Invalid + keyboard focus: [desktop](home-invalid-keyboard-1440x900.png), [mobile](home-invalid-keyboard-390x844.png)
- Measurements: [desktop JSON](measurements-1440x900.json), [mobile JSON](measurements-390x844.json)

The composer x/y positions and sidebar boundary are within the 5% location threshold. **Explicit scope exception:** the home composer is 16% wider/taller than the proportionally mapped reference, but its actual pixel dimensions match the native 1672×941 design; this PR preserves the existing composer frame as required and does not change its dimensions.

## Conversation, 1440×900

Primary reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; in-progress fallback: `docs/template/image (15).png` and `docs/template/image (16).png`. Route: `/blueprints/uir-pr-03e-meeting-room`; fixture: deterministic meeting-room aggregate.

- Stage layout (including summary): reference x=249, y=196, width≈1396, height≈745; mapped x=214.4, y=213.6, width≈1202, height≈642. Render x=249, y=196, width=1191, height=704. Delta: x +34.6px (+2.4% viewport), y -17.6px (-2.0%), width -11px (-0.9% reference width), height +62px (+9.7% reference height).
- Summary panel: reference x≈1338, y=196, width≈307, height≈745; mapped x≈1152.3, y=213.6, width≈264, height≈642. Render x≈1105, y=196, width≈309, height=704. Delta: x -47.3px (-3.3% viewport), y -17.6px (-2.0%), width +45px (+17.0% reference width), height +62px (+9.7%). Its implemented 26px right and 25px bottom content insets meet the requested gutter contract.
- Composer: reference x≈279, y≈852, width≈1359, height≈78; mapped x≈240.3, y≈778.6, width≈1170, height≈67.2. Render x=279, y=811, width=783, height=78. Delta: x +38.7px (+2.7% viewport), y +32.4px (+3.6%), width -387px (-33.1% reference width), height +10.8px (+16.1%).
- Conversation insets: left=25px, content-end spacer=25px. Computed scroller bottom padding includes the pre-existing fixed-composer clearance. Summary insets: right=26px, bottom=25px.
- No horizontal overflow.
- Render captures: [desktop](conversation-summary-1440x900.png), [mobile](conversation-summary-390x844.png).

**Explicit scope exception:** the reference shows a full-width composer dock, while the existing application pins it inside the narrower conversation panel. Changing its width would alter the composer frame/placement explicitly excluded by UIR-PR-03E, so this PR preserves that existing behavior. The summary width difference also reflects its existing fixed-width panel at this viewport. These differences are visible and measured; neither is introduced by the gutter/focus changes. The changed gutters and focus states are verified independently.

At 390×844 the summary follows below the initial viewport by responsive layout; the conversation itself scrolls internally and leaves `window.scrollY` at 0. No mapped mobile design reference exists.
