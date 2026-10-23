# 04: Extract the Character Reconciler module

**What to build:** `reconcile(character, compendium)` becomes its own module, with the eight existing passes as internal passes in one explicit order. The Warlock ordering dependency is documented and the nested pass calls are removed. Ad hoc call sites (rule-choice pick paths, artificer infusions, the spells tab) go through the Reconciler. The subclass-teardown heuristics move in unchanged. The import cycle with the rule-choice code is gone.

**Blocked by:** 03

**Status:** done

- [x] reconcile(character, compendium) is the only public entry to the passes
- [x] Running reconcile twice on a valid character changes nothing (idempotency)
- [x] Ad hoc pass calls in pick paths, infusions and the spells tab are replaced by reconcile
- [x] Tests that called individual passes now go through reconcile
- [x] No import cycle between the Reconciler and the rule-choice code
- [x] Existing suite passes (`npm run check:all`)
