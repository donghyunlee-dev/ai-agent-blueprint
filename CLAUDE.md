# Claude Development Instructions

## Authority and required reading

Before any development task, read these files in order:

1. `AGENTS.md`
2. `docs/delivery/development-pr-review-qa-workflow.md`
3. the delivery document and requirement IDs named by the current PR unit
4. the relevant UI, process, data, architecture, authentication, or AI specification

The repository specifications and the user's latest explicit instruction override skill defaults. Never merge a PR for the user and never begin the next PR unit until the user confirms that the current PR is merged.

## Mandatory skill routing

At the start of every staged development request:

Prefer the enabled official `superpowers@claude-plugins-official` installation. If duplicate plugin registration makes a Superpowers skill ambiguous or unavailable, do not alter user-global Claude settings automatically; use the fallback below and report the conflict.

1. Invoke `superpowers:using-superpowers` before exploration or clarification.
2. Use `superpowers:brainstorming` when product behavior or the task boundary is not already decided.
3. Use `superpowers:writing-plans` to write the task implementation plan before editing production code.
4. Save the plan under `docs/superpowers/plans/YYYY-MM-DD-<pr-unit>.md` and link the applicable product/delivery spec.
5. Use `superpowers:using-git-worktrees` before implementation unless the user explicitly authorizes work on the current branch.
6. After the plan is confirmed, invoke `superpowers:subagent-driven-development` and `superpowers:test-driven-development`.
7. Use `superpowers:requesting-code-review` for the independent review and `superpowers:verification-before-completion` before creating or updating the PR.
8. Use `superpowers:finishing-a-development-branch` only to push and create/update a PR. The local-merge path is forbidden for this repository.

If the Superpowers plugin or a required Superpowers skill cannot be loaded:

1. Invoke the registered `task-spec-template` skill.
2. Create `docs/tasks/<pr-unit-id>/task-spec.md` with Overview, Background, Requirements, happy/failure acceptance criteria, references, files, tests, UI evidence, review, QA, and Done Checklist.
3. Show the completed task spec to the user and wait for explicit confirmation before implementation, as required by that skill.
4. Record which Superpowers skill was unavailable in the task spec and PR body.
5. After user confirmation, manually dispatch the same project planner, implementer, code-reviewer, and QA agents in the required sequence; the fallback changes task documentation, not the independent-agent gates.

Do not silently skip both routes. If neither Superpowers nor `task-spec-template` is available, stop before code and report the missing capability.

## Multi-agent execution is mandatory

Starting implementation means starting the multi-agent workflow. The coordinator owns sequencing and must keep implementation, code review, and QA in separate agent contexts.

### Required roles

| Role | Responsibility | Write access | Default model |
| --- | --- | --- | --- |
| Task planner | Convert the confirmed PR unit into an executable task brief and acceptance checklist | Task plan only | Sonnet |
| Implementer | Implement one task with TDD, tests, self-review, and a report | Assigned code/test files | Sonnet |
| Code reviewer | Review spec compliance, correctness, security, maintainability, and test quality from the diff | Read-only | Sonnet; Opus for high-risk/final review |
| QA reviewer | Run behavioral, process, responsive, accessibility, failure, and screenshot verification | Read-only except temporary evidence | Sonnet |

Use the project agents `blueprint-task-planner`, `blueprint-implementer`, `blueprint-code-reviewer`, and `blueprint-qa-reviewer`. Agent files are loaded when a Claude Code session starts, so restart the session after these definitions change.

Model routing:

- Haiku may implement only mechanical, complete-spec changes limited to one or two files.
- Sonnet is the default for implementation, scoped review, browser QA, and integration work.
- Opus is required for final whole-PR review and for authentication, authorization, data migration/integrity, AI orchestration/budget, or broad architecture changes.
- Reviewers and QA must not use a model weaker than Sonnet.
- Always set the subagent model explicitly; never rely on inherited defaults.

### Sequencing and ownership

1. Dispatch one fresh implementer per Superpowers task brief.
2. Never run multiple implementation agents concurrently when they can touch shared files or state.
3. After implementation and self-verification, dispatch a separate code-review agent with the task brief, implementation report, BASE/HEAD range, and review package.
4. Resolve Critical and Important findings through the Superpowers fix/re-review loop. The coordinator does not edit fixes directly.
5. After code review passes, dispatch a separate QA agent. The code reviewer cannot double as QA.
6. QA verifies the running application and process, not only the diff.
7. After QA passes, run final verification, create/update the PR, and stop at `ready_to_merge`.
8. Wait for the user to merge. Only after merge confirmation may the next PR unit begin from an updated base.

Subagents must not spawn their own subagents. Only the coordinator dispatches implementation, review, fix, and QA agents.

## Testing and evidence

- Follow red-green-refactor for all behavior changes unless the user explicitly approves a TDD exception.
- Run the task-specific tests, the affected integration/process tests, `npm run build`, and `git diff --check` before the PR.
- Run `npm run docs:check:mermaid` when Mermaid documentation changes.
- UI and interaction changes require both Playwright and Agent Browser verification.
- Never claim success from a subagent report alone; inspect the diff and run fresh verification.

## Mandatory screenshots for UI PRs

Any PR that changes visible UI, layout, copy, loading/empty/error state, responsive behavior, focus behavior, or interaction must include current development-screen screenshots that reviewers and the user can see directly from the PR.

Minimum evidence:

- desktop `1440x900`
- mobile `390x844`
- every affected state required by the task: normal plus applicable loading, empty, error, validation, open overlay, and completed state
- before/after pairs when modifying an existing screen and the comparison materially helps review

Capture rules:

1. Run the final branch build or dev server with stable non-sensitive fixture data.
2. Capture after all review fixes so images match the final HEAD.
3. Use the filename `<pr-unit>-<screen>-<viewport>-<state>.png`.
4. Check that screenshots contain no secrets, access tokens, personal email, production data, local paths, or unrelated windows.
5. Verify the same state with Agent Browser; a screenshot alone is not behavioral QA.
6. Add a `Screenshots` section to the PR body with captions stating route, viewport, state, and scenario.

Store temporary captures under `.pr-artifacts/<pr-unit>/`, which must remain untracked. Upload and embed them as PR attachments when the environment supports attachment upload. If attachment upload is unavailable, commit only the final optimized screenshots under `docs/delivery/evidence/<pr-unit>/` and link them from the PR; record that fallback in the PR body. A UI PR without visible final screenshots cannot become `ready_to_merge`.

## Pull request completion

Use `.github/pull_request_template.md`. A PR can be reported as `ready_to_merge` only when:

- the task plan/spec and requirement IDs are linked;
- implementation tests and fresh full validation are recorded;
- independent code review is `pass` with no open Critical/Important finding;
- independent QA is `pass`;
- required UI screenshots are embedded and match final HEAD;
- known limitations and rulings are disclosed;
- the Agent auto-merge checkbox remains prohibited and user merge remains pending.
