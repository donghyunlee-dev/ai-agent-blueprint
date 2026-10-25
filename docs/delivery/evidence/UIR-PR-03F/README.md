# UIR-PR-03F visual evidence

## Capture details

- Source-render SHA: `d18b640a27622317dd2512a05714ec050c8e7a51` (based on `1f62a20`). Screenshots, measurements, and the focused Playwright run use this source SHA. Routes: `/` and `/blueprints/uir-pr-03e-meeting-room` with the existing deterministic UIR-PR-03E meeting-room fixture. Later evidence/tracker commits are documentation-only and do not change the rendered code.
- Viewports: 1440×900 and 390×844. Browser: Playwright Chromium. Browser-test JSON records the exact source-render SHA, computed styles, and layout measurements.
- Home primary: `docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png`; state fallback: `docs/template/image (17).png`. Conversation primary: `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`; state fallbacks: `docs/template/image (15).png` and `docs/template/image (16).png`.
- The mapped references do not show focus or invalid states. Compare the default layout to the primary image; use template captures only to understand input placement and surrounding state. Focused captures verify behavior and surface consistency, not pixel parity.

## Home

The input stays transparent against its existing white composer surface for default, pointer, keyboard, and invalid+keyboard states. Invalid input retains its existing pale red validation surface. The outer composer frame remains at x=352.5, y=320.7, width=985px and height=171px in the default 1440×900 state. Invalid-state helper copy increases its height as before.

- Default: [desktop](home-default-1440x900.png), [mobile](home-default-390x844.png)
- Pointer focus: [desktop](home-pointer-1440x900.png), [mobile](home-pointer-390x844.png)
- Keyboard focus: [desktop](home-keyboard-1440x900.png), [mobile](home-keyboard-390x844.png)
- Invalid: [desktop](home-invalid-1440x900.png), [mobile](home-invalid-390x844.png)
- Invalid + pointer focus: [desktop](home-invalid-pointer-1440x900.png), [mobile](home-invalid-pointer-390x844.png)
- Invalid + keyboard focus: [desktop](home-invalid-keyboard-1440x900.png), [mobile](home-invalid-keyboard-390x844.png)
- Geometry and computed styles: [desktop JSON](home-measurements-1440x900.json), [mobile JSON](home-measurements-390x844.json)

At 1440×900, the primary reference is 1672×941 and is scaled proportionally by 0.8612, centered with a 44.8px vertical offset, matching the prior UIR-PR-03E comparison. The sidebar boundary, composer x-position, and composer y-position deltas remain +34.6px (+2.4% viewport width), −3.2px (−0.2%), and −21.2px (−2.4%), respectively. Composer width/height remain 985×171px; their mapped-reference deltas exceed 10% because this PR preserves the existing native-sized frame. No mobile primary reference is mapped.

## Conversation

`#ai-turn-draft` preserves its white surface and neutral 1px border on pointer and real Tab/Shift+Tab focus. Both modes have computed `outline-style: none` and `box-shadow: none`. The measured conversation layout remains x=249, y=196, 1191×704px at desktop; left content inset and end spacer are each 25px, summary right inset is 26px, bottom inset is 25px, and horizontal overflow is false. These are existing PR #59 layout changes, preserved here.

- Summary/default layout: [desktop](conversation-summary-1440x900.png), [mobile](conversation-summary-390x844.png)
- Composer default: [desktop](conversation-composer-default-1440x900.png), [mobile](conversation-composer-default-390x844.png)
- Pointer focus: [desktop](conversation-composer-pointer-1440x900.png), [mobile](conversation-composer-pointer-390x844.png)
- Keyboard focus: [desktop](conversation-composer-keyboard-1440x900.png), [mobile](conversation-composer-keyboard-390x844.png)
- Mobile focused summary: [390px](conversation-summary-focus-scroll-390x844.png)
- Layout and computed styles: [desktop geometry](measurements-1440x900.json), [mobile geometry](measurements-390x844.json), [desktop composer](conversation-composer-focus-1440x900.json), [mobile composer](conversation-composer-focus-390x844.json)

At 1440×900, the mapped canvas image is compared proportionally with the same 0.8612 scale and 44.8px vertical offset. Existing stage layout deltas are x +34.6px (+2.4% viewport width), y −17.6px (−2.0%), width −11px (−0.9% mapped reference width), and height +62px (+9.7%). The fixed panel composer remains narrower than the reference dock by product scope. The references do not show the focused text field; no focus-state pixel-parity claim is made. No mapped mobile primary reference exists.

## Validation

- Test-first proof on the unmodified CSS: the revised equality assertions failed on desktop and mobile because pointer focus computed `rgb(165, 207, 255)` for both textareas.
- At source-render SHA `d18b640a27622317dd2512a05714ec050c8e7a51`, the focused UIR-PR-03E spec passed **6/6** across desktop and mobile.
- The UIR-PR-03D home focus regression spec also passed **10/10** across desktop and mobile after updating its assertions to match the same contract. Running its pre-fix version reproduced the CI failure on both viewports: keyboard focus expected a non-transparent fill but computed `rgba(0, 0, 0, 0)`.
- The UIR-PR-02C home visual parity spec passed **22/22** across desktop and mobile after test-only alignment of synthetic creation expectations with the existing `/blueprints/{id}` initial conversation route and its current rendered state. The assertions retain project title, original message and saved status checks; the long-idea flow continues to verify full 1000-character persistence. The rendered UI is unchanged, so screenshots remain valid at source-render SHA `d18b640a27622317dd2512a05714ec050c8e7a51`.
- The UIR-PR-02E home viewport spec passed **10/10** across desktop and mobile. Its keyboard path verifies that `#project-idea` receives focus and remains visible without outline, shadow, or replacement background; the submit button still has a visible focus indicator. This updates only a stale test expectation; rendered UI and screenshots are unchanged.
- `npm run build` passed; Vite emitted the existing large-chunk advisory.
- Agent Browser was absent from the tool catalog; `command -v agent-browser` returned no executable. Playwright Chromium provided the browser validation.
- `git diff --check` passed on the current branch diff.

The user's request takes precedence over the general visible-focus guidance for these two textareas: retain keyboard access and native caret, while adding no focus ring or replacement fill. Other controls' focus indicators remain unchanged.
