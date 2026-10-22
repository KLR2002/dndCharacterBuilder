# 22: Custom background offers tool-or-language picks; Stonecunning grants no History

**What to build:** Two owner-requested changes from the ticket 18 open items.

1. A custom background offers two picks from tools and languages together, in any combination (the rule: two tool or language proficiencies in any combination). It replaces the current "two languages of any" choice. The two skills of any stay as they are.
2. A Dwarf's Stonecunning trait no longer adds History to the character's skills. The trait-text scan skips the trait named Stonecunning, hardcoded.

Not in scope: Astral Elf and Githyanki keep losing their long-rest skill offer (the owner tracks those skills by hand).

**Blocked by:** None

**Status:** done

**Landed:** merged from `pr/22-custom-bg-stonecunning` (c2bedbd, 1d9514b, fa42850). `check:all` passes (1139 app tests, 149 scraper tests, 322 known type errors none new). A custom background offers one pick of 2 from tools and languages together (new type-only pool kind `anyOf`; the grant keeps its id and `languages` category, so saved language picks stay valid); a pick lands in the sheet's tools or languages by which list names it (the two lists share no name). Picker title reads "Tool or language". `getAutoGrantedSkills` skips the Stonecunning trait, so Dwarves hold no History from it; the skills baseline was re-recorded by its env var and 72 rows changed, each losing only `proficient: History` (the Hill Dwarf and Forge cleric scenarios). Open items: layout check not run (no UI file changed, only a longer picker title); no device check; devices with a cached catalog are unaffected (the custom background is declared in app code).

## Design notes

- The custom background's grants are declared in `src/rules/customBackground.ts`. Keep the existing grant id `Custom/Background/Custom Background@0#languages:choice:any` and its `languages` category, so a language already picked stays valid. Widen its pool to draw from tools and languages.
- Add a pool variant for this to `ProficiencyPool` in `dnd5eToolsScrap/src/types/proficiency.ts` (type-only; the scraper never emits it), for example `{ kind: "anyOf"; categories: Array<"tools" | "languages"> }`. `poolNames` (`src/rules/proficiencyPools.ts`) returns the union of both lists. Confirm `ALL_TOOLS` and `ALL_LANGUAGE_NAMES` share no name; if they do, say so in the report.
- The sheet reads picks per category (`choicePickNames` in `src/rules/proficiencySheet.ts`). A picked tool must land in the tools of the sheet and a picked language in the languages, routed by which list names it. The other tool and language readers (`sourceGrants`, the Builder's background card, the offers' "held by another source" check in `src/rules/proficiencyChoiceOffers.ts`) must treat the mixed grant correctly: an option already held as a tool or as a language is not offered again.
- The picker title descriptor reads "Tool or language" for this grant, not "Language".
- Stonecunning: in `getAutoGrantedSkills` (`src/rules/proficiencySources/skillGrants.ts`), skip a trait whose name is Stonecunning, with a short comment saying its text only conditions a check and is not a proficiency. Use invented trait text in the test. If a characterization baseline row changes, re-record only through its recorder env var and explain each changed row.

## Acceptance criteria

- [ ] A custom background offers one pick of 2 from tools and languages together, and 2 skills of any. A click moves the counter. Covered at the offer seam.
- [ ] A tool pick appears among the sheet's tools and a language pick among its languages; a name held from another source is not offered again; a saved language pick under the old id stays valid.
- [ ] A Dwarf with the Stonecunning trait holds no History; a trait of another name that names a skill still grants it.
- [ ] `npm run check:all` passes; `npm run layout:check` passes if UI changed.
