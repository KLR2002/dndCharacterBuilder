import type { AbilityKey, AbilityScores, Character, CharacterClass, KnownSpell } from "../types/character.ts";
import type { ResolvedAncestry } from "./types.ts";
import { CLASS_DATA, isThirdCaster, PHB_HALF_CASTER_SLOTS, PHB_THIRD_CASTER_SLOTS } from "./classData.ts";
import { MULTICLASS_SPELL_SLOTS, WARLOCK_PACT_SLOTS } from "../constants/rules.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export interface ClassSpellProfile {
  className: string;
  source: string;
  level: number;
  ability: AbilityKey;
  spellSaveDc: number;
  spellAttackBonus: number;
  maxSpellLevel: number;
  preparedLimit?: number;
  knownSpells: KnownSpell[];
  preparedSpells: string[];
}

export function isCastingClass(c: CharacterClass): boolean {
  if (c.level < 1) return false;
  if (isThirdCaster(c)) return true;
  if (c.className === "Artificer") return true;
  const kind = CLASS_DATA[c.className]?.caster;
  if (kind === "half") return c.level >= 2;
  return kind === "full" || kind === "pact";
}

export function getSpellcastingAbility(c: CharacterClass): AbilityKey | undefined {
  if (isThirdCaster(c)) return "int";
  if (c.className === "Artificer") return "int";
  return CLASS_DATA[c.className]?.spellAbility;
}

export function getMaxSpellLevel(c: CharacterClass): number {
  if (isThirdCaster(c)) {
    return PHB_THIRD_CASTER_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  const kind = CLASS_DATA[c.className]?.caster;
  if (kind === "full") {
    return MULTICLASS_SPELL_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  if (kind === "half") {
    return PHB_HALF_CASTER_SLOTS[Math.min(c.level, 20)]?.length || 0;
  }
  if (kind === "pact") {
    return WARLOCK_PACT_SLOTS[Math.min(c.level, 20)]?.slotLevel || 0;
  }
  if (c.className === "Artificer") {
    return Math.min(5, Math.ceil(c.level / 4));
  }
  return 0;
}

export function getPreparedLimit(c: CharacterClass, modifiers: AbilityScores): number | undefined {
  if (c.className === "Cleric" || c.className === "Druid") {
    return Math.max(1, c.level + modifiers.wis);
  }
  if (c.className === "Wizard") {
    return Math.max(1, c.level + modifiers.int);
  }
  if (c.className === "Paladin") {
    return Math.max(1, Math.floor(c.level / 2) + modifiers.cha);
  }
  if (c.className === "Artificer") {
    return Math.max(1, Math.floor(c.level / 2) + modifiers.int);
  }
  return undefined;
}

export function calculateWarlockPactSlots(character: Character): { count: number; level: number } | null {
  const warlock = (character.classes || []).find(c => c.className === "Warlock");
  if (!warlock || warlock.level < 1) return null;
  const pact = WARLOCK_PACT_SLOTS[Math.min(warlock.level, 20)];
  return pact ? { count: pact.slotCount, level: pact.slotLevel } : null;
}

export function getClassSpellProfiles(character: Character, opts: ResolvedAncestry = {}): ClassSpellProfile[] {
  const castingClasses = (character.classes || []).filter(isCastingClass);
  if (castingClasses.length === 0) return [];

  const pb = proficiencyBonus(totalLevel(character));
  const { modifiers } = effectiveScores(character, opts);
  const isSingleCaster = castingClasses.length === 1;

  return castingClasses.map(c => {
    const ability = getSpellcastingAbility(c) || "int";
    const abilityMod = modifiers[ability] ?? 0;
    const spellSaveDc = 8 + pb + abilityMod;
    const spellAttackBonus = pb + abilityMod;
    const maxSpellLevel = getMaxSpellLevel(c);
    const preparedLimit = getPreparedLimit(c, modifiers);
    const classOwnerKey = `${c.className}__${c.source || "PHB"}`;

    const knownSpells: KnownSpell[] = (character.knownSpells || [])
      .filter(k => {
        if (k.ownerKey === classOwnerKey) return true;
        if (isSingleCaster) return true;
        if (!k.ownerKey && k.className === c.className) return true;
        return false;
      })
      .map(k => ({
        name: k.name,
        source: k.source,
        ownerKey: k.ownerKey && k.ownerKey !== "unknown__unknown" ? k.ownerKey : classOwnerKey,
        ...(k.className ? { className: k.className } : {}),
      }));

    const preparedSpells: string[] = (character.preparedSpells || []).filter(key => {
      if (key.endsWith(`__${classOwnerKey}`)) return true;
      if (isSingleCaster) return true;
      return false;
    });

    const profile: ClassSpellProfile = {
      className: c.className,
      source: c.source || "PHB",
      level: c.level,
      ability,
      spellSaveDc,
      spellAttackBonus,
      maxSpellLevel,
      ...(preparedLimit !== undefined ? { preparedLimit } : {}),
      knownSpells,
      preparedSpells,
    };

    return profile;
  });
}
