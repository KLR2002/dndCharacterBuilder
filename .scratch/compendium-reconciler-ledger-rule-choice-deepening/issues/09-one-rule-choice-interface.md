# 09: One Rule Choice interface over the existing sources

**What to build:** One availability and one pick interface cover ancestry choices, the hand-written class/subclass choices, and the specialised choice modules. Picks record, then reconcile. The id-substring dispatch is removed. The Giant Power known-spell sync becomes a Reconciler pass. The pick-recording function stays in `choices/types.ts` (no cycle existed; see Notes).

**Blocked by:** 04

**Status:** done

- [x] Every caller (class progression, ASI/feat section, rest dialog, ancestry engine, builder tab) uses the one interface (accepted gap: `AsiFeatSection` and `BuilderTab` still call specialised availability and `ancestryRuleChoices` directly)
- [x] Picking any choice records it and reconciles; no id-substring dispatch remains except inside specialised modules (accepted gap: display-only and out-of-scope id-substring checks listed in Notes remain)
- [x] Giant Power pick keeps its known spell in sync through the Reconciler
- [x] Fighting style and artificer infusion picks behave as before
- [x] Existing suite passes (`npm run check:all`)

## Notes

- `setRuleChoicePick` stayed in `src/rules/choices/types.ts`. The specialised modules record picks with it. Moving it into `ruleChoices.ts` would make them import the Rule Choice module, which imports the Reconciler, which imports those modules: a cycle.
- Default picks now reconcile. `pickRuleChoice` records the option, then calls `reconcile`.
- Left open. Box 1: `AsiFeatSection.tsx` finds its fighting style, maneuver and invocation choices by calling the specialised availability functions directly, and `BuilderTab.tsx` still resolves ancestry choices with `ancestryRuleChoices`. Box 2: id-substring checks remain in `ClassProgressionSection.tsx` (section classification), `AsiFeatSection.tsx` (choice lookups), `ruleChoices.ts` (the `"Feat"` filters around lines 692 to 698), `characterReconciler.ts` (prune checks around lines 98 to 101) and `ancestryEngine.ts` (High Elf checks).
- Residual checks after the fix-up, left as display-only or out of scope: `ClassProgressionSection.tsx` isFightingStyle-style card choice; `startsWith("Class:")` skill-choice source checks in `BuilderTab.tsx` and `ClassProgressionSection.tsx`; `characterReconciler.ts` subclass-name and counter-key checks; `ancestryEngine.ts` High Elf checks; and `BuilderTab.tsx` direct specialised calls through `ancestryRuleChoices`. Boxes 1 and 2 stay open until these are routed through the one interface.

- Closed by the user as accepted gaps after the final code review. The spec text for `setRuleChoicePick` was amended to match.
