# Spec: Granted Spells from the Catalog (feats, backgrounds, races)

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/granted-spells/`).
**Related:** ADR 0017 (this decision), ADR 0015 (grants extracted from prose, coverage test, reviewed marks), ADR 0016 (the same Catalog-field pattern for Initiative Bonuses), ADR 0014 (non-SRD content comes from the Integrated Catalog), ADR 0013 (SRD Baseline), ADR 0007 (subclass spell lists), ADR 0004 (origin feats and Innate Magic, superseded in part for race spells), CODING_STANDARDS §7 (layout). GLOSSARY terms *Innate Magic*, *Expanded Spell List*, *Origin Feat*, *Spell Owner*, *Always-Prepared Spells*, *Integrated Catalog*, *SRD Baseline*, *Catalog Format*, *Evaluated Character Engine*.

## Problem Statement

A character can get spells from a feat or a background, and the app shows none of them. A player who takes Magic Initiate, Strixhaven Initiate, Fey Touched, Shadow Touched, Telekinetic, Telepathic, Spell Sniper or any of the Dragonlance, Planescape and Ravnica feats cannot pick the spells the feat grants, cannot see them on the Spells tab, and cannot track the once-per-long-rest cast. A player with a Strixhaven college background or a Ravnica guild background cannot see the expanded spells their background adds to their class's spell list. Race spells do show, but only because the app holds a table of race names and spells in code, which is non-SRD content bundled in the app, and which cannot let a player choose the casting ability the way newer races allow.

The developer cannot fix this by adding a table of feats: every named feat and background is non-SRD, and a hand-kept list would silently miss the next book.

## Solution

Each race, subrace, feat and background that grants spells carries those grants in the Catalog, structured as the source has them, and the scraper extracts them. A test fails when a feat's prose grants spells and it has neither data nor a reviewed mark. The character's Innate Magic is read from that data for every source, race and feat alike: the Spells tab shows one card per source with its own casting ability, save DC and attack bonus, cantrips at will, and a once-per-long-rest counter on each daily spell. The player makes the picks (Magic Initiate's class and spells, Strixhaven's college and spell, a race's casting ability) where the feat or race is chosen. A background's expanded spells join the spell list of each of the character's spellcasting classes. The hardcoded race table is removed.

## User Stories

1. As a player who took Magic Initiate, I want to choose the class and then its two cantrips and its 1st-level spell, so that the feat grants what the book says.
2. As a player who took Magic Initiate (Wizard), I want a card on the Spells tab named for the feat and class, so that I can see which spells it gave me.
3. As a Magic Initiate player, I want its cantrips shown as at-will and its 1st-level spell as one cast per long rest, so that the sheet follows the feat.
4. As a Magic Initiate player, I want the casting ability to be the one that matches the class I chose (Intelligence for wizard, Wisdom for cleric or druid, Charisma for bard, sorcerer or warlock), so that the DC and attack bonus are right.
5. As a player with Strixhaven Initiate, I want to choose my college and one of its cantrip pairs, so that I get the two cantrips the college lists.
6. As a player with Strixhaven Initiate, I want to pick the 1st-level spell from the college's class lists, so that the feat's daily cast is mine.
7. As a player with Strixhaven Initiate, I want to choose Intelligence, Wisdom or Charisma as the casting ability once, so that the feat uses the ability I want.
8. As a Lorehold student, I want the Strixhaven Initiate feat granted by my background and its spell picks offered with it, so that I do not take the feat twice.
9. As a player with Fey Touched or Shadow Touched, I want Misty Step or Invisibility and one more spell from the listed schools, each castable once per long rest, so that the feat does what it says.
10. As a player with Fey Touched, I want the casting ability to be the one my +1 from the feat raised, so that it follows my choice.
11. As a player with Telekinetic, I want Mage Hand at will with no pick to make, so that a fixed grant just appears.
12. As a player with Telepathic, I want Detect Thoughts once per long rest, so that the fixed daily cast is tracked.
13. As a player with Spell Sniper, I want to choose one cantrip that needs an attack roll from my chosen class's list, so that the feat's pick is limited to valid cantrips.
14. As a player with a feat from a newer book (Adept of the Red Robes, Gift of the Metallic Dragon, Scion of the Outer Planes, and so on), I want its spells to appear without the app knowing the feat's name, so that new books work.
15. As a player, I want each source on its own card with its own ability, DC and attack bonus, so that two feats with different abilities never share a wrong number.
16. As a player, I want a daily spell's counter to reset on a long rest, so that I never reset it by hand.
17. As a player, I want granted spells not to count against my class's spells known or prepared, so that my class budget is unchanged.
18. As a player, I want granted spells not to appear among my class's known or prepared spells, so that removing the feat leaves no ghost spell.
19. As a player who removes or swaps the feat, I want its picks released and a review notice shown, so that stale spells disappear.
20. As a player who changes background or race, I want the picks and counters of the old source released, so that only what I hold counts.
21. As a player picking a spell for a feat, I want the offered spells limited to my active books, so that I see only what my table allows.
22. As a player who has not yet made a required pick, I want a "needs review" notice and the unpicked part of the card absent, so that nothing is invented.
23. As a Dark Elf (Drow) player, I want Dancing Lights now, Faerie Fire from level 3 and Darkness from level 5, read from the Catalog, so that the table in code can go.
24. As a player of a newer race that lets me choose the casting ability (Aarakocra, Fairy, Githyanki and others), I want to choose Intelligence, Wisdom or Charisma with the race's other choices, so that the card uses my ability.
25. As a player of a race whose spells unlock at a character level, I want each spell to appear only from that level, so that the card matches the race.
26. As a High Elf or half-elf of high-elf descent, I want my wizard cantrip pick to keep working, including on a character saved before this change, so that nothing is lost on update.
27. As a player with a saved character built on the old race table, I want its once-per-rest counters to keep working after the update, so that usage is not wiped.
28. As a player on the SRD Baseline only, I want High Elf and Tiefling spells to work as before and feats to behave as before, so that nothing breaks without an Integrated Catalog.
29. As a player with a stale Integrated Catalog, I want to be asked to re-sync, so that the granted spells arrive.
30. As a Strixhaven Lorehold student with Spellcasting, I want the college's expanded spells added to my class's spell list, so that I can learn or prepare them.
31. As a multiclass student with two spellcasting classes, I want the expanded spells added to the list of each, so that the book's multiclass rule holds.
32. As a student without Spellcasting or Pact Magic, I want no expanded spells shown, so that the list is not offered without a caster.
33. As a Ravnica guild background player (Izzet Engineer and the others), I want its expanded cantrips and spells added the same way, so that the guilds work like the colleges.
34. As a Warlock with a patron's expanded list and a college background, I want both lists to apply, so that two sources stack.
35. As a player with Ritual Caster, Quicksmithing, Servo Crafting or Strixhaven Mascot, I want the feat's text to tell me what it gives, so that I know the sheet does not model it.
36. As a player with a feat that lets me cast a granted spell with a spell slot, I want the feat's text to tell me, so that I know to spend the slot myself.
37. As a player whose prerequisite is "the ability to cast at least one spell", I want a granted spell to satisfy it, so that Eldritch Adept-style prerequisites follow the data.
38. As a player on a narrow phone, I want the new cards and pick controls to fit the screen at every supported width, so that I can use them anywhere.
39. As a developer, I want the scraper to keep the structure of a feat's, background's and race's spell grants, so that the app names no feat.
40. As a developer, I want spells to carry an attack-roll field from the source data, so that Spell Sniper's pick is a filter and not a list.
41. As a developer, I want a coverage test that fails on a feat whose prose grants spells and which has neither spell data nor a reviewed mark, so that a new book is reviewed before it ships.
42. As a developer, I want a stale reviewed mark (naming no feat, or a feat that has data) to fail the test, so that marks cannot hide gaps.
43. As a developer, I want `check:live` to confirm that Magic Initiate, Strixhaven Initiate, Fey Touched, Spell Sniper, a Strixhaven background, a Ravnica background and Drow carry their grants in the catalog the in-app sync builds, so that the extractor is proven against real data.

## Implementation Decisions

- **Grant shape.** The spell grants of a race, subrace, feat and background are stored as the source gives them (a list of entries, each with an optional name for a choice between entries, an ability that is fixed, a list to choose from or inherited from the feat, and groups for spells known, innate at-will, daily and per-rest spells, ritual spells, and expanded spells). It is an optional field beside the existing Proficiency Grants, on the race, subrace, feat and background. The same shape is already carried by subclass additional spells; one type serves them all and the scraper keeps the structure. A choose entry is a filter: spell level, class list(s), school(s), ritual and attack roll, and a count.
- **Scraper.** The race, subrace, feat and background scrapers copy the source's additional spells into the model, whose spell names are normalised the same way the subclass ones are. Whatever runs the scraper (the CLI, the tracked-data enrichment and the in-app sync) gets it, since they share the scraper code. The spell scraper adds an attack-roll field to each spell from the source data (melee, ranged or other), so a filter on attack roll is a field comparison.
- **Coverage and marks.** A coverage test over the tracked data finds feats whose description grants spells ("you learn…cantrip", "you can cast…spell") and fails when such a feat has neither spell grants nor a reviewed mark. Marks live in the scraper's override area, in their own list: Ritual Caster, Quicksmithing, Servo Crafting and Strixhaven Mascot carry the "not modelled" mark (the ritual book), as does any feat the extractor cannot read. A mark that names no feat, or one on a feat that has grants, throws. Prior art: the proficiency and initiative coverage tests.
- **Catalog Format** rises from 8 to 9. The SRD Baseline carries only the grants of its own content (High Elf, Tiefling); if regenerating it changes bytes, that is its own commit through the prune script.
- **Reader.** One module turns a character plus the Catalog into its list of Innate Magic sources, replacing the table. For each source the character holds (race, subrace, any feat in the ASI selections, origin feats and class choices), it reads the grants, gates each by total character level where the grant has a level, resolves the casting ability (fixed, the player's pick, or the ability the feat's increase raised), computes the save DC and attack bonus, and produces the spells: at-will cantrips and spells, daily and per-rest spells with a Long Rest counter, and entries awaiting a pick. It is exposed through the Evaluated Character Engine. A spell named in a grant is resolved against the active books.
- **Picks** are saved as rule choices, keyed by the granting source so that two sources never collide, and reconciled with the rest of the character: removing or swapping the feat, background or race releases its picks and shows a review notice, like Fighting Initiate. Pick controls appear where the source is chosen: the feat picker (level-up and origin feat), the background section for a background-granted feat, and the ancestry section for a race (casting ability and the existing cantrip picks). The offered spells are the spells in the active books matching the filter.
- **Race migration.** The table is removed. The High Elf cantrip pick and the racial cantrip stored under the legacy owner key are migrated on load to the new pick storage. Counter ids already used for racial daily spells are kept so usage survives. A pick that no longer matches raises a review notice.
- **Expanded lists from backgrounds.** The reader that decides whether a spell is on a class's list also includes the background's expanded spells, for every spellcasting class of the character, once the character has Spellcasting or Pact Magic. Cantrips in the list count. They stack with a subclass's expanded list.
- **Spells tab.** The "Innate & Racial Spells" card becomes one card per source, titled by the source (and the picked class or college where there is one), showing the casting ability, save DC and attack bonus, with each spell at will or with its counter. Copy is mechanics only (no explanatory notes). The prerequisite check "can cast a spell" keeps counting granted spells.
- **Scope of data.** Every race, feat and background in the source that grants spells is covered by the same reader. No feat, race or background name appears in app code for spells.

## Testing Decisions

- Tests check external behaviour: the profiles the engine returns for a character, the extracted grants for a source record, the coverage gaps over data, the rendered layout. They do not assert on private helpers.
- The main seam is the **Evaluated Character Engine**: characters from `makeChar()` are evaluated against a small test catalog of invented feats, races and backgrounds whose grants use the full vocabulary, so no non-SRD text enters the repo. Cases: fixed cantrip; fixed daily spell; a class-filter pick; a school-filter pick; an attack-roll-filter pick; fixed, chosen and inherited ability; level-gated race spells; two sources with different abilities; counters reset by a long rest; removal and swap releasing picks; a background-granted feat; expanded lists on one class, on two classes and on a non-caster; prerequisite satisfied by a granted spell; the old table's characters migrated. Prior art: the evaluation tests, the innate magic and subclass spell tests, the reconciler tests.
- **Scraper extractor:** record-level tests for each source type. Prior art: the subclass additional-spells tests and the initiative-bonus scrape tests.
- **Coverage:** a test over the tracked data fails on uncovered feats and on stale marks. Prior art: the proficiency and initiative coverage tests.
- **`check:live`**: Magic Initiate, Strixhaven Initiate, Fey Touched, Spell Sniper, a Strixhaven background, a Ravnica background and Drow carry their grants; a wizard with Magic Initiate (Cleric) evaluates to a card with Wisdom as its ability; a Drow of level 5 has Faerie Fire and Darkness from the catalog.
- **Layout:** a `layout:check` scenario opens the Spells tab with granted-spell cards and the pick controls at the four widths.
- Verification per AGENTS.md: `npm run check:all`, `npm run check:live`, and `npm run layout:check` for the UI tickets.

## Out of Scope

- Ritual-only grants (Ritual Caster, Quicksmithing, Servo Crafting, Strixhaven Mascot): the feat's text tells the player.
- Casting a granted spell with a spell slot (Fey Touched, Shadow Touched): the feat's text tells the player.
- Magic items that cast spells.
- Class features that grant spells (invocations, Pact of the Tome and the like), already handled elsewhere.
- Changing how a subclass's additional spells work (ADR 0007); only the shared type is reused.
- A "known spells" count or filtering by a class for feat spells that the source leaves open beyond the filter the source states.

## Further Notes

- The raw 5etools data carries structured spell grants on 27 feats, 22 races and 15 backgrounds. Of the backgrounds, five (the Strixhaven colleges) also grant Strixhaven Initiate through a feat, and ten (the Ravnica guilds) have only an expanded list.
- Every background that grants a feat is already mapped by a table in code; that table is not part of this spec.
- The seams above should be confirmed with the user before the tickets are cut.
