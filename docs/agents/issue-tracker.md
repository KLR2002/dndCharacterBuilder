# Issue tracker: local markdown

Specs and tickets are markdown files in the repo, under `.scratch/<feature-slug>/`. One directory per feature.

## Files

- **Spec**: `.scratch/<feature>/spec.md`. Starts with `# Spec: <title>` and a `**Status:**` line. An optional `inventory.md` beside it holds supporting research.
- **Ticket**: `.scratch/<feature>/issues/NN-<slug>.md`, numbered from `01`. One ticket per file.

## Ticket shape

```markdown
# NN: <title>

**What to build:** <the behaviour, in one paragraph>

**Blocked by:** None (can start immediately), or `NN, NN`

**Status:** ready-for-agent

- [ ] <observable criterion>
```

`**Status:**` holds a triage role from `triage-labels.md`, or `done` once closed.

## Operations

- **Create**: write a new `issues/NN-<slug>.md` with the next free number, in the shape above.
- **Read**: open the file. The spec sits in the same feature directory.
- **List**: `grep -l '^\*\*Status:\*\* ready-for-agent' .scratch/*/issues/*.md`, with the status you need.
- **Comment**: append under a `## Comments` heading at the bottom of the file. Add the heading on first use.
- **Close**: set `**Status:** done`, tick the criteria that passed, and add `**Landed:** <merge sha>, <what passed, open items>` below the status line. Older tickets use `closed` or `completed` for the same state.

## When a skill says "publish to the issue tracker"

Write the file under `.scratch/<feature>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the file at the path or number given, `.scratch/<feature>/issues/NN-*.md`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file, and each **child** is a ticket file.

- **Map**: `.scratch/<effort>/map.md`, with the Notes, Decisions-so-far and Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, with a `**Type:**` line (`research`, `prototype`, `grilling` or `task`) and a `**Status:**` of `claimed` or `resolved`.
- **Blocking**: the `**Blocked by:**` line. A ticket is unblocked when every ticket it lists is `resolved`.
- **Claim**: set `**Status:** claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `**Status:** resolved`, then add a gist and link to the map's Decisions-so-far.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_
