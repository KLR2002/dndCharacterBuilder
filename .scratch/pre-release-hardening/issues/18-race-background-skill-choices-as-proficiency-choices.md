# 18: Race and background skill choices as Proficiency Choices

**What to build:** Race, subrace and background skill picks (for example the Half-Elf variant skills, the Orc and Tortle skill picks, and "any skill" backgrounds) are Proficiency Choices from scraped choice grants, saved in `proficiencyPicks`, and the text-parse offers in `getRacialSkillChoices` and the `skillChoices` / `chosenSkills` path for race and background are removed.

**Blocked by:** 10

**Status:** done

**Landed:** merged from `pr/18-skill-choices` (485c32f). `check:all` passes (1130 app tests, 149 scraper tests, 322 known type errors none new), scraper type check clean, layout checks green in both modes. Why the owner's backgrounds showed no pool: the scraper dropped every skill choice before extracting grants (Investigator: 2 of insight, investigation, perception; Cloistered Scholar: 1 of arcana, nature, religion; Orc, Tortle, Half-Elf and others likewise), and the custom background had no catalog record and no grant path (its skills were read-only badges). Race, subrace and background skill picks are now Proficiency Choices from scraped choice grants (re-scraped from the cached snapshot, SRD prune: Half-Elf's skill choice only; grants-only data diffs; no id or alias moved); saved picks migrate into `proficiencyPicks`; the text-parse offers (`getRacialSkillChoices`) are deleted and in the readers guard. The custom background's two skills and two languages of any are declared in `src/rules/customBackground.ts` since the SRD Baseline has no record. Verified by the main session against the catalog the in-app sync builds (live mirror, 30 classes) and in the running app: Investigator offers 2 skills from 3, Cloistered Scholar offers 2 languages and 1 skill from 3, the custom background offers 2 skills and 2 languages, and every click moves the counter. No baseline, allowlist or fixture changed. Open items: Astral Elf (AAG) and Githyanki (MPMM) lose a long-rest skill offer, as the reviewed Githyanki override already treats it; Kenku, Vedalken, Warforged and Amonkhet gain offers; the Half-Elf gate names `Skill Versatility` in app code; unmatched legacy picks stay in their old bucket instead of being released with a notice; custom background tool picks are not offered; no catalog format bump, so devices with a cached catalog need a re-sync to see the new offers; the trait-text scan that gives every Dwarf History is untouched; no device check.

**Decision:** the owner asked for this to be finished. Needs scraper choice grants, a gate for the Half-Elf variant subraces, and a migration of saved race and background picks into `proficiencyPicks`.

**Owner report:** some backgrounds (Investigator, Cloistered Scholar, and the custom background) offer no way to choose proficiencies from a pool. Each must offer its pool choice (for example Cloistered Scholar's History plus one of a short list; the custom background's free picks), covered by a test per example.

- [x] Investigator, Cloistered Scholar and the custom background offer their pool picks.
- [x] Race and background skill picks are Proficiency Choices and old saved picks still load.
- [x] The text-parse offers are deleted.
- [x] `npm run check:all` passes.
