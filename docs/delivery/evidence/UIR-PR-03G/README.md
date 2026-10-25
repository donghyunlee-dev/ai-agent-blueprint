# UIR-PR-03G conversation outer-gutter evidence

## Matched state

- Primary design: [`docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`](../../../blueprint-design/회의실%20예약%20서비스%20UI%20캔버스.png)
- Fallback states: [`docs/template/image (15).png`](../../../template/image%20(15).png), [`docs/template/image (16).png`](../../../template/image%20(16).png)
- Route: `/blueprints/uir-pr-03e-meeting-room`
- Fixture: deterministic UIR-PR-03E meeting-room aggregate
- Source-render HEAD: `f8d78c2bb2440cce7c51391ec489c19b40f6ae8d`
- Playwright Chromium, desktop 1440×900 and mobile 390×844

## Captures and measurements

- Desktop: [conversation and summary, 1440×900](conversation-summary-1440x900.png) · [geometry JSON](measurements-1440x900.json)
- Mobile: [conversation and summary, 390×844](conversation-summary-390x844.png) · [geometry JSON](measurements-390x844.json)

At desktop, the stage remains at `x=249, y=196, 1191×704`. The conversation card is inset 26px from its left edge and 26px from the stage bottom. The summary card also ends 26px above the stage bottom. The fixed composer remains 30px inside the conversation card on both sides and 10px above its bottom. The 26px right gutter and 25px internal conversation/summary padding are unchanged. No horizontal overflow occurred.

Compared with the previous render at the same route, viewport, and fixture, the conversation card moves 26px right and ends 26px higher; its width and height each decrease 26px. The summary card height decreases 26px. The composer moves 26px right and 25px up, retaining its existing right edge and becoming aligned within the shortened conversation card. These anchor changes are intentional: the user explicitly requested visible padding outside the card borders because they were touching the page boundary. The mapped reference presents the panels closer to the stage boundary, so this is a recorded user-directed spacing exception.

At mobile, the stage retains its 10px outer inset and the conversation/summary remain stacked. No horizontal overflow was detected. The 1024×768 breakpoint was also exercised by the desktop browser test; the composer stayed within the conversation card.
