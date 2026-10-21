# GDE-PR-01 validation results

Base: `8bd59a14c1bd6e526b41f37cb5b9fe42018833f7`

## Focused checks

| Command | Result |
| --- | --- |
| `npx playwright test tests/e2e/gde-pr-01-setup-guide.spec.ts --workers=1` | Pass on latest correction head, desktop Chromium and mobile Chromium (2/2) |
| `npm run test:golden` | Pass on latest correction head, 34/34 synthetic fixtures including unknown-command rejection and ordinary-prose cases; no provider calls |
| `node --test tests/unit/gde-pr-01-setup-guide.test.js tests/contract/gde-pr-01-setup-guide-api.test.js tests/contract/fnd-model-registry.test.js tests/unit/ai/prompt-registry.test.js tests/unit/ai/golden-eval.test.js` | Pass on latest correction head, 43/43 |
| `npm run build` | Pass on latest correction head, TypeScript and Vite production build |
| `git diff --check` | Pass |

## Broader suite note

`npm run test:unit` reports 334/335 passing. The failing test is `tests/unit/src-pr-01-source-upload-command.test.js` (“removes a source transactionally without replacing sibling records”). It fails at `src/features/sources/source-upload-command.js:95` because `latest.designItems` is undefined. The broad suite result was collected on the preceding correction head; the same test and error were reproduced on the unchanged base commit above, so this is a pre-existing failure outside GDE-PR-01. The latest correction was validated with the focused suites listed above.

## UI evidence

- Desktop 1440×900, approved guide: [desktop-ready.png](./evidence/desktop-ready.png)
- Mobile 390×844, approved guide: [mobile-ready.png](./evidence/mobile-ready.png)
- The Playwright flow expands read-only source excerpt provenance and verifies its ID is persisted on the generated section.
- The provenance flow uses a secret-bearing first excerpt and confirms later excerpt IDs, locations, and redacted display text remain aligned.
- Agent Browser is unavailable (`command -v agent-browser` returned no executable). The flow was exercised in Playwright Chromium at both viewports.
