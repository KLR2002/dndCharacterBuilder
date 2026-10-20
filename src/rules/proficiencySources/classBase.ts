import type { Character } from "../../types/character.ts";
import type { ClassData } from "../../types/dnd5e.ts";
import { MULTICLASS_PROFICIENCIES } from "../../constants/rules.ts";
import { normalizeArmorProficiency, normalizeWeaponProficiency } from "../proficiencies.ts";

/**
 * The armor and weapon proficiencies the character's classes grant: the first class's starting
 * proficiencies from the class data, and the multiclass table for each later class. Private to the
 * Proficiency Sheet (ADR 0015); nothing outside the sheet reads a class's proficiency fields.
 */
export function classBaseProficiencies(character: Character, classes: ClassData[]) {
  const armor = new Set<string>(), weapons = new Set<string>();
  for (const [index, c] of character.classes.entries()) {
    if (c.level < 1) continue;
    const data = classes.find(x => x.name === c.className && (!c.source || x.source === c.source));
    const grants = index === 0 ? { armor: data?.armorProficiencies, weapons: data?.weaponProficiencies } : MULTICLASS_PROFICIENCIES[c.className];
    for (const x of grants?.armor || []) {
      if (x && x.trim()) armor.add(normalizeArmorProficiency(x));
    }
    for (const x of grants?.weapons || []) {
      if (x && x.trim()) weapons.add(normalizeWeaponProficiency(x));
    }
  }
  return { armor: [...armor], weapons: [...weapons] };
}
