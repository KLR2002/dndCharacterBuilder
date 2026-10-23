# Non-SRD options hand-written in code

Purpose: list every place the app carries non-SRD option data or rules by hand, so the scraper (`dnd5eToolsScrap/`) can supply it from 5e.tools class, race, feat and background data instead. Surveyed on branch `spec/compendium-reconciler-ledger-rule-choice` at `08d0427`.

How "scraper status" was judged: the raw 5e.tools downloads in `dnd5eToolsScrap/.cache/` against the scraper output in `dnd5eToolsScrap/data/`.

Scraper status values:
- **Scraped**: the data is already in the output; the app only needs to read it.
- **Flattened**: the raw data is structured, the scraper turns it into prose or loose siblings.
- **Dropped**: the raw data has it, the scraper discards it.
- **Prose only**: the rule exists only as sentence text.

## 1. Subclass Rule Choice table (`src/rules/subclassChoiceTable.ts`, 16 rows)

Option names and descriptions are written by hand (the descriptions are paraphrases, not the printed text).

| Row(s) | Book | Hand-written | Scraper status | What to read instead |
|---|---|---|---|---|
| Totem Spirit 3, Aspect of the Beast 6, Totemic Attunement 14 (3 rows, 15 options: Bear, Eagle, Wolf, Elk, Tiger x3) | PHB, SCAG | names, descriptions, `book: SCAG` gate on Elk/Tiger | **Flattened**. Raw feature has `{type:"options", count:1, entries:[refSubclassFeature ...]}`. Output keeps the option features as unlinked siblings (`Bear` 3/6/14) and renders the parent as a bullet list of names. | Emit `choices: {count, options:[{name, source, description}]}` on the parent feature by resolving the `refSubclassFeature` refs. Source comes from the ref. |
| Elemental Discipline 3/6/11/17 (4 rows, 16 options) | PHB | names, ki costs, descriptions | **Scraped**: 17 `ED` records in `options_and_features.json` (also in `src/data`). Level gating is in the prerequisite text only. | Read the `ED` options; parse the level from the `(Nth Level Required)` text. |
| Circle of the Land biome | PHB (SRD subclass) | 8 biome names and spell-list text | **Scraped**: `additionalSpells` has one named entry per biome with `prepared` by level. | Build option text from `additionalSpells`. |
| Divine Soul affinity | XGE | 5 affinities and their spell | **Scraped**: `additionalSpells` has named entries Good, Evil, Law, Chaos, Neutrality with `known`. | Same. |
| The Genie kind | TCE | 4 kinds, element, spell list | **Scraped**: named entries Dao, Djinni, Efreeti, Marid with `expanded`. The element is in prose only. | Same, element from the feature text or a 4-entry map. |
| Acolyte of Nature, Reaper, Arcane Initiate cantrips (3 rows) | PHB, DMG, SCAG | which list the cantrips come from, and the count | **Scraped**: `additionalSpells.known` carries `choose: "level=0\|class=Druid"`, `"level=0\|school=N"`, `"level=0\|class=Wizard"`. The `count` is there too (1 for Reaper, 2 for Arcane Initiate). | Replace the three named resolvers with the `choose` filter. |
| Primal Knowledge 3 and 10 | TCE | skill list, optional-feature gate | **Scraped** as an optional feature (`isOptional`). The skill list is in prose. | Keep the gate; take the skill list from the class's starting skill choice. |
| Giant Power cantrip | BGG | Druidcraft and Thaumaturgy and their text | **Scraped**: `additionalSpells` has two `innate` entries, one per cantrip. | Build the options from `additionalSpells`. |

