import type { Character, CharacterClass } from "../types/character.ts";
import type { ClassData } from "../types/dnd5e.ts";
import { MULTICLASS_SPELL_SLOTS, WARLOCK_PACT_SLOTS } from "../constants/rules.ts";
import { casterKindOf, isThirdCaster, PHB_HALF_CASTER_SLOTS, PHB_THIRD_CASTER_SLOTS } from "./classData.ts";
import { allCatalogClasses } from "./catalogs.ts";

export function pactSlots(character: Character): { count: number; level: number } | null {
  const level = character.classes.find(c => c.className === "Warlock")?.level || 0;
  const pact = WARLOCK_PACT_SLOTS[Math.min(level, 20)];
  return pact ? { count: pact.slotCount, level: pact.slotLevel } : null;
}
export function multiclassSlots(character: Character, classes: readonly ClassData[] = allCatalogClasses()) {
  const kindOf = (c: CharacterClass) => casterKindOf(c, classes);
  const casters = character.classes.filter(c => {
    const kind = kindOf(c);
    return (kind === "full" && c.level >= 1) || (kind === "half" && c.level >= 2) || isThirdCaster(c);
  });
  const pact = pactSlots(character);
  const casterLevel = casters.reduce((sum, c) => sum + (isThirdCaster(c) ? Math.floor(c.level / 3) : kindOf(c) === "half" ? Math.floor(c.level / 2) : c.level), 0);
  let slots = MULTICLASS_SPELL_SLOTS[Math.min(casterLevel, 20)] || [];
  if (casters.length === 1) {
    const c = casters[0];
    if (isThirdCaster(c)) slots = PHB_THIRD_CASTER_SLOTS[c.level] || [];
    else if (kindOf(c) === "half") slots = PHB_HALF_CASTER_SLOTS[c.level] || [];
  }
  return { isSpellcaster: casters.length > 0 || pact !== null, casterLevel, slots: [...slots], pact, warlockPactSlots: pact };
}
