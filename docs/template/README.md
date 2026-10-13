# UI reference screenshots

`docs/template/` contains the visual reference captures for Blueprint UI work. Read this index and inspect the relevant full-size images before changing a screen. The screenshots guide information hierarchy, layout, density, and interaction patterns; they are not assets to embed or pixel-perfect targets. Product behavior, accessibility, security, and responsive requirements in the product specifications remain binding.

## Reference map

| Image | Screen/state | Use it to guide |
| --- | --- | --- |
| [image (17).png](./image%20(17).png) | Project start | Idea entry, examples, upload, recent projects |
| [image (16).png](./image%20(16).png) | PRD questions begin | Conversation and an initially empty document pane |
| [image (15).png](./image%20(15).png) | Questions in progress | Mixed free-text and choice answers, summarized prior answers |
| [image (14).png](./image%20(14).png) | PRD generating | Visible work stages and progressive document completion |
| [image (12).png](./image%20(12).png) | PRD complete | Document outline, sections, metadata, and review |
| [image (13).png](./image%20(13).png) | Next artifact prompt | Continue review or move to the next deliverable |
| [image (11).png](./image%20(11).png) | Requirements entry | Keep conversation context while changing the work area |
| [image (10).png](./image%20(10).png) | Requirements overview | Hierarchical requirement structure |
| [image (9).png](./image%20(9).png) | Requirement detail | Selected item details and review information |
| [image (8).png](./image%20(8).png) | User flow empty | Empty-state guidance within a persistent project workspace |
| [image (7).png](./image%20(7).png) | User flow generating | In-context generation status |
| [image (6).png](./image%20(6).png) | User flow complete | Canvas and flow list together |
| [image (5).png](./image%20(5).png) | User flow exploration | Lanes, screens, actions, and connected flow |
| [image (4).png](./image%20(4).png) | Wireframe empty | Entry point using the existing user flow |
| [image (3).png](./image%20(3).png) | Generation options | Modal setup for flow, device, and pages |
| [image (2).png](./image%20(2).png) | Bulk page selection | Grouped page selection and select-all controls |
| [image (1).png](./image%20(1).png) | Generation confirmation | Fixed action area and generation cost summary |
| [image.png](./image.png) | Wireframe editing | Preview, page list, page details, and zoom controls |

The captures are also catalogued in [the benchmark analysis](../research/manyfast-benchmark-analysis.md). Use only references relevant to the current screen and task; the presence of a reference does not add that screen or feature to the current product scope.

## Implementation guidance

- Match the calm neutral canvas, compact navigation, clear document hierarchy, and restrained accent color visible in the relevant capture.
- Keep the project frame stable as users move between conversation and deliverables.
- Make empty, working, complete, and error states explain what happened and what the user can do next.
- Recreate controls with the application's existing framework and local semantic HTML/CSS. Do not add `기존 공유 UI 라이브러리`, Agent Blueprint design tokens, or another component library for visual parity.
- Preserve text contrast, visible focus, keyboard operation, reduced-motion preferences, and the specified mobile layout even where the capture does not show them.
- Attach current development screenshots for the changed flow to the PR; do not submit these reference captures as proof of implementation.
