# 18: Race and background skill choices as Proficiency Choices

**What to build:** Race, subrace and background skill picks (for example the Half-Elf variant skills, the Orc and Tortle skill picks, and "any skill" backgrounds) are Proficiency Choices from scraped choice grants, saved in `proficiencyPicks`, and the text-parse offers in `getRacialSkillChoices` and the `skillChoices` / `chosenSkills` path for race and background are removed.

**Blocked by:** 10

**Status:** ready-for-agent

**Decision:** the owner asked for this to be finished. Needs scraper choice grants, a gate for the Half-Elf variant subraces, and a migration of saved race and background picks into `proficiencyPicks`.

**Owner report:** some backgrounds (Investigator, Cloistered Scholar, and the custom background) offer no way to choose proficiencies from a pool. Each must offer its pool choice (for example Cloistered Scholar's History plus one of a short list; the custom background's free picks), covered by a test per example.

- [ ] Investigator, Cloistered Scholar and the custom background offer their pool picks.
- [ ] Race and background skill picks are Proficiency Choices and old saved picks still load.
- [ ] The text-parse offers are deleted.
- [ ] `npm run check:all` passes.
