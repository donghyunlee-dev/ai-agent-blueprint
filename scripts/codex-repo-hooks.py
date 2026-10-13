#!/usr/bin/env python3
"""Repository-local Codex hooks for the PR development loop."""

import json
import os
import re
import sys
from pathlib import Path


WORKFLOW_CONTEXT = (
    "For repository changes, use the $pr-development-loop skill and follow "
    "docs/delivery/development-pr-review-qa-workflow.md. Read docs/template/README.md "
    "before UI work. Do not skip validation, independent review, or QA."
)
IMPLEMENTATION_TERMS = re.compile(
    r"\b(implement|build|change|modify|fix|refactor|feature|bug|pr|pull request)\b"
    r"|구현|만들|수정|변경|고쳐|리팩터|기능|버그|개발|작업",
    re.IGNORECASE,
)
MERGE_COMMAND = re.compile(
    r"^\s*gh\s+pr\s+merge\s+(\d+)"
    r"(?:\s+--(?:squash|merge|rebase|delete-branch|auto))*\s*$"
)


def project_root() -> Path:
    override = os.environ.get("CODEX_PROJECT_ROOT")
    if override:
        return Path(override).resolve()
    return Path.cwd().resolve()


def load_input() -> dict:
    try:
        value = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError):
        return {}
    return value if isinstance(value, dict) else {}


def load_state() -> dict:
    state_path = project_root() / ".codex" / "state" / "pr-loop.json"
    try:
        value = json.loads(state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def emit(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False))


def prompt_hook(event: dict) -> None:
    prompt = event.get("prompt", "")
    if not isinstance(prompt, str) or not IMPLEMENTATION_TERMS.search(prompt):
        return

    state = load_state()
    status = ""
    if state.get("stage"):
        status = f" Current PR loop stage: {state['stage']}."
    emit(
        {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": WORKFLOW_CONTEXT + status,
            }
        }
    )


def merge_is_allowed(command: str, state: dict) -> bool:
    match = MERGE_COMMAND.fullmatch(command)
    if not match:
        return False
    try:
        requested_pr = int(match.group(1))
    except ValueError:
        return False

    return (
        requested_pr == state.get("pullRequest")
        and state.get("baseBranch") == "main"
        and state.get("stage") == "ready_to_merge"
        and state.get("validation") == "pass"
        and state.get("codeReview") == "pass"
        and state.get("qa") == "pass"
        and state.get("mergeAuthorized") is True
    )


def pretool_hook(event: dict) -> None:
    if event.get("tool_name") != "Bash":
        return
    tool_input = event.get("tool_input")
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not isinstance(command, str):
        return

    if re.search(r"\bgit\s+merge\b|\bgit\s+push\s+(?:[^\n]*\s)?(?:-f|--force)\b", command):
        reason = "Direct merges and force pushes are blocked by the repository PR workflow."
    elif re.search(r"\bgh\s+pr\s+merge\b", command):
        if merge_is_allowed(command, load_state()):
            return
        reason = (
            "PR merge requires the matching main PR to be ready_to_merge, with validation, "
            "independent code review, and QA all passing and mergeAuthorized=true."
        )
    else:
        return

    emit(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }
    )


def main() -> None:
    event_name = sys.argv[1] if len(sys.argv) > 1 else ""
    event = load_input()
    if event_name == "session-start":
        print(WORKFLOW_CONTEXT)
    elif event_name == "prompt":
        prompt_hook(event)
    elif event_name == "pretool":
        pretool_hook(event)


if __name__ == "__main__":
    main()
