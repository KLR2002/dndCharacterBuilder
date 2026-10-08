# Origin Feats, Prerequisite Engine, and Innate Magic

## Problem Statement

When building or playing a 5e 2014 character, players cannot select starting feats granted by their ancestry (Variant Human, Custom Lineage) or specific backgrounds (such as *Giant Foundling* or *Rune Carver* from *Bigby Presents: Glory of the Giants*). Furthermore, the character sheet does not validate feat prerequisites (e.g. minimum ability scores, armor proficiencies, spellcasting capability, character level, or ancestry), risking illegal builds. Additionally, ancestries with innate magical traits (such as High Elf cantrips, Drow spells, Gith psionics, and Tiefling legacy) lack automated level progression, spellcasting DC calculations, and daily usage tracking on the character sheet, and race lore in the Journal is rendered as unformatted truncated text.

## Solution

1. Provide an inline **Origin Feat** picker for ancestries (Variant Human, Custom Lineage) and feat-granting backgrounds at 1st level, supporting +1 ability score selections for half-feats that seamlessly flow into effective ability scores.
2. Introduce a comprehensive **Feat Prerequisite Engine** that evaluates ability minimums, armor proficiencies, spellcasting requirements, character levels, and ancestry requirements, presenting clear non-blocking warning badges when prerequisites are unmet.
3. Add a dedicated **Innate & Racial Spells** profile on the Spells tab with accurate spell DC and attack bonuses, tracking 1/long rest spell usages via long-rest resource counters and supporting ancestry-level cantrip selection.
4. Format **Race Lore & Biology** in the Journal tab into clean, structured, expandable section cards (*Age*, *Size*, *Alignment*, *Culture*).

## User Stories

1. As a player building a Variant Human, I want to select my bonus 1st-level feat in the Ancestry builder, so that my character has their defining feat immediately.
2. As a player building a Custom Lineage character, I want to select my origin feat and variable trait during character creation, so that my custom ancestry is rules-compliant.
3. As a player choosing a half-feat (e.g. *Athlete*, *Actor*, *Fey Touched*) at 1st level, I want to pick which ability score receives the +1 increase, so that my effective ability scores reflect the bonus.
4. As a player choosing the *Giant Foundling* or *Rune Carver* background, I want the background's granted feat (*Strike of the Giants* or *Rune Shaper*) automatically awarded or selectable, so that my background benefits are applied.
5. As a player selecting a feat, I want to see if my character meets its prerequisites (e.g. STR 13, Proficiency with Medium Armor, Level 4, Elf), so that I know whether the choice is legal.
6. As a DM or player using house rules, I want to be able to select a feat even if a prerequisite is flagged as unmet, so that table discretion is preserved.
7. As a High Elf player, I want to select my bonus Wizard cantrip during character creation, so that it appears in my spell list with Intelligence as its spellcasting ability.
8. As a Drow or Tiefling player leveling up to 3rd and 5th level, I want my ancestry spells (*Faerie Fire*, *Darkness*, *Hellish Rebuke*) to automatically unlock with correct spell save DCs, so that I don't have to manually look up when I learn them.
9. As a player with innate spells, I want to mark when I have cast my daily 1/long rest racial spells, so that I can track expended uses during an adventure.
10. As a player completing a Long Rest, I want my spent racial spell uses to automatically reset to full, so that my character is refreshed for the next adventuring day.
11. As a player reading my character's journal, I want the Race Lore & Biology section to display formatted categories (Age, Alignment, Size, Culture) instead of raw clipped markdown, so that I can easily read my character's heritage lore.

## Implementation Decisions

1. **Origin Feats Model**:
   - Level 1 feats chosen via ancestry or background are stored on the Character model under `originFeats: AsiSelection[]`.
   - When a feat grants an ability score increase (`featAbility`), that bonus is added to `effectiveScores()` alongside racial traits.

2. **Feat Prerequisite Validator**:
   - Pure validation function evaluates a feat's prerequisite string against a character's state:
     - Minimum ability scores (e.g. `Strength 13 or higher`) checked against `effectiveScores`.
     - Armor proficiencies (e.g. `Proficiency with medium armor`) checked against derived armor proficiencies.
     - Spellcasting (e.g. `The ability to cast at least one spell`) checked against casting classes or innate magic.
     - Character level (e.g. `Level 4`) checked against `totalLevel`.
     - Ancestry (e.g. `elf or half-elf`, `dwarf`) checked against character race and subrace.
   - Unsatisfied prerequisites generate an informative warning label without disabling selection.

3. **Innate & Racial Spells Engine**:
   - `SpellsTab` renders a dedicated **Innate & Racial Spells** profile if the character's race or subrace grants innate cantrips or spells.
   - Spell save DC is calculated as `8 + proficiencyBonus + racialAbilityModifier`.
   - Spells with daily limits are tracked in `character.resourceCounters` with `resetOn: "long"`.
   - Ancestry cantrip selection (e.g. High Elf Wizard cantrip) is selected within Ancestry builder options and stored in character rule choices.

4. **Journal Race Lore Presentation**:
   - Race lore markdown text is parsed into titled sections based on Markdown headers (`### Age`, `### Alignment`, etc.) and rendered as styled expandable cards.

## Testing Decisions

- Unit tests must test pure business rules and data models without browser or device coupling.
- Test suites:
  - `checks/feats.test.ts`: Prerequisite validation (abilities, armor, spells, levels, races), origin feat application, and half-feat ability score increments.
  - `checks/innateMagic.test.ts`: Innate spell resolution for High Elf, Drow, Gith, Tiefling, and Deep Gnome, level gating, and Long Rest usage reset.
- Prior art: Follow patterns from `checks/proficienciesAndLanguages.test.ts`, `checks/leveling.test.ts`, and `checks/rest.test.ts`.

## Out of Scope

- 2024 revised ruleset feats (strictly adhering to 2014 rules).
- Homebrew custom feat creation (standard catalog feats supported).
- Auto-tracking spell slot expendability for innate spells cast using class spell slots.

## Further Notes

- Backgrounds from non-PHB books (*Glory of the Giants*, *Spelljammer*, *Strixhaven*) that award feats will be recognized by name/feature description.
- All newly added components must maintain 320px minimum mobile responsiveness established in prior iterations.
