# 35: The Class tab shows the skill choices together, named by their source

**What to build:** Owner bug report. On the Builder's Class tab the Cleric's own starting-skill picker ("Class: Cleric", pick 2) is a separate card at the very bottom, below Starting Equipment, while "Blessings of Knowledge: Skill" sits near the top in "Class & Subclass Choices". The owner never saw the starting skills and took the Blessings skills for them. The two are different grants and must read as different things, next to each other.

**Blocked by:** 33, 34

**Status:** done

**Landed:** merged from `pr/35-class-skill-choices-grouped` (00add39, 161076f). `check:all` passes on the merged tip (1219 app tests, 8 skipped, 192 scraper tests); `check:live` 54 of 54 on the branch; full `npm run layout:check -- --integrated` GREEN on the merged tip (main session run) and the SRD run GREEN on the branch. The Class tab has one `Skills` card above Class & Subclass Choices: `<Class> starting skills`, the feature name for a subclass pick (`Blessings of Knowledge`), `<Class> multiclass skill`; picks whose grant carries Expertise show an `Expertise` tag; the old `Class: <Class>` card at the bottom is gone. `skillPickOffers` in `src/rules/proficiencyChoiceOffers.ts` lists the skill picks; `ruleGrantedSkills` now reads the picks of every feature, so the starting picker holds a skill taken as a subclass or multiclass pick, and the pick offers already hid the starting picks. Two layout scenarios added (integrated Knowledge Cleric + Rogue; SRD Fighter + Rogue). Screenshots at 320 and 393 px viewed by the main session. Open items: an old save whose starting pick duplicates a Blessings pick shows that pick locked and not counted, and cannot be unpicked until the Blessings pick is cleared; the Fighter class card's level badge sits tight against the minus button at 320 px (not part of this change, not checked against an older build); the claim of starting equipment and the picks are still not clicked through in the running app by the main session.

## Design notes

- Reproduce first in the running app (`docs/agents/driving-the-app.md`, integrated catalog): a Human Acolyte, Cleric 1 with the Knowledge Domain subclass (PHB) and Rogue 1. Screenshot the Class tab at 320 and 393 px before changing anything; the bug is where the pickers are, so look at the page, not only at the tests.
- Put every skill choice the class tab offers in one card headed "Skills", ahead of Starting Equipment and Class & Subclass Choices: the first class's starting picker, each later class's multiclass skill pick (ticket 33), and the skill picks of subclass and feature choices (Blessings of Knowledge). Each picker is labelled with its source in words: "Cleric starting skills", "Rogue multiclass skill", "Blessings of Knowledge". Language, tool and weapon choices stay where they are.
- A skill pick whose grant carries Expertise (ticket 34) shows an "Expertise" tag on the picked names, so the player sees that those two picks are doubled. Interface copy stays essential (`CODING_STANDARDS.md` section 8): no explanatory note.
- Skills held from another source stay shown locked, as the starting picker already does. Check that picking a skill in one picker removes it from the others' options in both directions (today the Cleric's starting list still offers a skill already picked from Blessings, or taken as a later class's multiclass pick: the starting picker reads `ruleGrantedSkills`, which leaves out class-origin and subclass-origin features).
- Reuse `SkillPicker` and `ProficiencyChoicePicker`; do not add a third picker component. The grouping is presentation: the rules modules keep owning what is offered. If a rules helper is needed to list "the skill choices of this character" for the card, put it in `src/rules/` and test it there.
- Layout: add a `layout-check` scenario for this character (integrated only; the SRD baseline has no Knowledge Domain, so give the SRD run a Bard or Rogue multiclass character for the same card) that expects the labels and `fitsWidth`. Run the full layout check once at the end (`npm run layout:check`, and `-- --integrated`), `ONLY=skill WIDTHS=320` while iterating.

## Acceptance criteria

- [ ] The Class tab has one "Skills" card above Starting Equipment holding the starting picker, the multiclass skill pick and the Blessings skills, each named by its source.
- [ ] Blessings picks show an Expertise tag; the Expertise card has no Knowledge row.
- [ ] A skill taken in one picker is not offered in another.
- [ ] Screenshots at 320 and 393 px are reviewed by the main session; `npm run layout:check` passes in both modes.
- [ ] `npm run check:all` passes.
