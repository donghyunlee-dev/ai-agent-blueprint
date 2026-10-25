# UI reference integration

## Purpose

Use [the Blueprint redesign map](../blueprint-design/README.md) to choose the visual reference for each supported screen. The eight `docs/blueprint-design/` images guide hierarchy, layout, density, stage emphasis, and color direction. They do not authorize new product capabilities, routes, or data. The approved ideon login redesign may use individual photo, logo, and icon crops from its dedicated reference image.

## Sources of truth

1. Product, security, domain, document, accessibility, and responsive contracts define behavior and gates.
2. `docs/blueprint-design/README.md` maps the primary redesign images to login, home, conversation, proposal review, readiness, 요구사항 명세, and PRD.
3. For a state absent from those images, use the corresponding [template reference](../template/README.md) and the [screen state matrix](../ui/screen-state-matrix.md).
4. Existing React, TypeScript, semantic HTML, and local CSS are the implementation base. Extract a shared component only for a real shared contract.

## Reference selection

Before changing a screen, read its UI specification and state matrix, open its full-size primary image, and record the filename and observed pattern. Identify the parts backed by current routes and actions. For loading, empty, error, validation, overlay, and completed variants, use the fallback reference and existing behavior. After the final UI change, capture the implemented flow at 1440×900 and 390×844, plus every affected state.

The design board includes global Templates, Knowledge Library, Settings, notifications, voice input, project search/filter, sample projects, and new technical design flows. Those are outside this redesign. The home uses the existing idea input, attachment, and recent-project actions; the project workspace uses the existing routes and proposal/readiness/document commands.

## Layout interpretation

- The common frame identifies the project, save state, signed-in user, and supported navigation.
- The project path reads `대화 → 제안 검토 → 설계 → 요구사항 명세 → PRD`. The highlighted step follows the real route or in-page state.
- Each step owns the wide primary work area. A summary, issue list, table of contents, or item detail is secondary to that step. A permanent three-panel layout is not required across steps.
- The five readiness cards group the existing ten `DESIGN_SECTIONS` for display only. `computeDesignReadiness()` continues to decide blockers and the 요구사항 명세 gate; PRD still requires a ready 요구사항 명세.
- Source files, consistency review, export, and setup guide remain reachable through existing flows even where the images omit them.
- On narrow viewports, primary content precedes secondary content or opens it through a labelled control. Hidden regions leave the keyboard and accessibility tree. A fixed composer or footer cannot cover content or safe areas.

## Implementation constraints

Do not embed a full reference screenshot as a screen or background. The approved ideon login is the only exception for individual image crops from its dedicated reference. Do not add an external design system or unsupported menu placeholder. Use local semantic HTML/CSS and application-scoped CSS custom properties for repeated values. Keep status text visible without relying on color. Dialogs, drawers, links, tabs, and forms retain their keyboard, focus, validation, and failure-recovery contracts.

## Verification checklist

- The implementation report names the primary image and any state fallback used.
- The tested route, action, and displayed data exist in the current application.
- The project flow, proposal transaction, readiness gate, document edits, and support actions still work.
- Keyboard, focus, 200% zoom, responsive content order, reduced motion, and changed states are verified.
- Final-HEAD UI screenshots at 1440×900 and 390×844 show the tested implementation. Reference screenshots are never submitted as implementation evidence.
