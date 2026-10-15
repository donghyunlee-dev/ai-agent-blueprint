# SRC-PR-01 implementation validation

**Status:** implementer self-validation passed. The independent review and QA gates remain open.

## Focused tests

- `node --test tests/unit/src-pr-01-source-validation.test.js tests/unit/src-pr-01-source-extraction.test.js tests/unit/src-pr-01-source-upload-command.test.js` — 13 passed, 0 failed.
- `npx playwright test tests/e2e/src-pr-01-sources.spec.ts` — 6 passed, 0 failed across desktop Chromium (1440 × 900) and mobile Chromium (390 × 844).
- The browser flow checked workspace uploads, project-start uploads, strict extension/MIME rejection, readable and image-only PDF outcomes, preview after reload, one-file extraction failure with a successful sibling, source removal, and slot reuse.
- Unit coverage includes exact 10 MiB and six-file/concurrent boundaries, archived-row counts, UTF-8 BOM and malformed bytes, storage-failure preservation, and retrying a status save. An identical-name/identical-size two-file regression forces the later file's save to fail and verifies its selection index resolves to that later file for retry.
- PDF text ordering/table flattening has a deterministic unit fixture with items supplied out of order across lines, table columns, and pages. The browser flow also parses a small in-memory text-layer PDF; no source contents were sent to an API.
- The project-start browser assertion verifies that format/size/count guidance precedes the accessible file picker and that the picker advertises the supported formats.

## Build and diff

- `npm run build` — passed (`tsc -b` and Vite production build); Vite emitted the PDF worker and a lazy PDF parser chunk.
- `git diff --check` — passed after the correction pass.

The first browser run failed only because the test tried to read collapsed preview text without opening the preview and one heading locator matched a second, hidden page heading. After correcting those assertions, all six browser cases passed. No application defect was observed in that run.
