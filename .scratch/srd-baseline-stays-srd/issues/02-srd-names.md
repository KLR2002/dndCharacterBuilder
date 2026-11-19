# 02: SRD records carry SRD names

**What to build:**

- **Scraper.** `dnd5eToolsScrap/src/scrapers/spells.ts` and `items.ts` emit `srdName?: string` when the 5etools record's `srd` field is a string. That string is the SRD's name for the record, for example `"Melf's Acid Arrow"` gives `srdName: "Acid Arrow"`.
  - Add the field, with a doc comment, to the scraper models (`dnd5eToolsScrap/src/types/models.ts`) and the app types (`SpellData`, `ItemData` in `src/types/dnd5e.ts`).
  - Do not raise `REQUIRED_CATALOG_FORMAT`.
  - Regenerate the tracked `dnd5eToolsScrap/data/spells.json` and `items.json` the way the scraper's README says. Report any change beyond the new `srdName` fields; do not revert scraper output.
- **Prune.** In `scripts/srdBaseline.ts` (ticket 01), a pure step renames the SRD spells and items:
  - The record's `name` becomes its `srdName`, and `srdName` is dropped from the baseline record.
  - Every reference to an old name anywhere in the other `src/data` records is rewritten, case-insensitively. That covers:
    - class `additionalSpells` and `spellChoice` spell lists (Circle of the Land Swamp: `"Melf's acid arrow"` → `"acid arrow"`, keeping the lower case the list uses)
    - `description` and `rawEntries` text, including 5etools tags such as `{@spell Melf's Acid Arrow}`
    - item references

  Run the prune and restore a timestamp-only `summary.json`.
- **Migration.** A pure function, for example `renameSrdNames(character, compendium)` in `src/rules/`, renames saved names when the compendium is integrated:
  - It applies to every place a character saves a spell or item name together with a source, when that source is `"SRD"` and the name matches a compendium record (any source) carrying `srdName`. Find the places from `Character` in `src/types/character.ts`: `knownSpells`, the name segment of `preparedSpells` keys, `ritualBook`, `subclassSpellSwaps`, inventory items, and any other. List them in your report.
  - A saved name with no source, or a source other than `"SRD"`, is left alone.
  - With the SRD Baseline, it returns the character unchanged.
  - Call it on the load path in `src/context/CharacterContext.tsx`, after `migrateCharacter`, with the current Compendium.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Scraper test (`dnd5eToolsScrap/checks/`): a raw spell with `srd: "Acid Arrow"` gives `srdName`; `srd: true` gives none; the same for an item.
- [ ] `checks/srdBaseline.test.ts` adds:
  - The rename step on a small input: a renamed spell, a lower-case reference in a class spell list, and a `{@spell ...}` tag in text.
  - On the tracked data: for every record in `dnd5eToolsScrap/data/spells.json` and `items.json` with `srdName`, its old name appears nowhere in `src/data` (case-insensitive), and `src/data` has a record named by its `srdName`.
  - No file under `src/` contains any of those old names.
- [ ] Migration tests, with `integratedTestCompendium()` and the SRD compendium:
  - An SRD-sourced known and prepared "Melf's Acid Arrow" and an SRD-sourced "Heward's Handy Haversack" item become "Acid Arrow" and "Handy Haversack" with the integrated compendium.
  - With the SRD compendium, nothing changes.
  - A PHB-sourced "Melf's Acid Arrow" stays.
  - An SRD-sourced "Leomund's Tiny Hut" in the Ritual Book becomes "Tiny Hut".
- [ ] Update any test that uses an old name with an SRD source.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: `ONLY=Spells WIDTHS=393 npm run layout:check`, SRD, green.
