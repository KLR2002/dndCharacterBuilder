# 23: A race the SRD offers without a subrace stays selectable without one in the integrated catalog

**What to build:** With integration enabled, the race picker (`src/components/builder/AncestrySection.tsx`) lists Half-Elf only by its six variant descents. The plain Half-Elf with no subrace, which the SRD Baseline offers, cannot be picked. The same gap exists for any race the SRD Baseline holds with no subrace that the integrated catalog gives several subraces and no unnamed base entry (Dragonborn, Tiefling, Half-Elf; Human already has an unnamed base subrace and Half-Orc has no subraces).

**Blocked by:** None

**Status:** done

**Landed:** merged from `pr/23-base-race-form` (1032657, 6ad1743). `check:all` passes (1142 app tests, 149 scraper tests, 322 known type errors none new); layout checks green in both modes. `offersPlainRaceForm` (`src/rules/ancestryEngine.ts`) gives Half-Elf, Dragonborn and Tiefling a plain-form row in the integrated race picker (the SRD Baseline holds each without a subrace; the base records match the SRD's bonuses); Dwarf, Elf, Halfling, Gnome, Human, Half-Orc and races with no SRD record get none. Picking the plain Half-Elf leaves no subrace and the Choice ASI picker shows. Open items: the layout script's seeded character already has a race, so the race picker card is covered by unit tests but not by a screenshot; the subrace rows and the plain row now share one row renderer.

## Design notes

- Rule: a race card offers an extra first row for the plain form (race with no subrace, `selectRace(race)` with no subrace index) when the race has more than one subrace, none of them an unnamed base, and the SRD Baseline holds a race of that name with no subraces (or only unnamed ones). Races the SRD only holds with a required subrace (Dwarf, Elf, Halfling, Gnome) get no plain row.
- Put the rule in a pure function in `src/rules/ancestryEngine.ts` (or a nearby rules module) with tests; the SRD Baseline races come from `src/data/races.json` (see `src/services/compendium.ts`). The component only renders the row, labelled with the race name, with the ASI line the other rows use (the race's own fixed bonuses; "Choice ASI" for Half-Elf as the existing rows do).
- Selecting the plain form must produce the same character the SRD flow produces: no `subraceName`, race bonuses and Choice ASI as for the SRD record. Test that `applyAncestrySelection(character, race)` for the integrated Half-Elf yields the Choice ASI state and no subrace.
- Do not edit `src/data/` or `dnd5eToolsScrap/data/`. Use invented race names in fixtures where possible; the integrated Half-Elf can be read from `dnd5eToolsScrap/data/races.json` in a test, as other checks do.

## Acceptance criteria

- [ ] Integrated Half-Elf, Dragonborn and Tiefling offer a plain-form row; Dwarf, Elf, Halfling, Gnome, Human (unchanged) and races with no SRD record do not gain one. Covered by a rule test.
- [ ] Picking the plain Half-Elf leaves no subrace and offers the Choice ASI picker.
- [ ] `npm run check:all` and `npm run layout:check -- --integrated` pass.
