# 07: Saving throw proficiencies on the sheet

**What to build:** Saving-throw proficiencies come from the Proficiency Sheet: the first class's saves as today, plus subclass features such as Diamond Soul and feats that grant a saving-throw proficiency, with level gating. The saves on the card and any reader of saving-throw bonuses use the sheet. A characterization test first records the saves of existing characters and proves them unchanged except where a grant is newly applied.

**Blocked by:** 04

**Status:** done

**Landed:** merged from `ps/07-saves` (3928f5c). Resilient is tied to the raised ability; the layout check now starts Expo with `--clear`.

- [ ] A recorded baseline of saves exists first; after the change the only differences are newly applied grants, each listed.
- [ ] A monk at the level of Diamond Soul has proficiency in every saving throw.
- [ ] A character with a feat that grants one saving-throw proficiency has it; if the feat is removed it goes away.
- [ ] Multiclass characters do not gain the saves of an additional class.
- [ ] `npm run check:all` passes.
