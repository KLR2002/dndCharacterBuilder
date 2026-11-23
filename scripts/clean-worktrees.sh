#!/usr/bin/env bash
# Removes the agent worktrees under .claude/worktrees/ that are merged into HEAD and have no
# uncommitted changes, deleting their branches. Every other worktree is kept and listed with
# the reason. Then prunes the worktree records.
set -euo pipefail

usage() {
  cat <<'EOF'
usage: scripts/clean-worktrees.sh [--dry-run]

Removes each worktree under .claude/worktrees/ whose commit is in HEAD and that has no
uncommitted changes, then deletes its branch. Other worktrees are kept, with the reason.
--dry-run prints what would be removed and changes nothing.

Exit status: 0 when done, 2 on a bad argument.
EOF
}

dry_run=0
while (($# > 0)); do
  case "$1" in
    --dry-run)
      dry_run=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "clean-worktrees: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
agents_dir="$root/.claude/worktrees"

# Handles one worktree record: $1 path, $2 branch (empty when detached), $3 commit.
process_record() {
  local path="$1" branch="$2" sha="$3" label

  # Only the agent worktrees are ours to remove.
  case "$path" in
    "$agents_dir"/*) ;;
    *) return 0 ;;
  esac

  # A worktree whose folder is already gone is left for `git worktree prune`.
  if [[ ! -d "$path" ]]; then
    return 0
  fi

  if ! git -C "$root" merge-base --is-ancestor "$sha" HEAD; then
    echo "kept $path: not merged"
    return 0
  fi
  if [[ -n "$(git -C "$path" status --porcelain)" ]]; then
    echo "kept $path: uncommitted changes"
    return 0
  fi

  label="$path"
  if [[ -n "$branch" ]]; then
    label="$path ($branch)"
  fi

  if ((dry_run)); then
    echo "would remove $label"
    return 0
  fi

  if ! git -C "$root" worktree remove "$path"; then
    echo "kept $path: git refused to remove it"
    return 0
  fi
  if [[ -n "$branch" ]]; then
    git -C "$root" branch -D "$branch" >/dev/null
  fi
  echo "removed $label"
}

# Reads the records of `git worktree list --porcelain`, which are separated by blank lines.
records="$(git -C "$root" worktree list --porcelain)"
path=""
branch=""
sha=""
flush() {
  if [[ -n "$path" ]]; then
    process_record "$path" "$branch" "$sha"
  fi
  path=""
  branch=""
  sha=""
}
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    "worktree "*) path="${line#worktree }" ;;
    "HEAD "*) sha="${line#HEAD }" ;;
    "branch refs/heads/"*) branch="${line#branch refs/heads/}" ;;
    "") flush ;;
  esac
done <<<"$records"
flush

if ((dry_run == 0)); then
  git -C "$root" worktree prune
fi
exit 0
