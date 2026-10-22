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
- Never push directly to `main` or merge through Git aliases, indirect shell invocations, or mutating GitHub API requests; use the PR workflow.
- Complete the merge step only when the user requested the full PR lifecycle or explicitly authorized merging. Otherwise stop at `ready_to_merge`.

## Required inputs

1. Read `AGENTS.md` and `docs/delivery/development-pr-review-qa-workflow.md`.
2. Identify the PR unit, delivery task IDs, requirement IDs, dependencies, and linked product contracts. Read every linked contract that affects the work.
3. For UI work, preserve product behavior and accessibility, security, and responsive contracts first. Read `docs/blueprint-design/README.md` and inspect its mapped primary image; use `docs/template/README.md` only for states absent from the new design. Follow `docs/ui/07-visual-acceptance.md` for visual comparison.
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

Dispatch one implementer with exclusive file ownership. Follow test-first development for changed business behavior. Run focused tests, relevant integration or browser checks, `npm run build`, documentation checks when relevant, and `git diff --check`. For UI work, capture final-HEAD screens at 1440×900 and 390×844 plus every affected required state. Verify the flow with Playwright Chromium and Agent Browser when both are available. If Agent Browser is unavailable in this execution environment, inspect the available tool catalog and check for its executable once, record that evidence, then use Playwright Chromium for the complete independent QA flow. Missing Agent Browser alone does not block QA when Playwright Chromium can exercise the app; missing runtime, fixtures, or all usable browser automation remains blocked. Do not claim Agent Browser was used when it was not.

For UI work, compare the mapped source image and the rendered screen side by side at the same CSS viewport and comparable state. Record source path, route/state, viewport, HEAD SHA, artifact link, and the position/size deltas of applicable major anchors (rail, header, main content, hero, composer, recent area). A position delta above 5% of the viewport or a size delta above 10% of the reference anchor is material unless a documented higher-priority contract requires it. Explain non-comparable anchors and exceptions; font rasterization or antialiasing alone is not a failure. An unexplained material gap blocks self-validation and `ready_to_merge`. For a Vercel UI Preview, verify it serves the reviewed HEAD before using it as visual evidence; if unavailable, disclose that comparison uses local runtime only. Test-auth browser mocks establish presentation, not real-account or authentication proof.

Do not create the PR until self-validation passes. Record exact commands and results. Do not report an unrun check as passing.

### 3. Publish and independently review

Create or update the PR using `.github/pull_request_template.md`, link the task plan and requirements, and include validation and UI evidence. Then dispatch `blueprint-code-reviewer` on the exact base/head diff and acceptance criteria.

For UI work, the independent reviewer inspects the matched reference/rendered pairs and recorded anchor deltas, listing material differences. Unexplained material gaps are blocking findings, not `pass_with_non_blocking` items. Review result must be `pass` or `pass_with_non_blocking`; all non-blocking items need a follow-up task ID. For Critical or Important findings, move to `fix_required`, dispatch the implementer for a bounded correction, rerun affected validation, and dispatch a fresh reviewer on the new diff. After two unsuccessful correction cycles, set `blocked` and ask for a scope or design decision.

### 4. Independent QA

Only after code review passes, dispatch a separate `blueprint-qa-reviewer` with the acceptance criteria, PR diff, runtime instructions, matched visual pairs, and review verdict. QA inspects the pairs and lists material visual differences as well as validating user behavior and process state, including applicable error, empty, retry, refresh, duplicate-request, keyboard, responsive, and screenshot states. An unexplained material gap fails QA and blocks `ready_to_merge`.

If QA fails, combine findings into one correction pass, rerun implementation validation, and repeat independent review and QA on the new HEAD. If the same blocking QA finding remains after that pass, set `blocked` and replan. Missing runtime, required fixture, or all usable browser automation is `blocked`, never `pass`. When Agent Browser is unavailable but Playwright Chromium is usable, the independent QA reviewer must exercise the same required user flows and responsive states in Playwright Chromium, record the Agent Browser unavailability evidence, and report Playwright as the tool used.

### 5. Ready and gated merge

Set `.codex/state/pr-loop.json` to the current PR only. The merge hook permits only the matching `gh pr merge <number> --squash` command when all fields below match, GitHub's current PR head matches `headSha`, review and QA evidence identify that same head, configured status checks pass, and the authorization is less than 15 minutes old. A process lock protects the check-and-consume operation, and the hook consumes the authorization before allowing the command. It blocks direct `main` pushes and common GitHub REST/GraphQL merge requests through `gh api` or `curl`. Keep this runtime state out of Git.

```json
{
  "pullRequest": 123,
  "baseBranch": "main",
  "stage": "ready_to_merge",
  "validation": "pass",
  "codeReview": "pass",
  "qa": "pass",
  "headSha": "<current PR head SHA>",
  "codeReviewHeadSha": "<same SHA>",
  "qaHeadSha": "<same SHA>",
  "mergeAuthorized": true,
  "mergeAuthorizedAt": "<current UTC timestamp>"
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
