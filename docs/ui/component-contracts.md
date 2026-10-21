# Blueprint UI implementation contracts

## Purpose

Define behavior and accessibility contracts for local screen controls. The primary visual structure comes from [the Blueprint redesign map](../blueprint-design/README.md); [template captures](../template/README.md) cover states absent from the redesign images. Screen behavior remains defined by each UI specification. This document does not require a shared UI package.

## Semantic element mapping

| User intent | HTML element | Required contract |
| --- | --- | --- |
| Navigate to another route or document | `<a>` | Meaningful destination and visible focus |
| Submit, save, approve, dismiss, or retry | `<button>` | Explicit label, correct disabled state, no nested controls |
| Enter text or a number | `<input>` / `<textarea>` | Programmatic label, input type, description and error association |
| Choose one option | `<input type="radio">` | Shared named group, selected state exposed to assistive technology |
| Choose multiple options | `<input type="checkbox">` | Independent checked state and selection limits stated in text |
| Expand or collapse content | `<button aria-expanded>` | Controlled region relationship and keyboard operation |
| Move between the five project stages | Navigation links or in-place controls | Use links for document routes; use buttons or true tabs for project modes without URL changes. Show current and gated states. |
| Show modal dialog | `<dialog>` or equivalent dialog pattern | Accessible name, focus containment, Escape policy, focus return |
| Announce progress or result | Status/live region | Concise updates without moving focus unexpectedly |
| Display a state | Text plus optional icon/color | Never rely on color alone |

## Local component extraction

Keep controls local to the feature unless multiple screens need the same behavior. A shared component is justified when it preserves one stable keyboard, focus, validation, or responsive contract across at least two consumers. Do not create a general UI library or copy screenshot pixels into assets.

Blueprint feature components may combine domain state, such as proposal review or file validation, but must preserve the semantic contracts above. Their props should expose state and events rather than arbitrary style overrides.

## Dialog, drawer, and tab contracts

- Inactive dialog or drawer content must not remain in the tab order or accessibility tree.
- Closing an overlay returns focus to its trigger unless that trigger no longer exists; then move focus to the nearest meaningful heading or action.
- Escape behavior and backdrop-click behavior are explicit per task. Do not silently discard unsaved input.
- Keyboard tabs use arrow-key movement only for true in-place tab interfaces. URL navigation uses links and standard browser behavior.
- Focus indicators remain visible on every interactive control.

## Validation contracts

- Every input has a visible label; placeholder text is not a label.
- Descriptions and errors are linked with `aria-describedby`.
- Invalid forms identify both the affected field and an actionable correction.
- Loading and disabled states do not erase user input or the previous result.
- A control that looks disabled must also be disabled to keyboard and assistive technology users.

## Completion

- Each interactive element uses the right semantic role and is operable with keyboard alone.
- Screen readers receive names, state changes, validation errors, and progress updates.
- The layout follows the selected blueprint-design image and any needed state fallback while meeting responsive and accessibility requirements.
- New screens add no `기존 공유 UI 라이브러리`, Agent Blueprint design tokens, or UI component package dependencies.
