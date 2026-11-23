import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scriptSource = path.join(process.cwd(), "scripts", "clean-worktrees.sh");

// Temporary folders are removed when the file's tests finish.
const tempDirs: string[] = [];
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

// Drop GIT_* variables inherited from an enclosing git hook, so every git call acts on the
// temporary repository only.
const isolatedEnv = { ...process.env };
for (const key of Object.keys(isolatedEnv)) {
  if (key.startsWith("GIT_")) delete isolatedEnv[key];
}

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    encoding: "utf-8",
    env: isolatedEnv,
  });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

// A repository with the script copied into scripts/, as the real checkout has it.
function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "clean-worktrees-"));
  tempDirs.push(repo);
  git(repo, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "README.md"), "root\n");
  fs.mkdirSync(path.join(repo, "scripts"));
  fs.copyFileSync(scriptSource, path.join(repo, "scripts", "clean-worktrees.sh"));
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "root");
  return repo;
}

function addWorktree(repo: string, dir: string, branch: string): string {
  git(repo, "worktree", "add", "-q", "-b", branch, dir);
  return dir;
}

function commitFile(dir: string, file: string, text: string): void {
  fs.writeFileSync(path.join(dir, file), text);
  git(dir, "add", file);
  git(dir, "commit", "-q", "-m", `change ${file}`);
}

function mergeIntoMain(repo: string, ref: string): void {
  git(repo, "merge", "-q", "--no-edit", ref);
}

function runClean(repo: string, args: string[] = []) {
  return spawnSync("bash", ["scripts/clean-worktrees.sh", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: isolatedEnv,
  });
}

function branchExists(repo: string, branch: string): boolean {
  return git(repo, "branch", "--list", branch) !== "";
}

// An agent worktree under .claude/worktrees/ with one commit that is merged into main.
function mergedAgentWorktree(repo: string, name: string): string {
  const dir = addWorktree(repo, path.join(repo, ".claude", "worktrees", name), `worktree-${name}`);
  commitFile(dir, `${name}.txt`, "done\n");
  mergeIntoMain(repo, `worktree-${name}`);
  return dir;
}

test("clean-worktrees: a merged agent worktree is removed along with its branch", () => {
  const repo = makeRepo();
  const dir = mergedAgentWorktree(repo, "agent-merged");

  const result = runClean(repo);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^removed .*agent-merged \(worktree-agent-merged\)$/m);
  assert.equal(fs.existsSync(dir), false, "worktree folder should be gone");
  assert.equal(branchExists(repo, "worktree-agent-merged"), false, "branch should be deleted");
});

test("clean-worktrees: a detached merged worktree is removed and no branch is deleted", () => {
  const repo = makeRepo();
  const dir = path.join(repo, ".claude", "worktrees", "agent-detached");
  git(repo, "worktree", "add", "-q", "--detach", dir);
  commitFile(dir, "detached.txt", "done\n");
  const sha = git(dir, "rev-parse", "HEAD");
  mergeIntoMain(repo, sha);

  const result = runClean(repo);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^removed .*agent-detached$/m);
  assert.equal(fs.existsSync(dir), false, "worktree folder should be gone");
  assert.equal(branchExists(repo, "main"), true, "main must survive");
});

test("clean-worktrees: an unmerged agent worktree is kept and the output says not merged", () => {
  const repo = makeRepo();
  const dir = addWorktree(repo, path.join(repo, ".claude", "worktrees", "agent-unmerged"), "worktree-agent-unmerged");
  commitFile(dir, "unmerged.txt", "work\n");

  const result = runClean(repo);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^kept .*agent-unmerged: not merged$/m);
  assert.equal(fs.existsSync(dir), true, "worktree folder should stay");
  assert.equal(branchExists(repo, "worktree-agent-unmerged"), true, "branch should stay");
});

test("clean-worktrees: a merged agent worktree with an uncommitted file is kept", () => {
  const repo = makeRepo();
  const dir = mergedAgentWorktree(repo, "agent-dirty");
  fs.writeFileSync(path.join(dir, "scratch.txt"), "not committed\n");

  const result = runClean(repo);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^kept .*agent-dirty: uncommitted changes$/m);
  assert.equal(fs.existsSync(dir), true, "worktree folder should stay");
  assert.equal(branchExists(repo, "worktree-agent-dirty"), true, "branch should stay");
});

test("clean-worktrees: a merged worktree outside .claude/worktrees/ is never touched", () => {
  const repo = makeRepo();
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clean-worktrees-outside-"));
  tempDirs.push(outsideRoot);
  const dir = addWorktree(repo, path.join(outsideRoot, "outside-wt"), "worktree-outside");
  commitFile(dir, "outside.txt", "done\n");
  mergeIntoMain(repo, "worktree-outside");

  const result = runClean(repo);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /outside-wt/);
  assert.equal(fs.existsSync(dir), true, "worktree folder outside the agent folder should stay");
  assert.equal(branchExists(repo, "worktree-outside"), true, "its branch should stay");
});

test("clean-worktrees: --dry-run prints would remove and changes nothing", () => {
  const repo = makeRepo();
  const dir = mergedAgentWorktree(repo, "agent-dry");

  const result = runClean(repo, ["--dry-run"]);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^would remove .*agent-dry/m);
  assert.equal(fs.existsSync(dir), true, "worktree folder should stay");
  assert.equal(branchExists(repo, "worktree-agent-dry"), true, "branch should stay");
});

test("clean-worktrees: an unknown argument exits 2", () => {
  const repo = makeRepo();

  const result = runClean(repo, ["--bogus"]);

  assert.equal(result.status, 2, result.stdout + result.stderr);
});
