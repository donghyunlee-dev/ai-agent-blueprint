#!/usr/bin/env python3
"""Repository-local Codex hooks for the PR development loop."""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
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

    authorization_time = state.get("mergeAuthorizedAt")
    if not isinstance(authorization_time, str):
        return False
    try:
        authorized_at = datetime.fromisoformat(authorization_time.replace("Z", "+00:00"))
    except ValueError:
        return False
    now = datetime.now(timezone.utc)
    if authorized_at.tzinfo is None or authorized_at > now + timedelta(minutes=1):
        return False
    if now - authorized_at > timedelta(minutes=15):
        return False

    if not state.get("headSha") or state.get("codeReviewHeadSha") != state.get("headSha"):
        return False
    if state.get("qaHeadSha") != state.get("headSha"):
        return False

    try:
        result = subprocess.run(
            ["gh", "pr", "view", str(requested_pr), "--json", "baseRefName,headRefOid,statusCheckRollup"],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
        pull_request = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return False

    if pull_request.get("baseRefName") != "main" or pull_request.get("headRefOid") != state.get("headSha"):
        return False
    for check in pull_request.get("statusCheckRollup", []):
        if check.get("__typename") == "CheckRun":
            if check.get("status") != "COMPLETED" or check.get("conclusion") not in {"SUCCESS", "SKIPPED", "NEUTRAL"}:
                return False
        elif check.get("__typename") == "StatusContext":
            if check.get("state") != "SUCCESS":
                return False
        else:
            return False

    # Consume the short-lived authorization so stale state cannot authorize a second command.
    state["mergeAuthorized"] = False
    try:
        state_path = project_root() / ".codex" / "state" / "pr-loop.json"
        state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except OSError:
        return False

    return (
        requested_pr == state.get("pullRequest")
        and state.get("baseBranch") == "main"
        and state.get("stage") == "ready_to_merge"
        and state.get("validation") == "pass"
        and state.get("codeReview") == "pass"
        and state.get("qa") == "pass"
        and state.get("mergeAuthorized") is False
    )


def pretool_hook(event: dict) -> None:
    if event.get("tool_name") != "Bash":
        return
    tool_input = event.get("tool_input")
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not isinstance(command, str):
        return

    direct_main_push = re.search(
        r"\bgit\s+push\b(?:(?![\n;&|]).)*(?:(?:^|\s|\+)(?:main|refs/heads/main)(?:\s|$)|:[+]?(?:refs/heads/)?main(?:\s|$)|\+[^\s:]+:(?:refs/heads/)?main(?:\s|$)|\s--(?:all|mirror)(?:\s|$))",
        command,
    )
    force_push = re.search(r"\bgit\s+push\b(?:(?![\n;&|]).)*(?:\s-f(?:\s|$)|\s--force(?:-with-lease)?(?:\s|$))", command)
    api_merge = re.search(
        r"\bgh\s+api\b(?:(?![\n;&|]).)*(?:pulls/\d+/merge|git/refs/heads/main)",
        command,
    )
    if re.search(r"\bgit\s+merge\b", command) or force_push or direct_main_push or api_merge:
        reason = "Direct merges and force pushes are blocked by the repository PR workflow."
    elif re.search(r"\bgh\s+pr\s+merge\b", command):
        if merge_is_allowed(command, load_state()):
            return
        reason = (
            "PR merge requires the matching current main PR head, same-head validation, review and QA, "
            "successful configured checks, and a fresh one-time merge authorization."
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
