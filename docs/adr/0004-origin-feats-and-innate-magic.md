# 0004: Origin Feats and Innate Magic Architecture

## Context

In the 2014 ruleset, certain 1st-level player choices award feats:
1. Ancestries: Variant Human and Custom Lineage award a feat at 1st level.
2. Backgrounds: Setting backgrounds (such as *Giant Foundling* and *Rune Carver* in *Bigby Presents: Glory of the Giants*, *Astral Drifter* in *Spelljammer*, and *Strixhaven* backgrounds) grant specific feats or choices of origin feats.
3. Feats frequently have prerequisites (minimum ability scores, armor proficiencies, spellcasting capability, character level, or race) and may grant +1 ability score increases ("half-feats").
4. Several ancestries grant innate cantrips or spells that unlock at specific character levels (e.g. High Elf cantrip, Drow *Dancing Lights* / *Faerie Fire* / *Darkness*, Githzerai / Githyanki psionics, Tiefling *Infernal Legacy*, Deep Gnome innate casting).

> **Note (ADR 0017):** The race spells listed in this context were a hardcoded table of race names and spells in `src/rules/innateMagic.ts`. That table is removed. Race spells are structured grants in the Catalog, read by the granted spells reader, and only the High Elf cantrip's saved pick is migrated from the old storage. See ADR 0017.

## Decision

1. **Origin Feats Storage and UI**:
   - Level 1 feats chosen from Ancestry (Variant Human / Custom Lineage) or Background are stored on the Character model under `character.originFeats: AsiSelection[]` using `{ level: 1, type: "feat", featName, featSource, featAbility }`.
   - Half-feat ability increases selected at level 1 are directly factored into `effectiveScores` alongside racial bonuses.
   - Feat prerequisites are validated dynamically against `effectiveScores`, current level, armor/weapon proficiencies, spellcasting status, and resolved race. Unsatisfied prerequisites render a clear visual warning badge without disabling selection to permit DM discretion.

2. **Innate Magic Profile**:
   - `SpellsTab` introduces a dedicated **Innate & Racial Spells** profile.
   - Daily casting limits for 1/long rest spells are tracked via `character.resourceCounters` with `resetOn: "long"`, ensuring automated reset during `applyLongRest`.
   - Cantrips granted by race (e.g. High Elf Wizard cantrip) are selected within `AncestrySection` and surfaced in the Innate Magic profile.
   - *Superseded in part by ADR 0017:* the race table this bullet relied on is gone. Each race, subrace, feat and background now carries its spell grants in the Catalog, and the Spells tab shows one Innate Magic card per source.

3. **Proficiency De-duplication**:
   - Armor and weapon proficiencies across ancestry, class, multiclass, and backgrounds are normalized and deduplicated case-insensitively, preventing display duplicates like `"light"` and `"Light armor"`.

## Consequences

- The Character model cleanly distinguishes class-level ASI selections from origin-granted feats.
- Long Rest resets all innate spell usage without special-case spell slot management.
- Ability score calculations remain single-source-of-truth via `effectiveScores()`.
