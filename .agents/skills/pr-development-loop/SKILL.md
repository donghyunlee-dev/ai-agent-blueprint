---
name: pr-development-loop
description: Run a repository change through its planned PR unit, implementation, validation, independent review, QA, bounded fix loops, and gated merge. Use for code, documentation, UI, or repository configuration work that should complete as a pull request.
---

# PR Development Loop

Use `docs/delivery/development-pr-review-qa-workflow.md` as the product delivery contract. This skill supplies the Codex execution sequence and agent handoffs.

## Authorization and scope

- A request to run this skill authorizes the planner, implementer, code reviewer, and QA reviewer subagents in the sequence below.
- Read the worktree and preserve unrelated changes. Do not start a second PR unit while one is open.
- Create one focused branch and one PR targeting the repository default branch (`main` in this repository).
- The normal task ends after that PR is merged and its state is verified. Start another PR unit only if the user requested a batch.
- Never force push, merge a local branch, bypass failing checks, or merge a PR with a failed or missing gate.
- Complete the merge step only when the user requested the full PR lifecycle or explicitly authorized merging. Otherwise stop at `ready_to_merge`.

## Required inputs

1. Read `AGENTS.md` and `docs/delivery/development-pr-review-qa-workflow.md`.
2. Identify the PR unit, delivery task IDs, requirement IDs, dependencies, and linked product contracts. Read every linked contract that affects the work.
3. For UI work, read `docs/template/README.md` and inspect the relevant `docs/template/image*.png` references. The screenshots are the visual source of truth; preserve accessibility and responsive requirements from the UI specifications.
4. Check `git status`, current branch, base branch, and remote PR state before making changes.
5. Confirm Definition of Ready. If a required decision, dependency, or contract is missing, report `blocked` with the exact missing item and do not implement.

## Agents and ownership

| Stage | Agent | Write ownership |
| --- | --- | --- |
| Plan | `blueprint-task-planner` | Task plan and traceability checklist only |
| Implement | `blueprint-implementer` or `blueprint-ui-engineer` | Assigned production, test, and directly required documentation files |
| Code review | `blueprint-code-reviewer` | Read only |
| QA | `blueprint-qa-reviewer` | Read only; temporary evidence under `.pr-artifacts/<pr-unit>/` only |

The coordinator owns sequencing, state updates, PR publication, and merge. Do not overlap writes between agents. The implementer cannot approve its own review or QA.

## Phases and gates

### 1. Plan

Dispatch `blueprint-task-planner` with the task unit, dependencies, requirements, acceptance criteria, and linked specifications. It returns a concise executable plan, test matrix, and traceability list. Confirm the scope matches one PR unit before implementation.

### 2. Implement and self-validate

Dispatch one implementer with exclusive file ownership. Follow test-first development for changed business behavior. Run focused tests, relevant integration or browser checks, `npm run build`, documentation checks when relevant, and `git diff --check`. For UI work, capture final-HEAD screens at 1440×900 and 390×844 plus every affected required state; use both Playwright and Agent Browser.

Do not create the PR until self-validation passes. Record exact commands and results. Do not report an unrun check as passing.

### 3. Publish and independently review

Create or update the PR using `.github/pull_request_template.md`, link the task plan and requirements, and include validation and UI evidence. Then dispatch `blueprint-code-reviewer` on the exact base/head diff and acceptance criteria.

Review result must be `pass` or `pass_with_non_blocking`; all non-blocking items need a follow-up task ID. For Critical or Important findings, move to `fix_required`, dispatch the implementer for a bounded correction, rerun affected validation, and dispatch a fresh reviewer on the new diff. After two unsuccessful correction cycles, set `blocked` and ask for a scope or design decision.

### 4. Independent QA

Only after code review passes, dispatch a separate `blueprint-qa-reviewer` with the acceptance criteria, PR diff, runtime instructions, and review verdict. QA validates user behavior and process state, including applicable error, empty, retry, refresh, duplicate-request, keyboard, responsive, and screenshot states.

If QA fails, combine findings into one correction pass, rerun implementation validation, and repeat independent review and QA on the new HEAD. If the same blocking QA finding remains after that pass, set `blocked` and replan. Missing runtime, fixture, Playwright, or Agent Browser capability is `blocked`, never `pass`.

### 5. Ready and gated merge

Set `.codex/state/pr-loop.json` to the current PR only. The merge hook permits only the matching `gh pr merge <number> --squash` command when all fields below match. Keep this runtime state out of Git.

```json
{
  "pullRequest": 123,
  "baseBranch": "main",
  "stage": "ready_to_merge",
  "validation": "pass",
  "codeReview": "pass",
  "qa": "pass",
  "mergeAuthorized": true
}
```

Before merge, verify the PR base is `main`, GitHub reports all configured checks successful, and review and QA evidence refer to the latest HEAD. If the user requested full lifecycle, merge with squash and delete the feature branch; otherwise stop at `ready_to_merge`. Never enable admin bypass. If repository rules, required checks, or permissions prevent merging, report the exact GitHub response and stop.

After merge, verify `mergedAt`, base branch, merge commit, and `origin/main`. Remove the local runtime state and report the PR, validation, review, QA, merge commit, and any follow-up tasks.

## State vocabulary

Use `planned → ready → in_progress → code_review → qa → fix_required → ready_to_merge → merged`. Use `blocked` whenever a required input or gate cannot be satisfied. `ready_to_merge` is not merged; only a verified GitHub merge unlocks the next dependent PR.

## Normal flow

The planner verifies an auth PR's dependency and acceptance criteria; the implementer writes failing contract tests, implements, builds, and captures required UI evidence; the coordinator opens a PR; the read-only reviewer passes the exact diff; the separate QA reviewer verifies the live flow; the coordinator records all gates, merges only when authorized, then verifies the merged main commit.

## Failure flow

The reviewer finds an authorization bypass. The PR remains open and the state becomes `fix_required`; the implementer fixes the issue and reruns focused tests and build; a fresh reviewer checks the new diff. If it passes, QA tests the bypass and normal login flows. The merge hook continues to deny merge while any gate is missing or failed. Repeated unresolved findings become `blocked` rather than an endless loop.
