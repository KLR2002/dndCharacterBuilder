# Briefing for implementers (read first)

You are an implementer. You write your own code and never spawn further agents. You work in your own worktree on your own branch, based on the integration branch `spec/proficiency-sheet`; confirm that before starting, and reset onto it if it is not.

Read: `.scratch/proficiency-sheet/spec.md`, your ticket, `GLOSSARY.md`, `docs/adr/0015-proficiency-grants-live-in-the-catalog.md`, `CODING_STANDARDS.md` (sections 1, 3, 4, 7, 8), `AGENTS.md`.

Standing constraints:
- Call the Skill tool with `tdd` and build test first, one slice at a time.
- No real 5e prose in new files or fixtures; invent wording.
- Do not edit `src/data/` or `dnd5eToolsScrap/data/` by hand. Only the ticket that says so regenerates `src/data/`, through `node scripts/prune-to-srd.mjs`.
- Never hand-record a characterization baseline; use the recorder pattern (see the subclass choice baseline).
- Interface copy carries only labels and essential mechanics; no explanatory notes.
- Layouts are fluid (`CODING_STANDARDS.md` section 7); UI changes need `npm run layout:check`, in both modes where the ticket says so.
- `npm run check:all` must pass. Never use `--no-verify`.
- Commit messages end with `Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>`.
- Before reporting done, merge the integration branch tip into your branch and re-run `npm run check:all`.
- Report: commit sha, what passed, anything you deviated from or left open. Do not close tickets; the main session does.
