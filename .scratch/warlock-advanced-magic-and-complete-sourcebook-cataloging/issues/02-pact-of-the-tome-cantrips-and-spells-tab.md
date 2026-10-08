# 02: Pact of the Tome Cantrips Selection & Spells Tab Integration

**What to build:**
End-to-end integration of *Pact of the Tome* with character progression and the Spells tab. When a Warlock chooses Pact of the Tome at 3rd level, generate an automated rule choice prompting the player to choose 3 cantrips from any class list. Synchronize these cantrips into the character's Warlock spell profile using Charisma, display them on the Spells tab with a `[Pact of the Tome]` badge, and provide clean teardown if the pact boon is changed.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] In `src/rules/ruleChoices.ts`, implement `warlockTomeCantripChoices(character, activeBooks)` generating canonical ID `Warlock__Pact of the Tome__Cantrips` (choose: 3, all cantrips across active books).
- [x] Ensure the rule choice ID is source-agnostic (no hardcoded `PHB__` prefix).
- [x] Synchronize selected Tome cantrips into `character.knownSpells` with `ownerKey: "Warlock__Tome"`, `ability: "cha"`.
- [x] On `SpellsTab.tsx`, display Tome cantrips under Warlock Cantrips with a `[Pact of the Tome]` badge and Charisma-based attack bonus and save DC.
- [x] When Pact Boon is changed or removed, clean up all synchronized Tome cantrips from `character.knownSpells`.
- [x] Add unit tests in `checks/warlockTome.test.ts` verifying selection, synchronization, Charisma scaling, active-book gating, and clean teardown.
