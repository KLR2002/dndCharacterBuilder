# Spec: Non-SRD option text comes from the Integrated Catalog

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/non-srd-options-to-scraper/`).
**Related:** ADR 0003 (declarative Rule Choices in scraped race data), ADR 0013 (SRD Baseline and IndexedDB integration), ADR 0014 (this decision), CODING_STANDARDS §1, §3, §4. GLOSSARY terms *Rule Choice*, *Integrated Catalog*, *SRD Baseline*, *Compendium*, *Dataset Swapping*, *Totem Milestone*, *Primal Knowledge*, *Artificer Infusion*, *Replicate Magic Item*. Companion: `inventory.md` in this folder lists every hand-written place and what the raw 5e.tools data holds.

## Problem Statement

The application is meant to ship only SRD content, but the rules engine carries paraphrased non-SRD option text written by hand: the Totem Warrior animals, Genie kinds, Divine Soul affinities, Elemental Disciplines, Circle of the Land biomes, the Giant Power cantrips and 66 Artificer infusions, plus a fallback Pact Boon list and a Bear Totem line appended to Rage.

- The scraper already downloads most of this data, but it flattens structured choices into prose. The Totem Warrior's "choose one animal" arrives as a bullet list of names, and the animal features arrive as unlinked siblings called Bear, Eagle and so on at three levels, so the app re-types them.
- Hand-written text drifts from the catalog the player actually loaded. A player who owns the books sees the app's wording, not the book's.
- The repo carries non-SRD prose that ADR 0013 says it must not.

## Solution

Non-SRD Rule Choice options come from the Integrated Catalog, built by the scraper in the same declarative shape ADR 0003 gave race traits. The app keeps only structure: which choices exist, who owns them, at which level they are offered, and a names-only alias for old saved picks.

From the player's point of view:

- With the catalog loaded, every choice shows the book's own option names and descriptions, and picks already saved keep working.
- Without the catalog (SRD Baseline), non-SRD choices are not offered. A character that already holds picks keeps them untouched.
- A catalog synced before this change is recognised as stale. Settings says "Re-sync to get the latest class options". The affected choices stay hidden until then.

## User Stories

1. As a player with the catalog loaded, I want the Totem Spirit, Aspect of the Beast and Totemic Attunement choices to show the book's text for Bear, Eagle, Wolf, Elk and Tiger, so that I read the real rule when I choose.
2. As a player, I want Elk and Tiger offered only while the book that prints them (Sword Coast Adventurer's Guide) is active, so that Sourcebook Gating holds for individual options.
3. As a player, I want Elemental Disciplines offered by level (3, 6, 11, 17) using the book's own prerequisites, so that I cannot pick a discipline I have not unlocked.
4. As a player, I want Elemental Attunement kept out of the discipline choice because it is granted automatically, so that I do not spend a pick on it.
5. As a player, I want the Circle of the Land biomes, with their circle spell lists, read from the catalog, so that the Underdark and every other biome match the book.
6. As a Divine Soul sorcerer, I want the five affinities offered with their granted spell, so that I choose from the real list.
7. As a Genie warlock, I want the four genie kinds offered with their expanded spells, so that my patron choice is accurate.
8. As a Path of the Giant barbarian, I want Druidcraft and Thaumaturgy offered as the Giant Power cantrip, so that my cantrip comes from the feature.
9. As a Nature, Death or Arcana cleric, I want my domain cantrip(s) offered from the right spell list (druid cantrips, necromancy cantrips, two wizard cantrips) read from the catalog, so that the choice follows the book.
10. As a barbarian with the Primal Knowledge optional feature, I want to pick a skill from the class skill list at levels 3 and 10, so that the feature works as before.
11. As an Artificer, I want every infusion, including each Replicate Magic Item option, offered at its proper level with the book's text, so that my infusions known are complete.
12. As a warlock in SRD mode, I want the three SRD pact boons offered from the baseline, so that nothing depends on a fallback list.
13. As a returning player with saved characters, I want every pick I already made to keep working, so that no character loses a choice.
14. As a returning player who picked "Fist of Unbroken Air", I want that pick to resolve to the discipline now named "Unbroken Air", so that a rename in the source does not orphan it.
15. As a player whose catalog was synced before this change, I want Settings to tell me to re-sync, so that I know why some choices are missing.
16. As a player in that situation, I want the affected choices hidden rather than shown empty, so that I am never asked to pick from nothing.
17. As a player who reverts to the SRD Baseline, I want my existing picks left in place, so that re-syncing later restores everything.
18. As a player in SRD mode, I want non-SRD choices not offered at all, so that the app never implies content I have not loaded.
19. As a player, I want the Rage description not to carry a hand-written Bear Totem sentence, so that the text I read is the book's.
20. As a player, I want the same Rule Choice screens and flows as today, so that nothing I know changes except where the text comes from.
21. As a maintainer, I want the scraper to emit `choices` on class and subclass features, so that the app has one reader for declarative options.
22. As a maintainer, I want the scraper to fold sibling option features (Bear at 3, 6 and 14) into their parent feature, so that the parent and its options stay linked.
23. As a maintainer, I want spell-driven choices lifted from the named `additionalSpells` entries, so that biomes, affinities, genie kinds and Giant Power need no hand-written lists.
24. As a maintainer, I want cantrip-list choices to keep the scraped filter and resolve it in one generic resolver, so that three named resolvers disappear.
25. As a maintainer, I want the scraper to emit every Replicate Magic Item option as an Artificer Infusion option with its Artificer level, so that the 51 table rows need no hand-written definitions.
26. As a maintainer, I want a pointer table from each frozen Rule Choice id to its owner, feature locator, label, level and effect level, so that identity stays in code while text stays in the catalog.
27. As a maintainer, I want only choices in the pointer table surfaced, so that scraped `options` features the engine does not support never appear.
28. As a maintainer, I want a test that every frozen id still resolves against a catalog fixture, so that a scraper change cannot silently drop a choice.
29. As a maintainer, I want a names-only alias table for renamed options and a test that every option name the old table offered still resolves, so that saved picks survive.
30. As a maintainer, I want the prose-only rules (ki costs, maneuver action types, at-will invocation spells, swap schools) kept as curated name-and-number tables with completeness tests, so that no prose is parsed.
31. As a maintainer, I want the catalog to carry a format number and the application a required minimum, so that a stale catalog is detectable without guessing.
32. As a maintainer, I want the pick count read from the scrape and checked against the pointer table, so that a mismatch fails a test.
33. As a maintainer, I want the Pact Boon fallback list and the Artificer definition table deleted, so that no non-SRD descriptive text remains in the rules modules.
34. As a maintainer, I want the scraper tests to use invented placeholder text with the real raw structure, so that the repo never gains new proprietary prose.
35. As a maintainer, I want the existing characterization scenarios to keep passing against a fixture catalog, so that option names, ids and offered sets are proven unchanged.
36. As a maintainer, I want ADR 0014 and the glossary updated, so that the next person knows why the app offers nothing without the catalog.

## Implementation Decisions

**Scraper (class data)**
- Class and subclass features gain an optional `choices` field with the same shape as the race trait field from ADR 0003: a pick count and a list of options, each with a name, a description and an optional source. The source replaces the hand-written per-option book gate.
- The scraper builds it from the raw `options` entry on a feature: each reference resolves to the sibling feature of that name and level, whose rendered text becomes the option description and whose book becomes the option source. Resolved siblings are no longer emitted as loose features.
- Features still keep their rendered prose, so existing readers are unaffected.
- Spell-driven choices are lifted from the named `additionalSpells` entries of a subclass (one option per biome, affinity or genie kind) and from the two unnamed innate entries of the Giant subclass. Descriptions are built from the spell names. The app keeps reading `additionalSpells` for the actual spell grants.
- Cantrip-list choices keep the scraped `choose` filter and its count on the choice as `from`; there are no baked options for them.
- Level is not scraped for a choice. A feature already has its level; the offered level and effect level are curated (the ADR 0003 rule) and checked by a test.

**Scraper (options and infusions)**
- Elemental Discipline records already exist with structured level prerequisites; the app derives each discipline's unlock level from them.
- Replicate Magic Item rows are emitted from the infusion's table as Artificer Infusion options, one per row, named "Replicate Magic Item: X", with the Artificer level from the table's level column. The umbrella record is not offered as a selectable option.

**Catalog**
- The stored catalog carries a format number. The application declares the minimum it requires. A lower number means stale.
- Settings shows a re-sync prompt for a stale catalog. Choices that need the new fields are hidden while it is stale. No migration, no forced re-sync.

**Rule Choice module (app side)**
- The sixteen-row subclass choice table becomes a pointer table: frozen id, owner (class and subclass fragment), feature locator (name and level), label, offered level, effect level, an optional excluded option name (Elemental Attunement), and the Primal Knowledge optional-feature gate. It holds no description text.
- One reader turns a pointer row plus the Compendium into the offered options: static scraped options, spell-derived options, or a generic filter resolver. The three named cantrip resolvers are removed. The unchosen-Barbarian-skills resolver stays, since it derives from character state and the class skill list.
- Only choices with a pointer row are surfaced. A scraped `options` feature with no row is ignored.
- A names-only alias table resolves old saved pick names to current option names ("Fist of Unbroken Air" to "Unbroken Air"). It is applied wherever a saved pick is matched to an option.
- A choice whose options cannot be found in the active Compendium is not offered; its saved picks stay on the character and nothing is reconciled away.
- The frozen ids, their owners and the persisted entry shape do not change.

**Specialised modules**
- The Artificer infusion module reads infusions from the catalog's option records instead of its own definition table, which is deleted.
- The Warlock Pact Boon module drops its fallback list; the SRD Baseline already holds the three SRD boons.
- The hand-written Bear Totem sentence appended to Rage is deleted.

**Curated tables kept in code (names and numbers only)**
- Ki costs and spell for the Elemental Discipline spell map; Battle Master maneuver action types; the at-will invocation-to-spell table; the Clockwork Soul and Aberrant Mind swap schools. Each has a completeness test against the fixture catalog.

**Docs**
- ADR 0014 records the decision. GLOSSARY *Rule Choice* and *Integrated Catalog* are updated (done).

## Testing Decisions

A good test here asserts external behaviour: what the scraper emits for a given raw record, and which options a character is offered. It never asserts on private helpers or on the pointer table's layout.

**Seams (three, all existing; please confirm)**
1. **Scraper seam:** the class scraper called with a fake client serving raw-shaped placeholder records, asserting the emitted `choices`, folded siblings, lifted spell-driven choices, filters, and the Replicate Magic Item rows. Prior art: the scraper's rule-choice and conditions tests.
2. **Rule Choice interface seam:** the offered-choices and pick functions over a Compendium built from a fixture catalog, in both SRD and integrated modes, stale catalog included. This is also where the pointer table, the filter resolver, the alias table, option source gating and "saved picks survive" are exercised. Prior art: the Rule Choice interface test and the owner-teardown test.
3. **Catalog storage seam:** saving and loading a catalog with a format number through the existing storage test hooks, plus the Settings state that reports stale. Prior art: the compendium storage and context tests.

**Fixture rule**
- All fixtures use invented placeholder text with the real raw structure (the `options` entry, the feature references, the `additionalSpells` shapes). No real excerpts. The characterization baseline stays names and ids only.

**Characterization**
- The existing subclass choice characterization scenarios keep running against a fixture catalog whose option names match the old table. They prove ids, option names and offered sets are unchanged. They are not re-recorded.

**Guards**
- Every frozen id resolves in the fixture catalog. Every option name the old table offered resolves, directly or by alias. Every curated table has an entry for each relevant scraped option. A choice's pick count matches the pointer row.
- A negative test per mode: no catalog means no non-SRD choice is offered and saved picks remain.

## Out of Scope

- Race, feat and background rules tables: innate magic specs, racial skill, weapon and armor tables, half-feat ability lists, background skills and background feats, feature replacements. These are a follow-up spec.
- Parsing prose for ki costs, maneuver action types, at-will invocations or swap schools.
- Surfacing scraped `options` features that have no pointer row.
- A forced migration or automatic re-sync of an old catalog.
- Untracking the full scraped dumps under the scraper's data directory. Known issue for a separate decision.
- Adding new choices, new classes or new books.
- Changing frozen ids, the persisted Rule Choice entry shape, or the active-books model.
- Rewriting the fighting-style, maneuver and invocation modules, which already read the compendium.

## Further Notes

- The only name mismatch found between the hand-written table and the scraped data is "Fist of Unbroken Air" against "Unbroken Air"; infusion names all match.
- Fixture note: the Totem Warrior's raw records mix a headed parent (Totem Spirit) with headerless option siblings, and the book gate lives on the sibling (Elk and Tiger carry the SCAG source). The scraper must resolve by reference, not by name alone, because the same animal names repeat at three levels.
- Prune script impact: the SRD Baseline keeps Circle of the Land and its biome data; the new `choices` field must pass through the prune step unchanged for SRD subclasses.
