#!/usr/bin/env bash
# Prepares the git worktree this script runs from for the checks.
#
# node_modules for the app root and for dnd5eToolsScrap are linked to the main checkout's copies
# when those exist, and installed with `npm ci` when they do not. A link that points elsewhere or
# dangles is re-pointed. A real node_modules directory is left alone. Last, the script confirms
# that `npm run typecheck` starts and that the scraper's tsx binary is present.
#
# Usage (from inside the worktree): scripts/worktree.sh
set -euo pipefail

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

  if [ -L "$target" ]; then
    local current
    current="$(readlink "$target")"
    if [ "$current" = "$source" ] && [ -d "$target" ]; then
      echo "ok: $label/node_modules is linked to $source"
      return
    fi
    rm "$target"
    echo "relinking: $label/node_modules pointed to '$current' (dangling or wrong)"
  elif [ -d "$target" ]; then
    echo "note: $label/node_modules is a real directory, left in place"
    return
  fi

  if [ -d "$source" ]; then
    ln -s "$source" "$target"
    echo "linked: $label/node_modules -> $source"
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
