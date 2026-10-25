# UIR-PR-03E visual evidence

## Capture details

- Source commit before short-viewport correction: `8d88a6d79cd9ef09a77e695e1c98dd0aa44e3f6e`; current evidence is regenerated after replacing scroller bottom padding with an end spacer. Both are based on `d34dead5f006fc1cb94857688a05f2bee81d863c`.
- Routes/fixtures: home with deterministic UIR-03E fixture; `/blueprints/uir-pr-03e-meeting-room` with deterministic meeting-room aggregate.
- Browser: Playwright Chromium. The reference PNGs are 1672×941; comparison uses their top-left 1440×900 viewport crop without stretching. The remaining right/bottom design canvas is outside the target viewport.
- The design references do not depict focused or invalid focus states. The template focus screenshots are used for those states; those captures are checked for state behavior, not design parity.

## Home, 1440×900

Primary reference: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; focus-state fallback: `docs/template/image (17).png`. Route: home; deterministic idea input fixture.

| Anchor | Reference crop | Render | Delta |
| --- | ---: | ---: | ---: |
| Sidebar boundary x | 249px | 249px | 0px / 0% viewport width |
| Composer x | 413px | 352.5px | -60.5px / -4.2% viewport width |
| Composer y | 345px | 320.7px | -24.3px / -2.7% viewport height |
| Composer width | 984px | 985px | +1px / +0.1% reference width |
| Composer height | 171px | 171px | 0px / 0% reference height |

Composer bounds and outer border remain unchanged across focus states. The focused capture shows background-only focus with no outline, border, or shadow.

- Default: [desktop](home-default-1440x900.png), [mobile](home-default-390x844.png)
- Keyboard focus: [desktop](home-keyboard-1440x900.png), [mobile](home-keyboard-390x844.png)
- Invalid + keyboard focus: [desktop](home-invalid-keyboard-1440x900.png), [mobile](home-invalid-keyboard-390x844.png)
- Measurements: [desktop JSON](measurements-1440x900.json), [mobile JSON](measurements-390x844.json)

The composer x-position differs by 4.2% of viewport width, below the 5% material-difference threshold. It is an existing home layout position and was not changed by this task; the composer width/height and sidebar anchor align within the documented thresholds.

## Conversation, 1440×900

Primary reference: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; in-progress fallback: `docs/template/image (15).png` and `docs/template/image (16).png`. Route: `/blueprints/uir-pr-03e-meeting-room`; fixture: deterministic meeting-room aggregate.

- Stage layout: x=249, y=196, width=1191, height=704.
- Composer: x=279, y=811, width=783, height=78.
- Conversation insets: left=25px, content-end spacer=25px. Summary insets: right=26px, bottom=25px.
- No horizontal overflow.
- Render captures: [desktop](conversation-summary-1440x900.png), [mobile](conversation-summary-390x844.png).

The reference stage and conversation layout uses a wider canvas and shows a full-width composer dock. This PR preserves the existing fixed composer bounds as required by scope; it does not change composer placement or answer behavior. The measured panel gutters and the top-level title/stage/main/summary anchors are aligned to the implemented layout.

At 390×844 the summary follows below the initial viewport by responsive layout; the conversation itself scrolls internally and leaves `window.scrollY` at 0. No mapped mobile design reference exists.
