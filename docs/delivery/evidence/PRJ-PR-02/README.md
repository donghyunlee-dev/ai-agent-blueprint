# PRJ-PR-02 UI evidence

Playwright Chromium screenshots captured from the final implementation on 2026-10-14. Browser viewports are 1440×900 (`desktop-chromium`) and 390×844 (`mobile-chromium`). Recent-list 20-item states use viewport captures after the list is shown; the E2E assertions verify the full list contains exactly 20 projects. Other states use full-page captures at the same viewport widths.

| State | Desktop | Mobile |
| --- | --- | --- |
| Home, no projects | [home-empty-desktop-chromium.png](./home-empty-desktop-chromium.png) | [home-empty-mobile-chromium.png](./home-empty-mobile-chromium.png) |
| Home, six recent projects | [home-six-desktop-chromium.png](./home-six-desktop-chromium.png) | [home-six-mobile-chromium.png](./home-six-mobile-chromium.png) |
| Twenty projects, collapsed | [home-twenty-collapsed-desktop-chromium.png](./home-twenty-collapsed-desktop-chromium.png) | [home-twenty-collapsed-mobile-chromium.png](./home-twenty-collapsed-mobile-chromium.png) |
| Twenty projects, expanded | [home-twenty-expanded-desktop-chromium.png](./home-twenty-expanded-desktop-chromium.png) | [home-twenty-expanded-mobile-chromium.png](./home-twenty-expanded-mobile-chromium.png) |
| Saving | [saving-desktop-chromium.png](./saving-desktop-chromium.png) | [saving-mobile-chromium.png](./saving-mobile-chromium.png) |
| Saved project | [saved-desktop-chromium.png](./saved-desktop-chromium.png) | [saved-mobile-chromium.png](./saved-mobile-chromium.png) |
| Save failure, input retained | [save-failed-desktop-chromium.png](./save-failed-desktop-chromium.png) | [save-failed-mobile-chromium.png](./save-failed-mobile-chromium.png) |
| Delete confirmation modal | [limit-modal-desktop-chromium.png](./limit-modal-desktop-chromium.png) | [limit-modal-mobile-chromium.png](./limit-modal-mobile-chromium.png) |

The 21st-project browser flow checks initial focus, Tab focus containment, Escape cancellation, preserved input, successful deletion/creation, and the 20-item limit. Reduced-motion emulation also verifies that the modal backdrop does not blur. Agent Browser was unavailable in this environment (`agent-browser` was not on PATH); the same responsive flows were run directly in Playwright Chromium.

The canonical project-title editor is editable and autosaves after 500 ms. Save failure preserves the draft and exposes an explicit retry. Its final-HEAD states are captured at both required viewports:

| Title autosave state | Desktop | Mobile |
| --- | --- | --- |
| Saved title | [title-saved-desktop-chromium.png](./title-saved-desktop-chromium.png) | [title-saved-mobile-chromium.png](./title-saved-mobile-chromium.png) |
| Save failure with draft retained | [title-save-failed-desktop-chromium.png](./title-save-failed-desktop-chromium.png) | [title-save-failed-mobile-chromium.png](./title-save-failed-mobile-chromium.png) |
