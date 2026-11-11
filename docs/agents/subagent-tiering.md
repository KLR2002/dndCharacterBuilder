# Subagent Model Tiering

How to allocate model tiers when invoking subagents to conserve tokens and prevent quota exhaustion.

## Tier Allocation Matrix

- **Main session**: analysis, diagnosis, briefs, merging. It verifies every implementer's output itself: read the diff, run `npm run check:all`, and look at the running app for UI work.
- **Implementers**: Haiku (`model: "haiku"`), one per ticket, in its own worktree. The brief carries the analysis: exact files, the seam to test, the acceptance criteria. An implementer writes its own code and never spawns further agents; say so in the brief.
- **Mistral Large 4, only when the user asks for it**: a T3 delegate (`delegate_task`, provider `acpRegistry_mistral_vibe`, model `mistral-large-4-0-3`, `isolation: "worktree"`). Pass `options.mode: "auto-approve"`: the default mode stops on every shell command and the child stalls. It has no Skill tool, so the brief spells out the red-green steps in words.
- **Brief contents**: the ticket path, the integration branch, the commit trailer, the verified facts (files, lines, the seam), and a pointer to "Implementer Rules" below. Every rule in that section reaches the implementer through the pointer, so the brief carries only what is specific to the ticket.
- **Reviewers**: Sonnet (`model: "sonnet"`), including the sub-agents of the `code-review` skill.
- **Research and grep legwork**: the cheapest tier (an Explore agent, or Haiku) with a focused, bounded prompt: pass exact file lists and target diff filters rather than open-ended scans.

## Implementer Rules

Every implementation brief points here instead of restating these rules.

### Git

- Never use `--no-verify`. The pre-commit hook runs `npm run check:all` and skips it only when every staged file is Markdown. If it fails, fix the cause.
- Run `npx eslint --fix <changed files>` before each commit: style rules such as `@typescript-eslint/array-type` fix themselves, and a lint failure costs a full hook run.
- Run each git command on its own, from the worktree root, with no `cd` prefix and no `&&` chain. The worktree isolation guard refuses any command it cannot confirm stays inside the worktree.
- Set work aside with a temporary WIP commit, not `git stash`: the stash stack is shared by every worktree and session.
- Commit in small steps, one logical change per commit, and commit after every slice (a WIP commit is fine). A session that stops cannot be resumed, so the branch holds the work and a fresh implementer continues from it.
- The session supplies the `Co-Authored-By` trailer. Each commit message ends with the trailer line given in your task, exactly as written there. Do not choose or edit it.
- The pre-commit hook runs `npm run check:all` on every commit, so it covers the intermediate ones. Run it yourself once, at the end: merge the current tip of the integration branch named in your task into your branch, resolve conflicts keeping both sides' intent, run `npm run check:all`, then report.
- Do not merge into the integration branch and do not close the ticket. The main session does both.

### Setup

- Run `scripts/worktree.sh <integration-branch>` from inside a fresh worktree, before reading the ticket. A worktree starts at `master`, so the spec, the tickets and the ADRs of the feature are missing until the script merges the integration branch named in your task. It also gives the app root and `dnd5eToolsScrap/` their own `node_modules`, copied from the main checkout as reflinks (a plain copy where the filesystem has none) or installed with `npm ci` when the main checkout has none. A symlink left by an older run is replaced by the copy, a real directory is left alone, and the copy is moved into place only when complete. It confirms that `npm run typecheck` starts. It exits non-zero and names the failing check when the worktree is not ready.
- Run commands in the foreground. A command that can take longer than 300 seconds (a Gradle build, an emulator run of `npm run layout:android`) starts in the background with its output in a result file, and you wait for its completion notice instead of polling with `sleep`. Stop everything you started before you report.
- Give each command a timeout sized to what it takes, not the maximum: 30 seconds for reading and git commands, 120 seconds for `npm run check:all` (about a minute) and for a `git commit` (the hook runs it), 300 seconds for `scripts/worktree.sh`, 300 seconds for a scoped layout check. A command that hits its timeout has hung or failed: read its output and fix the cause, do not rerun it with a longer one.
- A command that outlives its timeout is moved to the background by the harness: never poll it with `sleep` loops. Wait for its result by running it again with the right timeout, never by sleeping.
- Do not run `npm run check:all` by itself before a commit: the hook runs it. Run `scripts/worktree.sh <integration-branch>` once per worktree.
- Run layout checks only when the ticket changes UI or the layout script, and only **scoped**: the scenarios your change touches, on one width (`ONLY=equipment WIDTHS=320 npm run layout:check`, well under a minute), plus `WIDTHS=768` or `WIDTHS=1280` when the change affects wide layouts, and `-- --integrated` when it touches catalog readers. Add the scenarios a new check needs to `ONLY`. Never run the full unscoped suite: the main session runs it once, at the gate, after review. The script starts and stops its own Expo web server; give each run its own port and screenshot folder. Never use `pkill -f` with a pattern that appears in your own command line.

### Rules

- Use the `tdd` skill: write the failing test first at the seam the ticket names, watch it fail, then implement. The report pastes that failing output before it describes the fix.
- Never edit `src/data/` or `dnd5eToolsScrap/data/` by hand. The sanctioned ways to change them are `node scripts/prune-to-srd.mjs` (in its own commit), `npm --prefix dnd5eToolsScrap run enrich:grants`, and a scraper run only when the ticket says so.
- Never hand-record a characterization baseline or allowlist (`checks/fixtures/*Baseline*.json`, `*Allowlist.json`). Re-record one only through its recorder environment variable (`UPDATE_PROFICIENCY_SHEET_BASELINE`, `UPDATE_WEAPONS_ARMOR_BASELINE`, `UPDATE_SAVES_BASELINE`, `UPDATE_SKILLS_BASELINE`, `UPDATE_SUBCLASS_CHOICE_BASELINE`), and only when the ticket expects a behavior change. Review and explain every changed row in your report.
- Use no real 5e rules prose in new files, tests or fixtures. Invent names and sentences.
- Interface copy carries only essential mechanic descriptions (`CODING_STANDARDS.md` section 8).
- Source comments describe the code as it is. Do not write ticket numbers, slice numbers or `.scratch` references in them.
- Do not widen scope beyond the ticket. Report adjacent problems instead of fixing them.
- Timebox debugging: when a change breaks a check and two fix attempts have not made it pass, restore the previous behaviour at that site with a comment naming what you tried, list it in your report, and move on.
