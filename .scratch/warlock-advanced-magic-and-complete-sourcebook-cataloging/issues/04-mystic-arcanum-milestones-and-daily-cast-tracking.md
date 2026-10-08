# 04: Mystic Arcanum Selection Milestones & Daily Cast Tracking on Spells Tab

**What to build:**
Complete progression and tactical execution of *Mystic Arcanum* for 11th–20th level Warlocks. Provide four discrete builder choices for 6th, 7th, 8th, and 9th level Arcanum spells with full respec flexibility. Track daily expenditures in `character.mysticArcanumSpent?: Record<number, boolean>`, render a dedicated **"Mystic Arcanum"** card section on the Spells tab with `[Cast (1/Long Rest)]` interactive toggles, and wire Long Rest recovery to automatically reset all expended Arcanum uses while short rests leave them untouched.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `warlockMysticArcanumChoices(character, activeBooks)` offering choices at levels 11 (6th), 13 (7th), 15 (8th), and 17 (9th) using canonical IDs `Warlock__Mystic Arcanum 11`, `13`, `15`, `17`.
- [x] Ensure options include all Warlock spells of exactly that tier from active sourcebooks, allowing the player to change their pick anytime in the builder.
- [x] In `src/types/character.ts`, add `mysticArcanumSpent?: Record<number, boolean>` to track daily cast status by tier (6, 7, 8, 9).
- [x] In `src/rules/rest.ts` and `src/components/RestModal.tsx`:
  - Taking a Long Rest clears `mysticArcanumSpent = {}`, restoring all Arcanum uses.
  - Taking a Short Rest preserves `mysticArcanumSpent` without resetting.
- [x] On `SpellsTab.tsx`, render a dedicated **"Mystic Arcanum"** card section displaying all unlocked Arcanum tiers, complete with spell name, casting time, save DC, attack bonus, and an interactive `[Cast (1/Long Rest)]` usage toggle.
- [x] De-leveling a Warlock below Arcanum milestones cleanly prunes invalid Arcanum picks from `ruleChoices` and cleans up `mysticArcanumSpent`.
- [x] Add unit tests in `checks/mysticArcanum.test.ts` verifying selection, tier level gating, Long Rest recovery, Short Rest non-recovery, and de-leveling pruning.
