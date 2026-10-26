import type { AbilityKey, Character } from "../types/character.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export interface InnateSpellEntry {
  name: string;
  level: number;
  minCharacterLevel: number;
  castingTime: string;
  source: string;
  isCantrip: boolean;
  resourceCounterId?: string;
  maxUses?: number;
}

export interface InnateSpellProfile {
  title: string;
  /** Whether the source is the character's race or subrace, or one of its feats. */
  origin: "race" | "feat";
  ability: AbilityKey;
  spellSaveDc: number;
  spellAttackBonus: number;
  spells: InnateSpellEntry[];
}

/**
 * The High Elf and half-elf descent wizard cantrip: the one Innate Magic source still read from the character's own pick
 * rather than from the Catalog (ADR 0017). Ticket 07 moves it into the granted spell reader; until then it stays here, alone.
 * Every other race's and subrace's spells come from the Catalog through the granted spell reader.
 */
export function getInnateSpellProfile(character: Character): InnateSpellProfile | null {
  const race = (character.race?.name || "").toLowerCase();
  const subrace = (character.race?.subraceName || "").toLowerCase();
  const lvl = totalLevel(character);
  const pb = proficiencyBonus(lvl);
  const { modifiers } = effectiveScores(character);

  const isElfHigh =
    race === "elf" &&
    (subrace === "high" ||
      subrace.includes("high") ||
      subrace.includes("sun") ||
      subrace.includes("moon"));

  const isHalfElfHigh =
    race.includes("half-elf") &&
    (subrace.includes("high") || subrace.includes("sun") || subrace.includes("moon")) &&
    Boolean(
      character.ruleChoices?.some(
        (r) => r.from?.includes("Cantrip") && r.picked?.includes("Cantrip")
      )
    );

  if (!isElfHigh && !isHalfElfHigh) return null;

  // The cantrip is the one picked on the ruleChoices, or the one stored under the legacy racial owner key.
  const highElfPick = character.ruleChoices?.find(
    (r) => r.id === "PHB__Elf__PHB__High Elf__Cantrip" || r.id.includes("High Elf")
  )?.picked?.[0];
  const cantripName = highElfPick || (character.knownSpells?.find(k => k.ownerKey === "racial__innate")?.name);
  if (!cantripName) return null;

  const ability: AbilityKey = "int";
  const abilityMod = modifiers[ability] ?? 0;
  return {
    title: isElfHigh ? "High Elf Cantrip" : "Half-Elf Cantrip",
    origin: "race",
    ability,
    spellSaveDc: 8 + pb + abilityMod,
    spellAttackBonus: pb + abilityMod,
    spells: [
      {
        name: cantripName,
        level: 0,
        minCharacterLevel: 1,
        castingTime: "1 action",
        source: "PHB",
        isCantrip: true,
      },
    ],
  };
}
