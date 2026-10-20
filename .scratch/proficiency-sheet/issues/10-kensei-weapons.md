# 10: Kensei weapons

**What to build:** A Way of the Kensei monk chooses one melee and one ranged weapon type at 3rd level and another at 6th, 11th and 17th level. The pool is any simple or martial weapon without the heavy or special property, plus the longbow, read from the Compendium's weapon properties and not from a typed list. Each chosen weapon adds weapon proficiency to the sheet and counts as a Monk Weapon. The choices appear as "Picked N / M" in the Class & Subclass Choices card.

**Blocked by:** 05, 09

**Status:** done

**Landed:** merged from `ps/10-kensei-weapons` (830913b). Artificer firearm fix included. Limits: simple/martial comes from the app's weapon lists, not the Compendium (other-book weapons are not offered); existing integrated catalogs need a re-sync.

- [ ] The pool excludes heavy and special weapons and includes the longbow, derived from item properties.
- [ ] A chosen weapon is proficient and a Monk Weapon (Dexterity and the Martial Arts die apply as for other Monk Weapons).
- [ ] Choices unlock at 3, 6, 11 and 17 and show as pending when unmade; nothing is blocked.
- [ ] Changing subclass or leveling down releases picks that no longer apply, with a notice.
- [ ] The picker hides weapons already held.
- [ ] Rows pass `npm run layout:check` in both modes.
- [ ] `npm run check:all` passes.
