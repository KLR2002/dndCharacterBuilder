# 05: Fix transitions that never reconcile

**What to build:** Removing an origin feat, replacing an ASI or feat selection, and clearing a background now prune dependent choices and record a review notice for what was removed.

**Blocked by:** 04

**Status:** done

- [x] Removing an origin feat that granted a choice (e.g. Fighting Initiate) removes the dependent pick and records a review notice
- [x] Replacing an ASI or feat selection prunes choices that depended on the old one
- [x] Clearing a background removes choices and grants that depended on it
- [x] Negative cases: unrelated choices are kept
- [x] Existing suite passes (`npm run check:all`)
