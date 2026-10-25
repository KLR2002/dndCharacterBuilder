# 37: Ancestry picks are named for what they pick, stay off the Class tab, and can be hidden

**What to build:** Owner bug report on a Variant Human Cleric / Rogue. Three problems: (1) the language and skill pickers on the Race tab are headed "Human" and "Variant", the names of the race and subrace that grant them, which says nothing about what is picked; (2) the Variant Human skill pick also appears in the Class tab's Skills card ("Variant", between the Cleric starting skills and Blessings of Knowledge), where it does not belong; (3) the owner wants to hide and reveal these picker cards for a clear view.

**Blocked by:** 35

**Status:** ready-for-agent

## Design notes

- Cause of (2): `skillPickOffers` in `src/rules/proficiencyChoiceOffers.ts` lists every skill Proficiency Choice of every feature, including race, subrace and background ones. Those already show on the Race and Background tabs (`raceProficiencyChoices` and `backgroundProficiencyChoices` in `src/components/tabs/BuilderTab.tsx`). The Skills card must hold only the class, subclass and feat skill picks (the origins the Class tab owns). Fix it in the rules module and test it there; `ClassProgressionSection.tsx` already takes `skillPickIds` from it, so the Race pick then falls through correctly (check it does not reappear in "Class & Subclass Choices": that list filters to class, subclass and feat origins).
- Cause of (1): `choiceOfferEntries` titles each pick with `pickerTitles(feature.name, ...)`. For a race or subrace feature (`feature.origin` `Race` or `Subrace`) title the pick by what it picks instead: the descriptor (`Language`, `Skill`, `Tool`, ...), numbered in grant order when several race picks share a descriptor ("Language 1", "Language 2"), as `pickerTitles` already numbers its titles. Count across all race and subrace picks of the character, because the Race tab shows them together. Leave background, class, subclass and feat titles as they are (`Cloistered Scholar: Skill` is asserted by `checks/raceBackgroundSkillPicks.test.ts`).
- (3): one small shared collapsible card header (a title row with a chevron, `accessibilityState={{ expanded }}`, same icon style as `StartingEquipmentChoices.tsx`) used for: the Race tab's languages-and-picks card, the Background tab's picks card, and the Class tab's Skills card. Open by default; the state is local to the component and need not persist. A collapsed card shows its title row only. The Race card's heading is "Languages & Proficiencies" only if it holds more than languages; otherwise name it for what it holds. Keep the copy minimal (`CODING_STANDARDS.md` section 8). Put the header in `src/components/ui/` or `src/components/builder/builderStyles.tsx`, whichever the neighbours do; do not add a new picker component.
- Reproduce first in the running app (`docs/agents/driving-the-app.md`, integrated catalog): Variant Human (PHB), Acolyte, Cleric 1 with Knowledge Domain, Rogue 1. Screenshot the Race and Class tabs at 320 and 393 px before and after.
- Layout: extend the existing layout scenarios (integrated Knowledge Cleric + Rogue) to use a Variant Human, expect the new titles and that the Class tab Skills card has no "Variant" picker, and add a collapsed-state check. Iterate with `ONLY=skill WIDTHS=320`, run the full layout check once at the end (both modes).

## Acceptance criteria

- [ ] The Race tab headings read "Language" and "Skill" (numbered when a race holds several of one kind), never the race or subrace name.
- [ ] The Class tab Skills card holds only the starting, multiclass and subclass or feat skill picks; a race or background skill pick never appears there.
- [ ] The Race, Background and Class Skills cards can be collapsed and expanded; both states fit at 320 px.
- [ ] Rules-level tests cover the offers' titles and `skillPickOffers` origin scope.
- [ ] Screenshots at 320 and 393 px are reviewed by the main session; `npm run layout:check` passes in both modes.
- [ ] `npm run check:all` passes.
