# DSG-PR-01 independent code review

## Initial review — FAIL; corrections submitted

At `eab3839b0d329c5dd5ee10950ad074d6fb039b07`, review found “edit and approve” was offered for delete proposals, but the command ignored edited values and archived the target. The UI now omits editing for delete proposals and the command returns `edit_not_supported` without mutation.

At `d3d493fbde893f7d6d783d6745e420d34aa693b7`, review found acceptance criteria under archived DesignItems remained mutation targets. Normalization and command lookup now exclude archived parents; a parent archived after proposal creation makes update/delete stale with no mutation.

## Final independent review — PASS

- Source verification SHA: `d9ce3ea56db544fd87032439cf4aca6cfd51e2d6`.
- Review confirmed proposal normalization/reference checks, pending/confirmed separation, stale before-values, idempotent commands, atomic project/activity transaction, soft deletion, optional revision compatibility, keyboard/mobile UI, delete/edit safeguard, and archived-parent target safeguard.
- Focused unit tests 10/10 passed; affected contracts + unit 16/16 passed; build and diff-check passed.

## Final independent QA — PASS

- Source verification SHA: `d9ce3ea56db544fd87032439cf4aca6cfd51e2d6`.
- Proposal Playwright: 6/6 desktop/mobile; archived-parent targeted regression: 1/1.
- Verified edit/approve, rejection, pending values unconfirmed, transaction failure preserves pending items, delete has no edit action and plain approval archives, keyboard flow, focus styling, and mobile diff layout.
- Archived acceptance criteria under an archived parent return stale without mutation.
- QA observed that next-card focus is implemented but the browser test does not explicitly assert `document.activeElement`; the keyboard flow passed.
