import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const hookScript = path.resolve("scripts/codex-repo-hooks.py");

function runHook(event, input, state = undefined) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "codex-hook-test-"));
  try {
    if (state) {
      const stateDirectory = path.join(projectRoot, ".codex", "state");
      mkdirSync(stateDirectory, { recursive: true });
      writeFileSync(path.join(stateDirectory, "pr-loop.json"), JSON.stringify(state));
    }

    const result = spawnSync("python3", [hookScript, event], {
      cwd: projectRoot,
      env: { ...process.env, CODEX_PROJECT_ROOT: projectRoot },
      input: JSON.stringify(input),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

test("prompt hook routes repo implementation requests to the PR loop skill", () => {
  const output = JSON.parse(runHook("prompt", { prompt: "이 기능을 구현해줘" }));
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /pr-development-loop/);
});

test("pretool hook blocks merge commands unless all loop gates pass", () => {
  const output = JSON.parse(runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }));
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
});

test("pretool hook allows the requested PR merge only at ready_to_merge with passed gates", () => {
  const output = runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }, {
    pullRequest: 42,
    baseBranch: "main",
    stage: "ready_to_merge",
    validation: "pass",
    codeReview: "pass",
    qa: "pass",
    mergeAuthorized: true,
  });

  assert.equal(output, "");
});

test("pretool hook still blocks merge when any gate failed", () => {
  const output = JSON.parse(runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }, {
    pullRequest: 42,
    baseBranch: "main",
    stage: "ready_to_merge",
    validation: "pass",
    codeReview: "pass",
    qa: "fail",
    mergeAuthorized: true,
  }));

  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
});
