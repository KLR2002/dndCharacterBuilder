import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const hookPath = path.join(process.cwd(), ".githooks", "pre-commit");

// Drop GIT_* variables inherited from an enclosing git hook (GIT_INDEX_FILE points at
// the real index), so every git call here acts on the temporary repository only.
const isolatedEnv: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !entry[0].startsWith("GIT_")
  )
);

function runHook(stagedFiles: Record<string, string>, env: Record<string, string>) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "precommit-hook-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: repo, encoding: "utf-8", env: isolatedEnv });
    assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
  };
  git("init", "-q");
  git("config", "user.email", "hook-test@example.invalid");
  git("config", "user.name", "Hook Test");
  for (const [file, content] of Object.entries(stagedFiles)) {
    const fullPath = path.join(repo, file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    git("add", file);
  }
  const result = spawnSync("bash", [hookPath], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...isolatedEnv, CHECK_CMD: "", GLOSSARY_CHECK_CMD: "", ...env },
  });
  fs.rmSync(repo, { recursive: true, force: true });
  return result;
}

test("pre-commit hook: a Markdown-only commit that stages GLOSSARY.md runs the glossary check", () => {
  const result = runHook(
    { "GLOSSARY.md": "_Avoid_: stub term\n", "docs/notes.md": "notes\n" },
    { CHECK_CMD: "exit 3", GLOSSARY_CHECK_CMD: "echo glossary-stub-failed; exit 4" }
  );
  assert.equal(result.status, 4, result.stdout + result.stderr);
  assert.match(result.stdout, /glossary-stub-failed/);
});

test("pre-commit hook: a Markdown-only commit that stages GLOSSARY.md passes when the glossary check passes", () => {
  const result = runHook(
    { "GLOSSARY.md": "_Avoid_: stub term\n" },
    { CHECK_CMD: "exit 3", GLOSSARY_CHECK_CMD: "true" }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("pre-commit hook: a Markdown-only commit without GLOSSARY.md is skipped", () => {
  const result = runHook(
    { "docs/notes.md": "notes\n", "README.md": "readme\n" },
    { CHECK_CMD: "exit 3", GLOSSARY_CHECK_CMD: "exit 4" }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /checks skipped/);
});

test("pre-commit hook: a commit with a non-Markdown file runs CHECK_CMD", () => {
  const result = runHook(
    { "GLOSSARY.md": "_Avoid_: stub term\n", "src/thing.ts": "export {};\n" },
    { CHECK_CMD: "exit 3", GLOSSARY_CHECK_CMD: "true" }
  );
  assert.equal(result.status, 3, result.stdout + result.stderr);
});
