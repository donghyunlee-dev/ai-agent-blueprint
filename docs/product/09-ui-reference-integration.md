# UI reference integration

## Purpose

Use the repository's reference screenshots as the visual foundation for Blueprint screens. This document records how product requirements, `docs/template/` captures, the existing React application, and implementation evidence fit together. It does not prescribe a third-party design system or component package.

## Sources of truth

1. User-visible behavior, state transitions, and data rules come from the product and process specifications.
2. Layout, information hierarchy, content density, and interaction patterns come from the relevant captures indexed in [`docs/template/README.md`](../template/README.md).
3. Accessibility, responsive behavior, and security requirements in the UI specifications remain mandatory even when a capture does not show them.
4. The application keeps its current React and TypeScript runtime. Screen-specific controls use semantic HTML and local CSS; shared components are introduced only where the application already has a clear reuse need.

## Reference selection

Before a UI change:

1. Read the UI screen state matrix and the exact screen specification.
2. Open the matching full-size capture(s) from `docs/template/README.md`.
3. Record the image filename and the layout or state pattern it informs in the task plan.
4. Identify differences required by Blueprint product behavior, keyboard access, contrast, responsive layouts, and supported content length.
5. Capture the final implementation at the required viewports and states after the last review fix.

Do not embed the supplied screenshots as rendered UI, copy their raster content into product assets, or treat every screenshot as an in-scope feature. The captures are visual references only.

## Visual principles observed in the references

- Use a light, neutral workspace with restrained accent color and compact navigation.
- Keep the project frame stable while the active work area changes.
- Let conversation, documents, and selected-item details have distinct but connected regions.
- Keep document content and task status more prominent than decoration.
- Explain empty states with the next useful action; show generation progress near the result.
- Preserve enough space for reading long documents and reviewing structured items.

## Implementation constraints

- Do not add a legacy external UI package, third-party design system, global design-system CSS, MCP integration, or another component framework for visual parity. Use local CSS and application-scoped custom properties informed by the selected captures.
- Do not introduce arbitrary icon or component dependencies when semantic HTML and existing application patterns suffice.
- Use CSS custom properties for repeated local values, with names scoped to the Blueprint application. Keep color choices consistent with the reference captures and meet text-contrast requirements.
- Use buttons for actions, links for navigation, labels for inputs, and programmatically connected descriptions and errors.
- Dialogs, drawers, tabs, and popovers must support keyboard operation, visible focus, correct focus return, and inactive-content focus isolation.
- Follow the defined 1440×900 and 390×844 evidence viewports; add intermediate breakpoints only as needed by content.

## Migration note

The current prototype still has legacy external UI package imports. The dependency and importing screens must be removed together in the product UI migration PR so each PR continues to build. Do not conceal the imports or expand the migration PR into an unrelated product-wide screen rewrite.

## Verification checklist

- The implementation report names the reference image(s) used.
- The implemented layout preserves the required workflow and product scope.
- Keyboard, focus, text contrast, responsive layout, loading, empty, error, and completed states are verified where applicable.
- Final-HEAD screenshots are attached to the PR for 1440×900 and 390×844 and match the tested build.
- `docs/template/` reference images are not included as implementation screenshots or product UI assets.
