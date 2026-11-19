# 04: Metamagic in the Ledger

**What to build:**

- **Allowance.** Add `metamagicAllowance(character)` to `src/rules/characterSpells.ts`: 0 below Sorcerer 3, then 2, 3 at 10, 4 at 17. `spellPage` reads it (replace ticket 02's local copy).
- **Pick or drop.** Add `toggleMetamagic(character, name)`.
  - It drops a chosen option.
  - It adds an unchosen one only below the allowance; at the allowance it returns the same character.
  - It writes `chosenMetamagic` only and removes `metamagicOptions`.
  - SpellsTab's `toggleMetamagic` calls it.
- **Release on level loss.** Add a Reconciler pass, `releaseMetamagicOverAllowance`, in `src/rules/characterReconciler.ts` beside `pruneInvalidMysticArcanum`.
  - When `chosenMetamagic` holds more than the allowance, it keeps the first `allowance` picks in saved order and releases the rest.
  - Each released pick gets a review notice through `withNotices` (`src/rules/needsReview.ts`): `"<Option> removed: Metamagic allows <n>"`. Follow the wording style of the other notices in the Reconciler.
  - A character without Sorcerer levels keeps an empty list.
- **One field.** In `migrateCharacter` (`src/rules/migrateCharacter.ts`), merge `metamagicOptions` into `chosenMetamagic`: their union, `chosenMetamagic` order first. Then remove `metamagicOptions`. `spellPage` then reads only `chosenMetamagic`. Remove `metamagicOptions?` from `src/types/character.ts` if nothing else reads it (check with grep).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Tests:
  - The allowance at Sorcerer 2, 3, 10 and 17.
  - A toggle at the allowance does nothing; a drop then an add works.
  - A Sorcerer 10 with 3 picks loses a level to 9: one pick is released with one notice.
  - A Sorcerer 10 with 3 picks reconciled again keeps them with no notice.
  - Migration of `{ chosenMetamagic: ["Quickened Spell"], metamagicOptions: ["Quickened Spell", "Twinned Spell"] }` gives `["Quickened Spell", "Twinned Spell"]` and no `metamagicOptions`.
- [ ] `grep -rn "metamagicOptions" src` prints only the migration (paste it).
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY="Spells sorcery" WIDTHS=393 npm run layout:check` is green (paste the summary line).
