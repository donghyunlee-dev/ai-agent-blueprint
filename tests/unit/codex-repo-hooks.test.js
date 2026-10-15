import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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
    "git push origin feature; git push origin main",
    "git push origin feature && git push origin HEAD:refs/heads/main",
    "git -C /repo merge main",
    "GIT=git; $GIT push origin main",
    "bash -c 'git push origin main'",
    "python3 -c 'import subprocess; subprocess.run([\"git\",\"push\",\"origin\",\"main\"])'",
    "node -e \"require('child_process').execFile('git',['push','origin','main'])\"",
    "node -e \"require('child_process').spawn('git',['push','origin','HEAD:refs/heads/main'])\"",
    "git push origin :main",
    "git push --force-with-lease origin feature",
    "gh api --method PUT repos/example/repo/pulls/42/merge",
    "gh api graphql -f query=mutation{mergePullRequest}",
    "curl -X PUT https://api.github.com/repos/example/repo/pulls/42/merge",
    "curl https://api.github.com/graphql -d '{\"query\":\"mutation{mergePullRequest}\"}'",
  ]) {
    const raw = runHook("pretool", {
      tool_name: "Bash",
      tool_input: { command },
    });
    assert.notEqual(raw, "", command);
    const output = JSON.parse(raw);
    assert.equal(output.hookSpecificOutput.permissionDecision, "deny", command);
  }
});

test("pretool hook allows routine read-only git inspection commands", () => {
  for (const command of ["git status --short", "git diff --check", "git log -1 --oneline"]) {
    const output = runHook("pretool", {
      tool_name: "Bash",
      tool_input: { command },
    });
    assert.equal(output, "", command);
  }
});

test("pretool hook blocks configured and command-scoped Git mutation aliases", () => {
  for (const command of [
    "git -c alias.p=push p origin main",
    "git -c alias.p\\=push p origin main",
    "GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.p GIT_CONFIG_VALUE_0=push git p origin main",
  ]) {
    const scoped = JSON.parse(runHook("pretool", {
      tool_name: "Bash",
      tool_input: { command },
    }));
    assert.equal(scoped.hookSpecificOutput.permissionDecision, "deny", command);
  }

  const projectRoot = mkdtempSync(path.join(tmpdir(), "codex-hook-test-"));
  try {
    const init = spawnSync("git", ["init", "-q"], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    const config = spawnSync("git", ["config", "alias.p", "push"], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(config.status, 0, config.stderr);
    const output = JSON.parse(runHookInRoot(projectRoot, "pretool", {
      tool_name: "Bash",
      tool_input: { command: "git p origin main" },
    }));
    assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
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

test("concurrent merge checks cannot consume the same authorization twice", async () => {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "codex-hook-test-"));
  const binDirectory = path.join(projectRoot, "bin");
  mkdirSync(path.join(projectRoot, ".codex", "state"), { recursive: true });
  mkdirSync(binDirectory);
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
  writeFileSync(path.join(projectRoot, ".codex", "state", "pr-loop.json"), JSON.stringify(state));
  const ghPath = path.join(binDirectory, "gh");
  writeFileSync(ghPath, "#!/bin/sh\nsleep 0.2\nprintf '%s' '{\"baseRefName\":\"main\",\"headRefOid\":\"abc123\",\"statusCheckRollup\":[]}'\n");
  chmodSync(ghPath, 0o755);

  const invoke = () => new Promise((resolve, reject) => {
    const child = spawn("python3", [hookScript, "pretool"], {
      cwd: projectRoot,
      env: { ...process.env, CODEX_PROJECT_ROOT: projectRoot, PATH: `${binDirectory}:${process.env.PATH}` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr)));
    child.stdin.end(JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "gh pr merge 42 --squash" },
    }));
  });

  try {
    const results = await Promise.all([invoke(), invoke()]);
    assert.equal(results.filter((result) => result === "").length, 1);
    assert.equal(results.filter((result) => result !== "" && JSON.parse(result).hookSpecificOutput.permissionDecision === "deny").length, 1);
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
