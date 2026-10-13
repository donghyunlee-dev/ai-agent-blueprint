import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const hookScript = path.resolve("scripts/codex-repo-hooks.py");

function runHookInRoot(projectRoot, event, input, state = undefined, pr = undefined) {
  try {
    const binDirectory = path.join(projectRoot, "bin");
    mkdirSync(binDirectory, { recursive: true });
    if (pr) {
      const ghPath = path.join(binDirectory, "gh");
      writeFileSync(ghPath, `#!/bin/sh\nprintf '%s' '${JSON.stringify(pr)}'\n`);
      chmodSync(ghPath, 0o755);
    }
    if (state) {
      const stateDirectory = path.join(projectRoot, ".codex", "state");
      mkdirSync(stateDirectory, { recursive: true });
      writeFileSync(path.join(stateDirectory, "pr-loop.json"), JSON.stringify(state));
    }

    const result = spawnSync("python3", [hookScript, event], {
      cwd: projectRoot,
      env: { ...process.env, CODEX_PROJECT_ROOT: projectRoot, PATH: `${binDirectory}:${process.env.PATH}` },
      input: JSON.stringify(input),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  } catch (error) {
    throw error;
  }
}

function runHook(event, input, state = undefined, pr = undefined) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "codex-hook-test-"));
  try {
    return runHookInRoot(projectRoot, event, input, state, pr);
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
    headSha: "abc123",
    codeReviewHeadSha: "abc123",
    qaHeadSha: "abc123",
    mergeAuthorizedAt: new Date().toISOString(),
  }, { baseRefName: "main", headRefOid: "abc123", statusCheckRollup: [] });

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

test("pretool hook blocks direct pushes to main and GitHub API merge calls", () => {
  for (const command of [
    "git push origin main",
    "git push origin HEAD:refs/heads/main",
    "git push origin +HEAD:main",
    "git -C /tmp/repo push origin HEAD:main",
    "git push origin :main",
    "git push --force-with-lease origin feature",
    "gh api --method PUT repos/example/repo/pulls/42/merge",
    "gh api graphql -f query=mutation{mergePullRequest}",
    "curl -X PUT https://api.github.com/repos/example/repo/pulls/42/merge",
  ]) {
    const output = JSON.parse(runHook("pretool", {
      tool_name: "Bash",
      tool_input: { command },
    }));
    assert.equal(output.hookSpecificOutput.permissionDecision, "deny", command);
  }
});

test("merge authorization is consumed once and cannot authorize a second invocation", () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "codex-hook-test-"));
  const state = {
    pullRequest: 42,
    baseBranch: "main",
    stage: "ready_to_merge",
    validation: "pass",
    codeReview: "pass",
    qa: "pass",
    mergeAuthorized: true,
    headSha: "abc123",
    codeReviewHeadSha: "abc123",
    qaHeadSha: "abc123",
    mergeAuthorizedAt: new Date().toISOString(),
  };
  const event = { tool_name: "Bash", tool_input: { command: "gh pr merge 42 --squash" } };
  const pr = { baseRefName: "main", headRefOid: "abc123", statusCheckRollup: [] };
  try {
    assert.equal(runHookInRoot(projectRoot, "pretool", event, state, pr), "");
    const repeated = JSON.parse(runHookInRoot(projectRoot, "pretool", event, undefined, pr));
    assert.equal(repeated.hookSpecificOutput.permissionDecision, "deny");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("pretool hook denies a stale PR head or review and QA evidence", () => {
  const state = {
    pullRequest: 42,
    baseBranch: "main",
    stage: "ready_to_merge",
    validation: "pass",
    codeReview: "pass",
    qa: "pass",
    mergeAuthorized: true,
    headSha: "abc123",
    codeReviewHeadSha: "abc123",
    qaHeadSha: "abc123",
    mergeAuthorizedAt: new Date().toISOString(),
  };
  const output = JSON.parse(runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }, state, { baseRefName: "main", headRefOid: "def456", statusCheckRollup: [] }));

  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
});

test("pretool hook denies expired merge authorization and unsuccessful GitHub checks", () => {
  const state = {
    pullRequest: 42,
    baseBranch: "main",
    stage: "ready_to_merge",
    validation: "pass",
    codeReview: "pass",
    qa: "pass",
    mergeAuthorized: true,
    headSha: "abc123",
    codeReviewHeadSha: "abc123",
    qaHeadSha: "abc123",
    mergeAuthorizedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
  };
  const expired = JSON.parse(runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }, state, { baseRefName: "main", headRefOid: "abc123", statusCheckRollup: [] }));
  assert.equal(expired.hookSpecificOutput.permissionDecision, "deny");

  state.mergeAuthorizedAt = new Date().toISOString();
  const failedCheck = JSON.parse(runHook("pretool", {
    tool_name: "Bash",
    tool_input: { command: "gh pr merge 42 --squash" },
  }, state, {
    baseRefName: "main",
    headRefOid: "abc123",
    statusCheckRollup: [{ __typename: "StatusContext", state: "FAILURE" }],
  }));
  assert.equal(failedCheck.hookSpecificOutput.permissionDecision, "deny");
});
