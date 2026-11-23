# 01: A script removes the agent worktrees already merged

**What to build:**

- **The problem.** Every implementer runs in a `.claude/worktrees/agent-*` worktree and commits there, so the Agent tool keeps the worktree. By 2026-11-22 there were 30 of them (32 GB). Nothing removes them after their branch is merged.
- **The fix.** A new `scripts/clean-worktrees.sh [--dry-run]`, in the style of `scripts/stop-dev.sh` (`set -euo pipefail`, a `usage` for `-h`/`--help`, exit 2 on an unknown argument). The repo root is the script's parent folder.
  - It reads `git worktree list --porcelain` and handles only worktrees whose path is under `<root>/.claude/worktrees/`. It never touches any other worktree, such as `~/.t3/worktrees/…`, or the main checkout.
  - It removes a worktree when its commit is in HEAD (`git merge-base --is-ancestor <commit> HEAD`) and `git -C <path> status --porcelain` prints nothing. Removal is `git worktree remove <path>`, then `git branch -D <branch>` when the worktree has a branch. A detached worktree has no branch to delete.
  - It keeps every other worktree and prints one line for each: `kept <path>: not merged` or `kept <path>: uncommitted changes`.
  - It prints `removed <path> (<branch>)` for each removal. With `--dry-run` it prints `would remove …` and changes nothing.
  - It ends with `git worktree prune`, which `--dry-run` skips, and exits 0.

**Blocked by:** None

**Status:** done

**Landed:** merge 71b64ad8 (2580e734). Run for real on this repo: it removed the two worktrees of this ticket's own implementers and their branches, and left `~/.t3/worktrees/…` alone. `docs/agents/subagent-tiering.md` tells the main session to run it after each merge.

- [x] `checks/cleanWorktrees.test.ts`, red first (`node:test`, like the other checks). Each test builds a throwaway git repo in a temp folder, copies the script into `<tmp>/scripts/` and runs it with `bash` from there. Use `git -c user.name=t -c user.email=t@t` for commits.
  - A merged agent worktree is removed along with its branch.
  - An unmerged one (a commit that is not in HEAD) is kept, and the output says `not merged`.
  - A merged one with an uncommitted file is kept, and the output says `uncommitted changes`.
  - A merged worktree outside `.claude/worktrees/` is kept, with no output line for it.
  - `--dry-run` prints `would remove` and leaves every worktree and branch in place.
  - An unknown argument exits 2.
- [x] `npm run check:all` passes.
