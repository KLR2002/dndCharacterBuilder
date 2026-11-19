# 04: Replace a spell on level-up

**What to build:**

- **Who may replace.** Known casters (an owner whose `spellCounts(...).spells.kind` is `"known"`: Bard, Ranger, Sorcerer, Warlock, Eldritch Knight, Arcane Trickster) may replace one known levelled spell of the planned class when gaining a level in it. A Wizard (spellbook) and prepared casters may not.
- **The pick.** Add `plan.picks.replacedSpell?: { forget: { name, source }, learn: { name, source } }` with setters in `src/rules/levelUpFlow.ts`.
  - The spell to forget comes from the owner's known levelled spells, counted the way `spellCounts` counts them.
  - The spell to learn comes from the owner's learnable levelled spells (`levelUpLearnableSpells`), excluding the spells already picked as new.
  - It is optional: the step completes with or without it, but not with half of it.
  - The ticket 03 hook now returns true for these owners, so a known caster's level always has a Spells step.
- **Applying it.** `applyLevelUpPlan` forgets the old spell for that owner and learns the new one, through the Ledger's `forgetSpell` / `learnSpell` (`src/rules/characterSpells.ts`).
- **The screen.** Below the list, `SpellsStep` gets a "Replace a spell" section:
  - choose the known spell to forget, then the replacement from a list (reuse `SpellLearnList`)
  - a Clear action

  The Review step shows `"Replace: <old> → <new>"`.

**Blocked by:** 03

**Status:** done

**Landed:** merge 3fbbc3a (the implementer's two commits); follow-up: the forget passes the stored owner key. `picks.replacedSpell` holds optional `forget`/`learn` halves (complete with both or neither); setters `setPlanReplacedForget`, `setPlanReplacedLearn`, `clearPlanReplacedSpell`; `ownKnownSpells` in `spellCounts.ts` is the one owner rule for counting and forgetting; `levelUpReplacementOptions` feeds `SpellsStep`'s "Replace a spell" section; apply order: new picks, forget, learn. Review row label `Replace`, value `Shield → Magic Missile`. Custom layout check `Level-Up Flow replace a spell` (SRD only; the integrated Sorcerer 4→5 plan has other steps), green at 320 and 393; Level-Up green at 393 SRD and integrated. 8 tests in `checks/levelUpSpellReplacement.test.ts`; check:all and check:live passed.

- [x] Tests:
  - A Sorcerer 4 → 5 replaces Shield with Magic Missile: after apply, Shield is gone for the Sorcerer and Magic Missile is known. The counts are unchanged apart from the new level's picks.
  - A half-made replacement keeps the step incomplete.
  - A Wizard plan offers no replacement.
  - A Wizard 3 / Sorcerer 3 levelling Sorcerer can only forget Sorcerer spells, and a Wizard-known Shield is not offered to forget.
- [x] `npm run check:all` and `npm run check:live` pass (last ticket).
- [x] Scoped layout: add a scenario, `Level-Up Flow replace a spell`: a Sorcerer level-up with a replacement chosen, the Review row visible. Run it at 320 and 393, with `ONLY="Level-Up" WIDTHS=393` SRD green. Open the screenshot and describe it.
