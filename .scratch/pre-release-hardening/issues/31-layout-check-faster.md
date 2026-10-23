# 31: The layout check runs its widths in parallel and can run one scenario

**What to build:** Retro finding. A full `npm run layout:check` takes about 8 minutes (one width: 148 s, 36 screenshots), and implementers run it 3 to 5 times per UI ticket, so it is most of a UI ticket's time. Two changes to `scripts/layout-check.mjs`, no change to what it checks:

1. **Widths in parallel.** The four widths (`WIDTHS`, default 393, 360, 320, 412) each use their own browser context against the one Expo server, so run them concurrently (`Promise.all` over the widths) instead of one after another. Output lines already carry the width in their prefix; keep each width's output readable (collect a width's lines and print them together when it finishes, or keep the prefix on every line). The exit code stays non-zero if any width has a violation. Screenshots keep their names. Target: a full run of about 3 minutes.
2. **Run one scenario.** Add an `ONLY` environment variable: a comma-separated list of substrings; only scenarios whose name contains one of them (case-insensitive) are visited, in every width. `ONLY=equipment WIDTHS=320 npm run layout:check` should finish in well under a minute. With `ONLY` unset nothing changes. A value that matches no scenario is an error (non-zero exit, a message listing the available names), so a typo is not a green run.

**Blocked by:** None

**Status:** ready-for-agent

## Design notes

- Read the whole script first. State shared between widths (the `state.route` per page, the seeded characters, any module-level variables, the screenshots folder) must stay per width; seeding (characters, catalog) happens through each context's storage, check it is not shared mutably. If two contexts cannot run safely at once for some scenario, say which and why instead of guessing.
- Measure before and after on the same machine and report both numbers: the full run (`npm run layout:check`, SRD baseline), the full integrated run (`-- --integrated`), and `ONLY=equipment WIDTHS=320`. Use your own port and screenshot folder (`BASE=http://localhost:<port> SHOTS=/tmp/<folder>`); use ports 8181 and 8182 so you do not collide with another run.
- The results must be the same: run the check on the unchanged script first and save which scenario names were visited and the final line; after the change the visited set per width and the verdict are the same. Introduce one deliberate violation (for example a scenario expectation that cannot hold, in a temporary uncommitted edit) to see that a failure in one width still gives a non-zero exit, then remove it.
- Update the layout line in `AGENTS.md` Verification and the Implementer Rules line in `docs/agents/subagent-tiering.md` with the measured full-run time, and name `ONLY`. Keep it one sentence each. In `docs/agents/driving-the-app.md` add `ONLY`/`WIDTHS` next to where the layout script is described, if it is described there.
- Command timeouts for this ticket (the tiering rules): 600 s for a full layout run, 300 s for a one-width run, never poll with `sleep`.

## Acceptance criteria

- [ ] A full run takes about 3 minutes (report the measured time), with the same scenarios visited and the same verdict as before.
- [ ] `ONLY=<name>` runs only the matching scenarios; an unknown name exits non-zero with the available names.
- [ ] A violation in any one width still fails the run.
- [ ] `npm run check:all`, `npm run layout:check` and `npm run layout:check -- --integrated` pass.
