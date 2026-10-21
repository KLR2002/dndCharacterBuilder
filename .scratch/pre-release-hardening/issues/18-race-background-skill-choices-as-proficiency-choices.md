# 18: Race and background skill choices as Proficiency Choices

**What to build:** Race, subrace and background skill picks (for example the Half-Elf variant skills, the Orc and Tortle skill picks, and "any skill" backgrounds) are Proficiency Choices from scraped choice grants, saved in `proficiencyPicks`, and the text-parse offers in `getRacialSkillChoices` and the `skillChoices` / `chosenSkills` path for race and background are removed.

**Blocked by:** 10

**Status:** needs-triage

**Open question:** not required for the release gate; decide whether it ships before release. Needs scraper choice grants, a gate for the Half-Elf variant subraces, and a migration of saved race and background picks into `proficiencyPicks`.

- [ ] Race and background skill picks are Proficiency Choices and old saved picks still load.
- [ ] The text-parse offers are deleted.
- [ ] `npm run check:all` passes.
