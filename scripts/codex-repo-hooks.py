#!/usr/bin/env python3
"""Repository-local Codex hooks for the PR development loop."""

import json
import os
import re
import subprocess
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows Codex hosts
    fcntl = None


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
GIT_MUTATION_COMMAND = re.compile(
    r"\bgit\b(?:\s+-C\s+\S+|\s+-c\s+\S+|\s+--git-dir(?:=\S+|\s+\S+)|\s+--work-tree(?:=\S+|\s+\S+))*\s+(?P<subcommand>push|merge)\b(?P<args>.*)",
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


@contextmanager
def merge_claim():
    state_path = project_root() / ".codex" / "state" / "pr-loop.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    lock = state_path.with_name("pr-loop.merge-claim")
    with lock.open("a+b") as handle:
        if fcntl is not None:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                yield False
                return
            try:
                yield True
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        else:  # pragma: no cover - Windows Codex hosts
            import msvcrt

            handle.seek(0)
            if handle.read(1) == b"":
                handle.seek(0)
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                yield False
                return
            try:
                yield True
            finally:
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def merge_is_allowed(command: str) -> bool:
    match = MERGE_COMMAND.fullmatch(command)
    if not match:
        return False
    try:
        requested_pr = int(match.group(1))
    except ValueError:
        return False

    with merge_claim() as claimed:
        if not claimed:
            return False
        return _merge_is_allowed(requested_pr, command)


def _merge_is_allowed(requested_pr: int, command: str) -> bool:
    state = load_state()

    if (
        requested_pr != state.get("pullRequest")
        or state.get("baseBranch") != "main"
        or state.get("stage") != "ready_to_merge"
        or state.get("validation") != "pass"
        or state.get("codeReview") != "pass"
        or state.get("qa") != "pass"
        or state.get("mergeAuthorized") is not True
    ):
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

    return True


def pretool_hook(event: dict) -> None:
    if event.get("tool_name") != "Bash":
        return
    tool_input = event.get("tool_input")
    command = tool_input.get("command", "") if isinstance(tool_input, dict) else ""
    if not isinstance(command, str):
        return

    local_merge = False
    direct_main_push = False
    force_push = False
    for segment in re.split(r"[\n;&|]+", command):
        for git_command in GIT_MUTATION_COMMAND.finditer(segment):
            args = git_command.group("args")
            if git_command.group("subcommand") == "merge":
                local_merge = True
            if git_command.group("subcommand") == "push":
                direct_main_push = direct_main_push or bool(
                    re.search(r"(?:^|\s|\+)(?:main|refs/heads/main)(?:\s|$)", args)
                    or re.search(r"(?::|\+[^\s:]+:)(?:\+)?(?:refs/heads/)?main(?:\s|$)", args)
                    or re.search(r"\s--(?:all|mirror)(?:\s|$)", args)
                )
                force_push = force_push or bool(
                    re.search(r"(?:^|\s)-f(?:\s|$)|(?:^|\s)--force(?:-with-lease)?(?:\s|$)", args)
                )
    api_merge = re.search(
        r"\bgh\s+api\b(?:(?![\n;&|]).)*(?:pulls/\d+/merge|git/refs/heads/main|\bmutation\b)",
        command,
    )
    curl_merge = re.search(
        r"\bcurl\b(?:(?![\n;&|]).)*api\.github\.com/repos/[^\s'\"]+/pulls/\d+/merge",
        command,
    )
    curl_graphql_mutation = re.search(
        r"\bcurl\b(?:(?![\n;&|]).)*api\.github\.com/graphql(?:(?![\n;&|]).)*\bmutation\b",
        command,
    )
    if local_merge or force_push or direct_main_push or api_merge or curl_merge or curl_graphql_mutation:
        reason = "Direct merges and force pushes are blocked by the repository PR workflow."
    elif re.search(r"\bgh\s+pr\s+merge\b", command):
        if merge_is_allowed(command):
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
