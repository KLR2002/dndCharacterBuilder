# 01: The pre-commit hook checks a Markdown-only commit that changes GLOSSARY.md

**What to build:** `.githooks/pre-commit` skips `npm run check:all` when every staged file is Markdown. `GLOSSARY.md` is Markdown, but `checks/glossaryConsistency.test.ts` reads it, so a commit that only adds an Avoid term to the glossary passes the hook and turns the branch red (this happened: the 3d-dice spec commit `3e4885a` broke the glossary test, and three implementers failed their first commit on it). When the staged files are all Markdown and one of them is `GLOSSARY.md`, the hook runs the glossary test (`node --experimental-strip-types --test checks/glossaryConsistency.test.ts`, under a second), prints one line saying so, and fails the commit with the test's output when it fails. Any other Markdown-only commit is still skipped. The command is overridable with an environment variable (`GLOSSARY_CHECK_CMD`, like the existing `CHECK_CMD`) so a test can run the hook without the real suite.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Markdown-only commit that stages `GLOSSARY.md` runs the glossary test; the commit fails when the test fails.
- [ ] A Markdown-only commit without `GLOSSARY.md` is skipped as before; a commit with any non-Markdown file runs `CHECK_CMD` as before.
- [ ] A test in `checks/` (for example `checks/preCommitHook.test.ts`) runs the hook in a temporary git repository with `CHECK_CMD` and `GLOSSARY_CHECK_CMD` set to stub commands and covers the three cases above. Red first: the GLOSSARY case fails against the current hook.
- [ ] The first bullet of "Implementer Rules > Git" in `docs/agents/subagent-tiering.md` names the exception (Markdown-only commits skip the checks, except that `GLOSSARY.md` runs the glossary test).

## Constraints

- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".
- Keep the hook's existing output lines and exit codes.
