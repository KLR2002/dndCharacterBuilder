# 31: The layout check runs its widths in parallel and can run one scenario

**What to build:** Retro finding. A full `npm run layout:check` takes about 8 minutes (one width: 148 s, 36 screenshots), and implementers run it 3 to 5 times per UI ticket, so it is most of a UI ticket's time. Two changes to `scripts/layout-check.mjs`, no change to what it checks:

1. **Widths in parallel.** The four widths (`WIDTHS`, default 393, 360, 320, 412) each use their own browser context against the one Expo server, so run them concurrently (`Promise.all` over the widths) instead of one after another. Output lines already carry the width in their prefix; keep each width's output readable (collect a width's lines and print them together when it finishes, or keep the prefix on every line). The exit code stays non-zero if any width has a violation. Screenshots keep their names. Target: a full run of about 3 minutes.
2. **Run one scenario.** Add an `ONLY` environment variable: a comma-separated list of substrings; only scenarios whose name contains one of them (case-insensitive) are visited, in every width. `ONLY=equipment WIDTHS=320 npm run layout:check` should finish in well under a minute. With `ONLY` unset nothing changes. A value that matches no scenario is an error (non-zero exit, a message listing the available names), so a typo is not a green run.

**Blocked by:** None

**Status:** done

**Landed:** merged from `pr/31-layout-check-faster` (bfc7cef, 743f4b6, 1c4bf4f, merge 2d6e5ce; merge 7f55700). The four widths run in parallel and `ONLY=<name>` visits only matching scenarios (a term that matches nothing exits 2 and lists the names; a blank value counts as unset; the HP modals and Wild Shape checks are now named scenarios). Measured by the implementer: full SRD run 501 s to 179 s, full integrated 572 s to 198 s, `ONLY=equipment WIDTHS=320` 42 s. The main session measured 181 s for the full SRD run and 39 s for `ONLY=equipment WIDTHS=320` on the merged tip, both green. The visited scenarios (128 visits SRD, 140 integrated) and the verdicts are identical before and after, and a violation at one width alone still gives exit 1. `check:all` passes on the merged tip. Open items: output lines of different widths interleave (the width prefix keeps them readable); a multi-line violation message loses the prefix on its continuation lines (as before); the fixed sleeps and per-modal reloads inside a scenario are untouched; the integrated run was not re-timed by the main session.

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
