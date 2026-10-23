# 01: Agent boilerplate, worktree script and UI navigation

**What to build:** An implementer brief no longer restates the rules every brief repeats. The subagent tiering document holds, once, the rules for subagents: never skip the pre-commit hook, never edit the data folders by hand, how a commit message ends, and how a worktree is set up. A script prepares a fresh worktree (the dependency links for the app and the scraper) and verifies them. `AGENTS.md` gains one navigation line that says where the UI lives: the character tabs, the builder sections, the shared UI components, the header and the modals.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merged from `pr/01-agent-docs` (cf00945). Also changed `.gitignore` to ignore `node_modules` without a trailing slash so the script's symlinks are ignored. The install branch of the script (main checkout without node_modules) is untested.

- [ ] The tiering document has one section with the shared implementer rules, and `AGENTS.md` points to it.
- [ ] Running the worktree script in a fresh worktree makes `npm run check:all` runnable there without manual linking, and the script says so when a link is missing or wrong.
- [ ] `AGENTS.md` has one navigation line for the UI, with the folders for tabs, builder sections, shared components, the header and the modals; each named folder exists.
- [ ] `npm run check:all` passes.
