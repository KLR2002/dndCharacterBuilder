# 04: Subclass Cantrips and Builder Rule Choices

**What to build:**
End-to-end selection and granting of subclass choices in the Builder tab:
1. Circle of the Land Biome (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, Underdark) as a `RuleChoice`, driving the granted circle spells.
2. Divine Soul Affinity (Good, Evil, Law, Chaos, Neutrality) as a `RuleChoice`, auto-granting the corresponding affinity spell (*Cure Wounds*, *Inflict Wounds*, *Bless*, *Bane*, *Protection from Evil and Good*).
3. Subclass Cantrips: Auto-grant fixed cantrips (*Light* for Light Cleric, *Spare the Dying* for Grave Cleric, *Chill Touch* for Spores Druid, *Light* and *Sacred Flame* for Celestial Warlock) with `[Subclass Cantrip]` badge. Provide Builder prompt pickers for choice cantrips (Nature Cleric: 1 Druid cantrip; Death Cleric: 1 Necromancy cantrip; Arcana Cleric: 2 Wizard cantrips).

**Blocked by:** 01 (Subclass Data Ingestion and Always-Prepared Magic), 02 (Warlock Patron Expanded Lists and Divine Soul Access).

**Status:** closed

- [x] Add `RuleChoice` definitions for Circle of the Land Biomes in `src/rules/ruleChoices.ts`
- [x] Add `RuleChoice` definitions for Divine Soul Affinity in `src/rules/ruleChoices.ts`
- [x] Render biome and affinity pickers in `ClassProgressionSection.tsx` upon subclass selection
- [x] Provide cantrip selection UI in Builder for Nature Cleric, Death Cleric, and Arcana Cleric
- [x] Auto-grant fixed subclass cantrips with `[Subclass Cantrip]` badge in `SpellsTab.tsx`
- [x] Verify with unit tests in `checks/subclassSpells.test.ts` and `checks/ruleChoices.test.ts`
