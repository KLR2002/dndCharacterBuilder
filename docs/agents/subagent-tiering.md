# Subagent Model Tiering

How to allocate model tiers when invoking subagents to conserve tokens and prevent quota exhaustion.

## Tier Allocation Matrix

- **`flash`**: Use for research subagents conducting codebase searches, file reading, AST surveying, documentation lookups, and grep legwork.
- **`pro` / `inherit`**: Reserve for implementation subagents, complex multi-file refactoring, architectural synthesis, and two-axis review aggregation.

## Guidelines

- Never launch broad whole-repo exploration on `pro` tier.
- Keep exploration prompts focused and bounded: pass exact file lists and target diff filters rather than open-ended scans.

## Implementer Rules

Every implementation brief points here instead of restating these rules.

### Git

- Never use `--no-verify`. The pre-commit hook runs `npm run check:all` and skips it only when every staged file is Markdown. If it fails, fix the cause.
- Set work aside with a temporary WIP commit, not `git stash`: the stash stack is shared by every worktree and session.
- Commit in small steps, one logical change per commit.
- The session supplies the `Co-Authored-By` trailer. Each commit message ends with the trailer line given in your task, exactly as written there. Do not choose or edit it.
- Before reporting, merge the current tip of the integration branch named in your task into your branch, resolve conflicts keeping both sides' intent, and re-run `npm run check:all`.
- Do not merge into the integration branch and do not close the ticket. The main session does both.

### Setup

- Run `scripts/worktree.sh` from inside a fresh worktree before any check. It links `node_modules` for the app root and for `dnd5eToolsScrap/` to the main checkout (or installs them when the main checkout has none), re-points a wrong or dangling link, and confirms that `npm run typecheck` starts. It exits non-zero and names the failing check when the worktree is not ready.
- Run layout checks (`npm run layout:check`, and `-- --integrated` for the integrated catalog) only when the ticket changes UI or the layout script. Give each run its own port and screenshot folder, and stop the Expo servers you started. Never use `pkill -f` with a pattern that appears in your own command line.

### Rules

- Use the `tdd` skill: write the failing test first at the seam the ticket names, watch it fail, then implement.
- Never edit `src/data/` or `dnd5eToolsScrap/data/` by hand. The sanctioned ways to change them are `node scripts/prune-to-srd.mjs` (in its own commit), `npm --prefix dnd5eToolsScrap run enrich:grants`, and a scraper run only when the ticket says so.
- Never hand-record a characterization baseline or allowlist (`checks/fixtures/*Baseline*.json`, `*Allowlist.json`). Re-record one only through its recorder environment variable (`UPDATE_PROFICIENCY_SHEET_BASELINE`, `UPDATE_WEAPONS_ARMOR_BASELINE`, `UPDATE_SAVES_BASELINE`, `UPDATE_SKILLS_BASELINE`, `UPDATE_SUBCLASS_CHOICE_BASELINE`), and only when the ticket expects a behavior change. Review and explain every changed row in your report.
- Use no real 5e rules prose in new files, tests or fixtures. Invent names and sentences.
- Interface copy carries only essential mechanic descriptions (`CODING_STANDARDS.md` section 8).
- Source comments describe the code as it is. Do not write ticket numbers, slice numbers or `.scratch` references in them.
- Do not widen scope beyond the ticket. Report adjacent problems instead of fixing them.
