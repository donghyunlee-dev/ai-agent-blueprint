---
name: conversational-blueprint-workflow
description: Coordinate product design, Blueprint UI implementation from repository screenshot references, and QA when changing the conversational Blueprint, decision sidebar, requirements specification, or PRD flow.
---

# Conversational Blueprint workflow

## Authorization

Spawn subagents only when the user explicitly requests delegation or a multi-agent run. Otherwise execute the same phases locally.

## Inputs

- User goal and product behavior.
- Current Survey, recommendation, requirements, and PRD code.
- Product behavior and accessibility, security, and responsive contracts; the mapped primary image in `docs/blueprint-design/README.md`; `docs/template/README.md` only for missing states; screen specifications and existing React/CSS conventions.
- Allowed file scope and existing uncommitted changes.

## Team and ownership

- `blueprint-product-designer`: read-only conversation model and acceptance criteria.
- `blueprint-ui-engineer`: sole implementation owner for assigned application and test files.
- `blueprint-qa-reviewer`: read-only independent behavior and regression review.
- Parent orchestrator: sequencing, handoffs, retries, and final synthesis.

## Phases and dependencies

1. Audit repository reality, dirty files, current behavior, and design-system compatibility.
2. Produce dialogue states, field mapping, sidebar groups, completion conditions, and acceptance criteria.
3. Implement with non-overlapping file ownership, using the mapped Blueprint design image as the primary visual reference and preserving deterministic validation and services.
4. Run build and browser checks. Compare reference and rendered screens at matching CSS viewport/state using `docs/ui/07-visual-acceptance.md`; independently review behavior, responsiveness, and material visual gaps. A material unexplained gap blocks completion.
5. Route actionable findings through one correction pass and perform final validation.

Read-only discovery may run in parallel. Writes may not overlap.

## Handoff format

Return evidence, decisions, changed files if any, validation, unresolved risks, and completion state. UI implementation also lists the reference images, matched viewport/state pairs, anchor deltas, and responsive/accessibility checks.

## Retry and failure policy

- Retry once for concrete build, behavior, accessibility, or review failures.
- For design-system or React/Tailwind incompatibility, verify package source and build output; do not duplicate the primitive.
- Without OpenAI credentials, verify the deterministic fallback and label the limitation.
- Preserve unrelated dirty files and stop on unsafe ownership overlap.

## Final synthesis

Report the flow, design-system integration, requirements-to-PRD handoff, validation evidence, limits, and changed files.

## Normal-flow scenario

The designer maps six survey groups into assistant prompts and sidebar cards. The engineer follows relevant project-start and document screenshots, preserves validation and fallback generation, and QA confirms desktop/mobile completion through requirements and PRD Markdown download.

## Failure-flow scenario

The screenshot reference conflicts with a required mobile or keyboard behavior. The engineer follows the product accessibility contract, records the deviation from the capture, and QA verifies the accessible responsive behavior.
