# 01: Spell counts in the Catalog

**What to build:**

- **Class records.** In `dnd5eToolsScrap/src/scrapers/classes.ts` (~252, the `spellcasting` object), emit three optional fields, each an array of 20 numbers indexed by class level − 1, copied from the raw record when present:
  - `cantripsKnown` from `cantripProgression`
  - `spellsKnown` from `spellsKnownProgression`
  - `spellbookSpellsGained` from `spellsKnownProgressionFixed`

  Ignore `spellsKnownProgressionFixedByLevel`; the Warlock's arcanum is Mystic Arcanum and is already handled.
- **Subclass records** (~345): emit `cantripsKnown` and `spellsKnown` from the subclass's `cantripProgression` and `spellsKnownProgression` (the Eldritch Knight and the Arcane Trickster).
- **Types.** Add the fields, with doc comments, to:
  - the scraper models: `dnd5eToolsScrap/src/types/models.ts` (~163 `spellcasting`, and `SubclassModel`)
  - the app types: `src/types/dnd5e.ts` (`ClassData.spellcasting` ~189, `SubclassData` ~160)
- **Format.** Raise `REQUIRED_CATALOG_FORMAT` in `src/services/compendiumStorage.ts` from 16 to 17, and update `checks/compendium.test.ts` as commit c7d7592 did for 16.
- **Data.** Regenerate the tracked `dnd5eToolsScrap/data/classes.json` the way the scraper's README says. Then run `node scripts/prune-to-srd.mjs`, which should add the fields to the SRD classes in `src/data/classes.json`. Check that the prune changes nothing else in `src/data` beyond those fields and any timestamp it always writes; restore an unrelated timestamp-only change.

The app does not read the fields yet (ticket 02).

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** a7d2e29 (scraper fields, `dnd5eToolsScrap/checks/spell-counts.test.ts`, types, format 17), 0c12c00 (regenerated `dnd5eToolsScrap/data/classes.json`; it also carries changes the scraper already made since the last regeneration: class fluff descriptions, folded subclass choices, `additionalSpells`), 111d16e (SRD Baseline). The full `prune-to-srd` was not used: it would bring PHB fluff descriptions (non-SRD) and folded Ranger choices into `src/data` and fail `featureOptionsDescription.test.ts`; only the three count fields were copied from the PHB records (SRD: Bard 2→4 cantrips / 4→22 spells, Cleric 3→5, Druid 2→4, Ranger 0→11 spells, Sorcerer 4→6 / 2→15, Warlock 2→4 / 2→15, Wizard 3→5 / spellbook 6 then 2; Paladin none). Filed `.scratch/quick-fixes-nov-2026/issues/06-prune-to-srd-keeps-the-baseline.md`. check:all and check:live passed.

- [x] A scraper test (`dnd5eToolsScrap/checks/`, like `feat-ability-choices.test.ts`) feeds raw records and checks the output:
  - a Bard-like class with `cantripProgression` and `spellsKnownProgression`
  - a Wizard-like class with `spellsKnownProgressionFixed`
  - a Cleric-like class with only `cantripProgression` (no `spellsKnown`)
  - an Eldritch Knight-like subclass
- [x] In the regenerated SRD `src/data/classes.json`, paste for Bard, Cleric, Druid, Sorcerer, Warlock, Wizard, Ranger and Paladin which of the three fields each has, and their level-1 and level-20 values. Paladin has none.
- [x] `npm run check:all` and `npm run check:live` pass.
