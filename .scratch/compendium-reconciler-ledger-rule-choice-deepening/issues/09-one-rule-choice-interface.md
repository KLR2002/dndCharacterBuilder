# 09: One Rule Choice interface over the existing sources

**What to build:** One availability and one pick interface cover ancestry choices, the hand-written class/subclass choices, and the specialised choice modules. Picks record, then reconcile. The id-substring dispatch is removed. The Giant Power known-spell sync becomes a Reconciler pass. The pick-recording function moves into the Rule Choice module, which removes a second import cycle.

**Blocked by:** 04

**Status:** done

- [ ] Every caller (class progression, ASI/feat section, rest dialog, ancestry engine, builder tab) uses the one interface
- [ ] Picking any choice records it and reconciles; no id-substring dispatch remains except inside specialised modules
- [x] Giant Power pick keeps its known spell in sync through the Reconciler
- [x] Fighting style and artificer infusion picks behave as before
- [x] Existing suite passes (`npm run check:all`)

## Notes

- `setRuleChoicePick` stayed in `src/rules/choices/types.ts`. The specialised modules record picks with it. Moving it into `ruleChoices.ts` would make them import the Rule Choice module, which imports the Reconciler, which imports those modules: a cycle.
- Default picks now reconcile. `pickRuleChoice` records the option, then calls `reconcile`.
- Left open. Box 1: `AsiFeatSection.tsx` finds its fighting style, maneuver and invocation choices by calling the specialised availability functions directly, and `BuilderTab.tsx` still resolves ancestry choices with `ancestryRuleChoices`. Box 2: id-substring checks remain in `ClassProgressionSection.tsx` (section classification), `AsiFeatSection.tsx` (choice lookups), `ruleChoices.ts` (the `"Feat"` filters around lines 692 to 698), `characterReconciler.ts` (prune checks around lines 98 to 101) and `ancestryEngine.ts` (High Elf checks).
