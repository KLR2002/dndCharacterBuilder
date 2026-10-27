# 0017 Granted Spells Live in the Catalog

## Context
Races got their Innate Magic from a table of race names and spells in `src/rules/innateMagic.ts`, which bundles non-SRD content in the app (ADR 0014). Feats and backgrounds that grant spells (Magic Initiate, Strixhaven Initiate, Fey Touched, Telekinetic, Spell Sniper, the Strixhaven and Ravnica backgrounds) had no support at all. The 5etools source carries all of them as structured `additionalSpells`, and the scraper dropped it for feats, backgrounds and races.

## Decision
- Spell grants are structured data on the race, subrace, feat or background that gives them, read from the Catalog and extracted by the scraper, which keeps the structure of the source. The hardcoded race table is removed; no feat, race or background name appears in app code for spells. A coverage test fails when a feat's prose grants spells and it has neither data nor a reviewed mark (ADR 0015 pattern).
- One reader serves races, feats and subclasses. It understands spells known and cast at will, daily, per rest and ritual grants; picks filtered by class, school, level, ritual and attack roll; and a casting ability that is fixed, chosen by the player or inherited from the feat's ability increase. Filters are evaluated against scraped spell fields, so the scraper adds the attack-roll field to spells.
- Granted spells are Innate Magic. Each source has its own card on the Spells tab with its own ability, save DC and attack bonus. Cantrips are at will; a once-per-rest spell uses a Long Rest resource counter. They do not count against a class's spells known or prepared, and are not written into the class's known or prepared spells.
- A background's `expanded` spells join the spell list of every spellcasting class the character has, once the character has Spellcasting or Pact Magic. They are an Expanded Spell List, not granted spells.
- Picks (Magic Initiate's class and spells, the Strixhaven college, a Race's casting ability) are made where the feat or race is chosen and saved as rule choices. Removing or swapping the source releases them with a review notice. Saves that hold the old racial picks are migrated on load.
- Ritual-only feats (Ritual Caster, Quicksmithing, Servo Crafting, Strixhaven Mascot) are not modelled: the feat text tells the player, and each carries a reviewed mark. Casting a granted spell with a spell slot is also left to the text.
- The Catalog Format rises to 9. The SRD Baseline carries only what the SRD contains (High Elf, Tiefling).

## Considered Options
Keeping the race table and adding a feat table was rejected for the reason in ADR 0014: it bundles non-SRD rule content and nothing reveals the entries it misses.

## Amendment: prepared grants and expanded lists of feats and races
- A feat's or race's `prepared` spells are Always-Prepared Spells, not Innate Magic: they are listed in the class list of every spellcasting class with the lock icon and a source badge, use the class's ability, and are never stored in the class's known or prepared spells nor counted against a limit. A character with no spellcasting class sees them on a small locked card for the source.
- A feat's or race's `expanded` lists work like a background's: they join every spellcasting class's list once the character has Spellcasting or Pact Magic, and are released with a review notice when the source goes.
- A grant that names no casting ability still gets a card, without an ability, save DC or attack row.
