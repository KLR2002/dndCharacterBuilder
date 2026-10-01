import type { Character } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { MULTICLASS_PROFICIENCIES } from "../constants/rules.ts";
export { MULTICLASS_PROFICIENCIES, MULTICLASS_PREREQUISITES } from "../constants/rules.ts";

export function totalLevel(character: Character): number {
  return (character.classes || []).reduce((sum, c) => sum + c.level, 0) || 1;
}
export function proficiencyBonus(level: number): number { return Math.floor((level - 1) / 4) + 2; }
export function proficiencies(character: Character, classes: ClassData[]) {
  const armor = new Set<string>(), weapons = new Set<string>(), tools = new Set<string>();
  for (const [index, c] of character.classes.entries()) {
    if (c.level < 1) continue;
    const data = classes.find(x => x.name === c.className && x.source === c.source);
    const grants = index === 0 ? { armor: data?.armorProficiencies, weapons: data?.weaponProficiencies, tools: data?.toolProficiencies } : MULTICLASS_PROFICIENCIES[c.className];
    for (const x of grants?.armor || []) armor.add(x);
    for (const x of grants?.weapons || []) weapons.add(x);
    for (const x of grants?.tools || []) tools.add(x);
  }
  return { armor: [...armor], weapons: [...weapons], tools: [...tools] };
}
