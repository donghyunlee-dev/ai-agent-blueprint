# PRJ-PR-02 implementation validation

## Self-validation

| Command | Result |
| --- | --- |
| `npm run test:unit` | Passed: 122/122 unit and contract tests. |
| `npm run test:e2e:ci -- tests/e2e/prj-pr01.spec.ts` | Passed: 24/24 PRJ-01 Playwright Chromium cases across desktop and mobile. |
| `npm run test:e2e:ci -- tests/e2e/prj-pr02.spec.ts` | Passed: 24/24 PRJ-02 Playwright Chromium cases across desktop 1440×900 and mobile 390×844. |
| `npm run test:ci` | Passed: unit/contract 122/122, full Playwright E2E 84/84, production build. The E2E script runs with one worker. |
| `git diff --check` | Passed after the validation run. |

The E2E default was reduced from two workers to one in `package.json`. The full suite first ran with two workers and passed 73/76; three failures were resource-sensitive browser checks (two PRJ-02 20-item full-page screenshot/interaction timeouts and one PRJ-01 history navigation save-status timeout). The 20-item evidence was changed to viewport screenshots while retaining list-count assertions. Serial E2E then passed 76/76, and literal `npm run test:ci` passed after setting the CI default to one worker.

## Independent-review correction pass

- Released the project-creation submission lock when an owner switch invalidates an in-flight confirmed-delete operation. A delayed-delete Playwright regression verifies the new owner can submit afterward.
- Also clears the old owner modal and delete error if the in-flight deletion rejects after the owner switch. Desktop/mobile regression checks no old title or error remains and the new owner can submit.
- Guarded project load, autosave, and retry completions by owner, project, attempt, and effect generation. A deferred retry regression switches from owner A to B before rejecting A's save and verifies B's saved state remains unchanged.
- Wired the 500 ms debounced autosaver to the canonical project title. The editor preserves invalid input and unsaved drafts, shows saving/saved/failed states, and offers explicit retry. Unit coverage verifies edits made during retry are persisted as the latest snapshot.
- Added Playwright saved and failed-title screenshots for desktop and mobile; see the evidence index.

The correction pass's focused autosave unit suite passed 3/3, its delete race subset passed 4/4, and final literal `npm run test:ci` passed with 122 unit/contract tests and 84 Playwright tests plus production build.

## Independent code review

**PASS** on exact implementation/evidence HEAD `69e63bd08437956b0b389a44cd93ef4f68c6f407`.

- Reviewer ran the owner-switch regression cases on desktop and mobile: 4/4 passed. These cover successful-delete owner-switch lock release and stale retry/save completion isolation.
- Reviewer verified all 26 indexed PNG captures have the required CSS viewport dimensions (1440×900 desktop, 390×844 mobile), checked the E2E assertion for the exact 20-project expanded-list count, and ran `git diff --check` successfully.
- Resolved findings on this HEAD: (1) release the project submission lock when a confirmed-delete operation becomes stale after owner switch; (2) guard project load, background save, and retry completion by owner/project/attempt/generation so stale A work cannot overwrite B state; (3) wire the canonical project-title editor to the 500ms autosave helper with invalid input/draft retention and saving/saved/failed/retry states; (4) clear stale owner A modal/error and release operation flags if delete rejects after switching to B. Regression coverage was added for each affected race or autosave behavior.

## Independent QA

**PASS** on exact implementation/evidence HEAD `69e63bd08437956b0b389a44cd93ef4f68c6f407`.

| Command / check | Result |
| --- | --- |
| `npm run test:e2e:ci -- tests/e2e/prj-pr02.spec.ts --workers=1` | Passed, 24/24 across desktop and mobile Chromium. |
| Browser flow at CSS viewports 1440×900 and 390×844, Vite `127.0.0.1:5184` | At 19 projects, creation to 20 showed no deletion dialog. Title remained unsaved at 350ms and persisted at 559ms desktop / 563ms mobile. Horizontal overflow was 0. |
| Evidence links and raster dimensions | All indexed links resolved; desktop images were 1440×900 and mobile images 390×844. |

The QA run also exercised the list count, modal and saved-title evidence on both viewports. Agent Browser was unavailable in the tool catalog and `agent-browser` was not on `PATH`; QA used Playwright Chromium as the repository fallback.

## Browser evidence

Final Playwright Chromium screenshots for the required viewports and saving, saved, failed, recent-list, and deletion-modal states are indexed at [`docs/delivery/evidence/PRJ-PR-02/README.md`](../../delivery/evidence/PRJ-PR-02/README.md). The capture tests also check modal initial focus, Tab containment and Escape cancellation, and reduced-motion backdrop behavior.

Agent Browser was unavailable in this environment: no Agent Browser tool was exposed and `agent-browser` was not on `PATH`. The browser paths were exercised directly in Playwright Chromium.

## OAuth and gate scope

Live Google OAuth was not exercised. PRJ-02 authenticated browser cases use test session fixtures; the independent review and QA above cover the PRJ-02 persistence and UI behavior. Code review and QA are PASS at the exact code/evidence HEAD above. The PR remains `ready_to_merge`; it has not been merged.

## Screenshot raster correction

All indexed Playwright captures are regenerated with `scale: 'css'` and `fullPage: false`, producing exact 1440×900 desktop and 390×844 mobile rasters regardless of device pixel ratio. The 19-project boundary, successful 19→20 creation, and debounced title-saved QA captures are included in the evidence index. The first full capture refresh had one transient mobile fixture-navigation timeout (23/24); the isolated case passed 2/2 and the subsequent complete PRJ-02 run passed 24/24 without changing timeout settings.
