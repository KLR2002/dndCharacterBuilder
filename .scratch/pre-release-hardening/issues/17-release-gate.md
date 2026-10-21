# 17: Release gate

**What to build:** The whole release is verified together. The full check and the layout check pass in both catalog modes, the catalog format is bumped exactly once for the release and no more, and the glossary and decisions note match what shipped.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 20

**Status:** done

**Landed:** merged from `pr/17-release-gate` (e9b9c20). `npm run check:all` passes (1088 app tests, 144 scraper tests, 322 known type errors none new, lint 0 errors and 1 pre-existing warning at `src/rules/proficiencyPicks.ts:123`); the scraper's own build (`tsc --noEmit`) passes; `npm run layout:check` and `npm run layout:check -- --integrated` are green. `REQUIRED_CATALOG_FORMAT` goes from 4 to 5 once, with the stale-catalog test covering the previous value. GLOSSARY.md (Grant Id, Catalog Format, Proficiency Choice, Monk Weapon) and decisions.md match the code; source comments carry no ticket references. Two `.scratch/proficiency-sheet/` path strings remain in `dnd5eToolsScrap/src/grants/cli-review.ts` (code and output strings).

Remaining known limits for the release notes:
- Not verified on a device: header name at 320 px shows about six characters beside the badges; a picked Totem option now lists as its own Features entry.
- Integrated caches synced before format 5 must be re-synced to regain class, race, background, skill, weapon, armor and Tiger proficiencies and grant ids.
- Reviewed sheet changes for existing characters: Mountain Dwarf and Githyanki subrace armor; Giff firearms; Drow, Pallid, Shadar-kai, Mark of Shadow and MPMM Githyanki lose weapons or armor they only had through name matches; Orc (five books) loses Intimidation and MPMM Tortle Survival (offered as picks); Artificer saves Con and Int; Tiger Stealth and Survival; six subrace languages gained; Wild Shape adoption refuses when the character cannot pay.
- Race and background skill picks still use the text-parse path, and every Dwarf gets History from a trait-text scan (ticket 18). Multiclass proficiencies still come from `MULTICLASS_PROFICIENCIES` (ticket 19).
- MPMM races' one free language is a source rule not verifiable offline; trait-text language choices use reviewed overrides; Hobgoblin's two martial weapons are not parsed so its light armor stays ungranted; the Sea Elf and Githyanki subrace overrides must be edited by hand on a re-scrape.
- Grant ids: same-kind choices in one feature are told apart by order, so a reorder moves picks (Kensei melee/ranged pair); a choice that changes kind moves its id with no alias.
- Kensei: `weaponHeld` still uses the standard lists; the 2014 scrape has no 2024-book weapons.
- Accepted: Expertise on tools other than Thieves' Tools, Cavalier and Samurai either/or grants, the three-skill Skilled feat, sidekick classes, derived stat bonuses, class equipment choices.
- Developer: 322 type errors stay in the checks ratchet baseline (the scraper's own `checks/` is not ratcheted); the nested-scroll guard misses parent-bounded scrolls and ternary or call-expression styles; the readers guard misses passing the whole namespace or dynamic import; Wild Shape's generic resource stepper is unguarded; tracked `dnd5eToolsScrap/data/classes.json` is stale against the scraper; UA Mystic gains Int and Wis saves with no baseline scenario; `classBaseProficiencies` lists active-book classes while saves, hit die and caster kind resolve across all books; `checks/monkKiSpells.test.ts` fails when run alone; the worktree script's install branch is untested.

- [x] `npm run check:all` passes, and so does the scraper's own `npm --prefix dnd5eToolsScrap run build` (type check), which `check:all` does not run.
- [x] `npm run layout:check` passes, and so does the same command with the integrated catalog option.
- [x] The catalog format is bumped once, in this ticket, after the last data change (class grants already changed the data since format 4), and the stale-catalog test covers the previous value.
- [x] `GLOSSARY.md` and `.scratch/pre-release-hardening/decisions.md` agree with the code; no ticket or slice numbers appear in source comments.
- [x] The ticket's Landed note lists the remaining known limits for the release notes.
