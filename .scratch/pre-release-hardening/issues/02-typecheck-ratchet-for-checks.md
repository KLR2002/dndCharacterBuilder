# 02: Type-check ratchet for the checks folder

**What to build:** Type errors in tests are caught before commit. A second type-check configuration covers the tests (and the type-checkable scripts) and runs inside the full check. The errors it finds today are recorded as a baseline of known errors by a recorder, the check fails on any error not in the baseline and prints file and line, and the mechanical error classes (such as the missing Node types) are fixed outright so the baseline starts as small as it can.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The full check runs the second type check, and it passes on the current tree.
- [ ] Adding a new type error to a test makes the full check fail and names the file and line.
- [ ] Fixing a baseline error and re-running the recorder removes it from the baseline; the baseline is never edited by hand and never grows through the recorder when a new error exists unless the recorder is run on purpose.
- [ ] The recorded baseline and the count of remaining errors are reported in the ticket's Landed note.
- [ ] `npm run check:all` passes.