Also in this file: `getUnchosenBarbarianSkills` and `BARBARIAN_CLASS_SKILLS` (the class's skill list; Primal Knowledge pool).

## 2. Specialised choice modules

| Where | Hand-written | Scraper status | Notes |
|---|---|---|---|
| `choices/artificerInfusions.ts` | 66 infusion definitions with level and text (the whole Artificer class is non-SRD) | **Flattened/Dropped**: 15 `AI` options scraped. The other 51 are "Replicate Magic Item: X" rows (a table inside one infusion) plus Arcane Propulsion Arm. | Scrape the Replicate Magic Item table as options. Also hard-coded: Artificer in `spellcasting.ts`, `constants/rules.ts` multiclass tables, `attacks.ts` weapon proficiencies, `proficienciesAndLanguages.ts`, `tools.ts`, `migrateCharacter.ts`, `ac.ts` (Enhanced Defense, Repulsion Shield) and `attacks.ts` (Enhanced Weapon) infusion effects. |
| `choices/warlockChoices.ts` | Fallback Pact Boon list (4, Talisman is TCE); `INVOCATION_AT_WILL_SPELLS` (13 invocations, 12 in the SRD data, Shroud of Shadow is XGE); prerequisite parsing for Pact of the Talisman, Hex/Curse, Hexblade | At-will spell is **Prose only** ("cast X at will"). Pact boons and invocations are **Scraped** (`PB`, `EI`). | The at-will table can be parsed from the invocation text. The fallback list is only needed when the compendium lacks `PB` options. |
| `choices/fightingStyles.ts`, `choices/maneuvers.ts` | Choice ids only; options come from the compendium | Scraped | No option text to move. |
| `tacticalActions.ts`, `combatDice.ts`, `StatsTab.tsx`, `ActionsTab.tsx` | Battle Master maneuver action types: `SAVING_THROW_MANEUVERS` (6), `REACTION_MANEUVERS` (3), `BONUS_ACTION_MANEUVERS` (4); superiority dice rules | **Prose only** ("as a reaction", "bonus action") | Parse the action type from the maneuver text, or add a field. |
| `subclassSpells.ts` | `ELEMENTAL_DISCIPLINE_SPELL_MAP` (12 entries with ki cost) | Prose only ("spend N ki points to cast X") | Parse from the `ED` description. |
| `subclassSpells.ts` | Clockwork Soul / Aberrant Mind swap rule: sorcerer only, schools Abjuration+Transmutation / Divination+Enchantment | Prose only | Name-substring checks. See also bug 4 fix `18b8ec8`. |
| `ruleChoices.ts` | `FEAT_GRANTED_CHOICE_IDS` (Fighting Initiate TCE, Martial Adept PHB, Eldritch Adept TCE); `LINEAGE_NAMES` (Dhampir, Hexblood, Reborn: VRGR); `CHANGEABLE_AT_LONG_REST` (Fey Step, MToF Eladrin) | Prose only | Lineage and Fey Step are race rules. |

## 3. Race and ancestry

| Where | Hand-written | Scraper status |
|---|---|---|
| `innateMagic.ts` | 11 innate-spell specs: Drow, Tiefling (SRD), Githyanki, Githzerai, Svirfneblin, Forest Gnome, Firbolg, Triton, Aasimar, Fire Genasi, Water Genasi | **Dropped**. The scraped race record has no spell field. Raw 5e.tools races carry `additionalSpells` on 22 race/subrace records (Drow, Tiefling, Firbolg, Githyanki, Eladrin, Duergar ...). Triton has none in the raw data, so its spells are prose only. |
| `skills.ts` `RACE_SKILL_PROFICIENCIES` | 20 entries (Bugbear, Orc, Tabaxi, Satyr, Goliath, Owlin, Harengon, Grung, Tortle, Eladrin, Sea Elf, Shadar-kai, Pallid Elf, Astral Elf, Drow ...) | **Dropped**: raw races carry `skillProficiencies` on 52 records. |
| `attacks.ts` `RACE_WEAPON_PROFICIENCIES` | Wood Elf, Drow, Mountain Dwarf, Githyanki | **Dropped**: raw races carry `weaponProficiencies`, but on only 5 records, so some of this table may stay prose only. |
| `feats.ts:51`, `characterEvaluation.ts:175` | Mountain Dwarf and Githyanki armor training | **Dropped**: raw races carry `armorProficiencies`, but on only 1 record. Check Mountain Dwarf and Githyanki against it before relying on it. |
| `ancestryEngine.ts` | `CHOICE_ASI_RACES` (Half-Elf, Custom Lineage), Variant Human and Custom Lineage feat, High Elf / Half-Elf cantrip | Partly scraped (`abilityScoreIncrease`); the "choose" shapes are not structured. |
| `FeaturesTab.tsx:218-231` | Bear Totem rage text appended to Rage by hand | Replaced by reading the chosen option from section 1. |

## 4. Backgrounds and feats

| Where | Hand-written | Scraper status |
|---|---|---|
| `skills.ts` `BACKGROUND_SKILL_PROFICIENCIES` | 18 backgrounds (Acolyte is the only SRD one) | **Scraped**: backgrounds carry skill proficiencies. Only a read is needed. |
| `feats.ts` `BACKGROUND_FEATS` | 15 background-to-feat grants (Giant Foundling, Rune Carver, Strixhaven students, Gate Warden ...), two with a choice list | **Prose only** ("gain the X feat"); a regex fallback exists. |
| `leveling.ts` `HALF_FEATS` | 51 feats with the abilities they can raise (none in the SRD) | **Dropped**: all 51 are in the scraped feats, but `abilityScoreIncrease` is null for each. The raw feat `ability` field, e.g. `[{choose:{from:["str","dex"],amount:1}}]` for Athlete, is discarded. |
| `feats.ts` | Prerequisite strings ("Requires elf or half-elf", armor proficiency) matched by name | Scraped as text (`prerequisite`); structured fields dropped. |
| `optionalFeatures.ts` `KNOWN_FEATURE_REPLACEMENTS` | 6 TCE optional features and the base feature each replaces | **Flattened**: `isOptional` is kept, the "replaces" link is not. Regex fallback on the description. |

## 5. Class rules and constants

| Where | Hand-written | Note |
|---|---|---|
| `classData.ts` | `THIRD_CASTERS` (Eldritch Knight, Arcane Trickster), third-caster slot table | PHB subclasses. |
| `spellcasting.ts` | Divine Soul reads the Cleric list; Giant Barbarian; third casters read the Wizard list | |
| `constants/rules.ts` | `MULTICLASS_PREREQUISITES` and `MULTICLASS_PROFICIENCIES` carry an Artificer entry | The scraped class record has `multiclassing`. |
| `constants/books.ts` | 18 book codes and names (BGG, FTD ...) | Scraped as `books.json`. |
| `constants/languages.ts`, `proficienciesAndLanguages.ts` | Exotic languages, Dragonchess Set, Three-Dragon Ante Set, "Water", "Space", "MPMM" language labels | |

## 6. UI text naming non-SRD content

`ClassProgressionSection.tsx:458` card title "Battle Master Maneuvers"; `SpellsTab.tsx` Eldritch Knight and Arcane Trickster banners; `ActionsTab.tsx` Giant spellcasting profile; `AsiFeatSection.tsx` Fighting Initiate and Eldritch Adept. These are labels, not data.

## Suggested order for the scraper work

1. **Structured `choices` on class and subclass features** (Totem x3, Four Elements, Primal Knowledge). One change in `classes.ts` plus `entry-renderer.ts`, replaces the largest block of hand-written text.
2. **Read the existing `additionalSpells`** for Land, Divine Soul, Genie, the three cantrip rows and Giant Power. No scraper change.
3. **Race fields**: `additionalSpells`, `skillProficiencies`, `weaponProficiencies`, `armorProficiencies`. Retires `innateMagic.ts` specs and three proficiency tables.
4. **Feat `ability` field**: retires `HALF_FEATS`.
5. **Artificer infusions**: the Replicate Magic Item table.
6. **Prose-only rules** (maneuver action types, Elemental Discipline ki costs, at-will invocations): only if parsing the text is judged reliable. Otherwise keep as code.

Not in scope here: the spell lookup and the tag-cleaner fixes for bug 4 (already done).
