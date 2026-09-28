---
name: conversational-blueprint-workflow
description: Coordinate product design, SFOOD UI implementation, and QA when changing the conversational Blueprint, decision sidebar, requirements specification, or PRD flow.
---

# Conversational Blueprint workflow

## Authorization

Spawn subagents only when the user explicitly requests delegation or a multi-agent run. Otherwise execute the same phases locally.

## Inputs

- User goal and product behavior.
- Current Survey, recommendation, requirements, and PRD code.
- `@sfood/ui` exports, global CSS, usage guide, and Storybook evidence.
- Allowed file scope and existing uncommitted changes.

## Team and ownership

- `blueprint-product-designer`: read-only conversation model and acceptance criteria.
- `sfood-ui-engineer`: sole implementation owner for assigned application and test files.
- `blueprint-qa-reviewer`: read-only independent behavior and regression review.
- Parent orchestrator: sequencing, handoffs, retries, and final synthesis.

## Phases and dependencies

1. Audit repository reality, dirty files, current behavior, and design-system compatibility.
2. Produce dialogue states, field mapping, sidebar groups, completion conditions, and acceptance criteria.
3. Implement with non-overlapping file ownership while preserving deterministic validation and services.
4. Run build and browser checks, then independently review behavior and responsiveness.
5. Route actionable findings through one correction pass and perform final validation.

Read-only discovery may run in parallel. Writes may not overlap.

## Handoff format

Return evidence, decisions, changed files if any, validation, unresolved risks, and completion state. Implementation also lists `@sfood/ui` components used and local UI that remains.

## Retry and failure policy

- Retry once for concrete build, behavior, accessibility, or review failures.
- For design-system or React/Tailwind incompatibility, verify package source and build output; do not duplicate the primitive.
- Without OpenAI credentials, verify the deterministic fallback and label the limitation.
- Preserve unrelated dirty files and stop on unsafe ownership overlap.

## Final synthesis

Report the flow, design-system integration, requirements-to-PRD handoff, validation evidence, limits, and changed files.

## Normal-flow scenario

The designer maps six survey groups into assistant prompts and sidebar cards. The engineer implements with `@sfood/ui`, preserves validation and fallback generation, and QA confirms desktop/mobile completion through requirements and PRD Markdown download.

## Failure-flow scenario

`@sfood/ui` fails from a React peer or Tailwind incompatibility. The engineer records evidence, avoids duplicate components, validates the smallest compatible integration or reports the blocker, and QA checks existing routes still build.
