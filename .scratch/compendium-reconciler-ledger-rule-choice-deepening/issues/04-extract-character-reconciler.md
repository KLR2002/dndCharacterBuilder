# 04: Extract the Character Reconciler module

**What to build:** `reconcile(character, compendium)` becomes its own module, with the eight existing passes as internal passes in one explicit order. The Warlock ordering dependency is documented and the nested pass calls are removed. Ad hoc call sites (rule-choice pick paths, artificer infusions, the spells tab) go through the Reconciler. The subclass-teardown heuristics move in unchanged. The import cycle with the rule-choice code is gone.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] reconcile(character, compendium) is the only public entry to the passes
- [ ] Running reconcile twice on a valid character changes nothing (idempotency)
- [ ] Ad hoc pass calls in pick paths, infusions and the spells tab are replaced by reconcile
- [ ] Tests that called individual passes now go through reconcile
- [ ] No import cycle between the Reconciler and the rule-choice code
- [ ] Existing suite passes (`npm run check:all`)
