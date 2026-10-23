# 11: Skills on the Proficiency Sheet

**What to build:** Skill proficiencies come from the sheet (race, background, class, subclass features, feats, and existing picks), after a characterization test records the skills of existing characters and proves them unchanged except where a grant is newly applied. Expertise on skills reads the sheet.

**Blocked by:** 07, 08, 09

**Status:** done

**Landed:** merged from `ps/11-skills` (58f9307). Totem Warrior Tiger grant is gated on the Aspect of the Beast pick. Mastermind has no skill grant in the data. Knowledge Cleric Expertise still implies proficiency, overlapping the Blessings of Knowledge pick. Old skills.ts stays for ticket 12.

- [ ] A recorded baseline exists first; the only differences are newly applied grants, each listed.
- [ ] Skill picks (class skills, race and background choices, Rule Choice skill picks such as Primal Knowledge) are preserved.
- [ ] Subclass and feat skill grants apply and disappear with their source.
- [ ] `npm run check:all` passes.
