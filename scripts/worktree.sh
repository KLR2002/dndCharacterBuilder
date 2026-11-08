#!/usr/bin/env bash
# Prepares the git worktree this script runs from for the checks.
#
# A worktree starts at master, so the spec, tickets and ADRs of a feature are missing until the
# integration branch is merged in. The script merges it: a fast-forward for a fresh worktree, a
# merge commit for an implementer's branch that already has commits. A conflict stops the script
# with the merge left in progress for the agent to resolve.
#
# node_modules for the app root and for dnd5eToolsScrap are copied from the main checkout's, as
# copy-on-write reflinks (a plain copy where the filesystem has none), when those exist, and
# installed with `npm ci` when they do not. Metro cannot resolve a symlinked node_modules, so a
# worktree never links it; a symlink left by an older run is replaced by the copy. A real
# node_modules directory is left alone. Then the script confirms that `npm run typecheck` starts
# and that the scraper's tsx binary is present.
#
# Usage (from inside the worktree): scripts/worktree.sh <integration-branch>
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "$1" ]; then
  echo "usage: scripts/worktree.sh <integration-branch>" >&2
  exit 2
fi
branch="$1"

worktree="$(git rev-parse --show-toplevel)"
# The first entry of `git worktree list` is the main checkout, whichever checkout this runs from.
main_list="$(git worktree list --porcelain)"
main_root="${main_list#worktree }"
main_root="${main_root%%$'\n'*}"

failures=0

prepare_dir() {
  local rel="$1"
  local label="${rel:-.}"
  local dir="$worktree${rel:+/$rel}"
  local target="$dir/node_modules"
  local source="$main_root${rel:+/$rel}/node_modules"

  # A copy interrupted by an earlier run leaves its temporary sibling behind (see the copy below).
  rm -rf -- "$dir"/node_modules.copying-*

  if [ -L "$target" ]; then
    echo "replacing: $label/node_modules was a symlink to '$(readlink "$target")' (Metro cannot resolve it)"
    rm "$target"
  elif [ -d "$target" ]; then
    echo "note: $label/node_modules is a real directory, left in place"
    return
  fi

  if [ -d "$source" ]; then
    # Metro resolves a symlinked node_modules through its real path outside the project root and
    # fails on it, so the worktree gets its own copy. A reflink copy takes seconds on a copy-on-write
    # filesystem (btrfs here) and shares no inode with the main checkout, so a tool that rewrites a
    # file in the worktree cannot change the main checkout's copy, as a hard link would.
    # The copy goes into a temporary sibling that is moved into place once complete, so an
    # interrupted copy never leaves a partial node_modules.
    local partial="$dir/node_modules.copying-$$"
    if cp -a --reflink=always "$source" "$partial" 2>/dev/null; then
      echo "copied (reflink): $label/node_modules from $source"
    else
      rm -rf -- "$partial"
      cp -a "$source" "$partial"
      echo "copied (no reflink support, full copy): $label/node_modules from $source"
    fi
    mv "$partial" "$target"
  else
    echo "installing: no node_modules in the main checkout at $source, running npm ci in $label"
    (cd "$dir" && npm ci)
  fi
}

verify() {
  local name="$1"
  local ok="$2"
  if [ "$ok" = "yes" ]; then
    echo "verified: $name"
  else
    echo "FAILED: $name" >&2
    failures=$((failures + 1))
  fi
}

prepare_dir ""
prepare_dir "dnd5eToolsScrap"

if ! git rev-parse --verify --quiet "$branch^{commit}" >/dev/null; then
  echo "error: integration branch '$branch' does not exist in this repository" >&2
  exit 1
fi
if git merge-base --is-ancestor "$branch" HEAD; then
  echo "ok: $branch already merged"
elif git merge --no-edit "$branch"; then
  echo "ok: merged $branch"
else
  echo "merge of $branch failed: resolve the conflict, then rerun" >&2
  exit 1
fi

# `--version` makes tsc print its version and exit, so this checks that npm and tsc start
# without running the full typecheck.
if (cd "$worktree" && npm run --silent typecheck -- --version >/dev/null 2>&1); then
  verify "npm run typecheck starts" yes
else
  verify "npm run typecheck starts (run it in $worktree to see the error)" no
fi

if [ -e "$worktree/dnd5eToolsScrap/node_modules/.bin/tsx" ]; then
  verify "dnd5eToolsScrap tsx binary present" yes
else
  verify "dnd5eToolsScrap tsx binary present (dnd5eToolsScrap/node_modules is missing tsx)" no
fi

if [ "$failures" -gt 0 ]; then
  echo "worktree not ready: $failures check(s) failed" >&2
  exit 1
fi
echo "worktree ready: run npm run check:all"
