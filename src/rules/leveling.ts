import type { Character, AsiSelection, AbilityKey } from "../types/character.ts";
import { asiLevels } from "./classData.ts";

export { asiLevels } from "./classData.ts";

export interface FeatAbilityBonusOptions {
  type: "fixed" | "choice" | "none";
  abilities: AbilityKey[];
  amount: number;
}

export const HALF_FEATS: Record<string, AbilityKey[]> = {
  "aberrant dragonmark": ["con"],
  "actor": ["cha"],
  "agent of order": ["str", "dex", "con", "int", "wis", "cha"],
  "athlete": ["str", "dex"],
  "baleful scion": ["str", "dex", "con", "int", "wis", "cha"],
  "chef": ["con", "wis"],
  "cohort of chaos": ["str", "dex", "con", "int", "wis", "cha"],
  "crusher": ["str", "con"],
  "dragon fear": ["str", "con", "cha"],
  "dragon hide": ["str", "con", "cha"],
  "durable": ["con"],
  "dwarven fortitude": ["con"],
  "elven accuracy": ["dex", "int", "wis", "cha"],
  "ember of the fire giant": ["str", "con", "wis"],
  "fade away": ["dex", "int"],
  "fey teleportation": ["int", "cha"],
  "fey touched": ["int", "wis", "cha"],
  "flames of phlegethos": ["int", "cha"],
  "fury of the frost giant": ["str", "con", "wis"],
  "gift of the gem dragon": ["int", "wis", "cha"],
  "guile of the cloud giant": ["str", "con", "cha"],
  "gunner": ["dex"],
  "heavily armored": ["str"],
  "heavy armor master": ["str"],
  "infernal constitution": ["con"],
  "keen mind": ["int"],
  "keenness of the stone giant": ["str", "con", "wis"],
  "knight of the crown": ["str", "dex", "con"],
  "knight of the rose": ["con", "wis", "cha"],
  "knight of the sword": ["int", "wis", "cha"],
  "lightly armored": ["str", "dex"],
  "linguist": ["int"],
  "moderately armored": ["str", "dex"],
  "observant": ["int", "wis"],
  "orcish fury": ["str", "con"],
  "outlands envoy": ["str", "dex", "con", "int", "wis", "cha"],
  "piercer": ["str", "dex"],
  "resilient": ["str", "dex", "con", "int", "wis", "cha"],
  "revenant blade": ["str", "dex"],
  "righteous heritor": ["str", "dex", "con", "int", "wis", "cha"],
  "second chance": ["dex", "con", "cha"],
  "shadow touched": ["int", "wis", "cha"],
  "skill expert": ["str", "dex", "con", "int", "wis", "cha"],
  "slasher": ["str", "dex"],
  "soul of the storm giant": ["str", "wis", "cha"],
  "squat nimbleness": ["str", "dex"],
  "tavern brawler": ["str", "con"],
  "telekinetic": ["int", "wis", "cha"],
  "telepathic": ["int", "wis", "cha"],
  "vigor of the hill giant": ["str", "con", "wis"],
  "weapon master": ["str", "dex"],
};

export function getFeatAbilityBonusOptions(
  featName: string,
  featData?: { abilityScoreIncrease?: Record<string, number>[] | null }
): FeatAbilityBonusOptions {
  const normalized = featName.trim().toLowerCase();
  if (featData?.abilityScoreIncrease && featData.abilityScoreIncrease.length > 0) {
    const abilities: AbilityKey[] = [];
    for (const inc of featData.abilityScoreIncrease) {
      for (const k of Object.keys(inc)) {
        const mapped = k.toLowerCase().slice(0, 3) as AbilityKey;
        if (["str", "dex", "con", "int", "wis", "cha"].includes(mapped) && !abilities.includes(mapped)) {
          abilities.push(mapped);
        }
      }
    }
    if (abilities.length === 1) {
      return { type: "fixed", abilities, amount: 1 };
    } else if (abilities.length > 1) {
      return { type: "choice", abilities, amount: 1 };
    }
  }
  const mapped = HALF_FEATS[normalized];
  if (mapped && mapped.length > 0) {
    return {
      type: mapped.length === 1 ? "fixed" : "choice",
      abilities: mapped,
      amount: 1,
    };
  }
  return { type: "none", abilities: [], amount: 0 };
}

/**
 * Returns the class level at which a subclass is selected (2014 rules).
 * - Cleric, Sorcerer, Warlock choose at 1st level.
 * - Druid, Wizard choose at 2nd level.
 * - All other classes choose at 3rd level.
 */
export function subclassLevel(className: string): number {
  const lower = className.toLowerCase();
  if (["cleric", "sorcerer", "warlock"].includes(lower)) {
    return 1;
  }
  if (["druid", "wizard"].includes(lower)) {
    return 2;
  }
  return 3;
}

export interface PendingLevelChoices {
  pendingAsi: { className: string; classLevel: number }[];
  pendingSubclasses: { className: string; classLevel: number }[];
}

/**
 * Identifies unassigned ASI slots and pending subclass choices for a character.
 */
export function getPendingLevelChoices(
  character: Character,
  classDataCatalog?: any[]
): PendingLevelChoices {
  const pendingAsi: { className: string; classLevel: number }[] = [];
  const pendingSubclasses: { className: string; classLevel: number }[] = [];

  const existingSelections = [...(character.asiSelections ?? [])];
  const usedIndices = new Set<number>();

  for (const c of character.classes ?? []) {
    // 1. Check pending ASI / Feat slots
    const thresholds = asiLevels(c.className);
    for (const lvl of thresholds) {
      if (c.level >= lvl) {
        const matchIndex = existingSelections.findIndex((s, idx) => {
          if (usedIndices.has(idx)) return false;
          const sLevel = s.classLevel ?? s.level;
          if (sLevel !== lvl) return false;
          if (s.className) {
            return s.className.toLowerCase() === c.className.toLowerCase();
          }
          if (character.classes.length === 1) {
            return true;
          }
          return c.className.toLowerCase() === character.classes[0].className.toLowerCase();
        });

        if (matchIndex !== -1) {
          usedIndices.add(matchIndex);
        } else {
          pendingAsi.push({ className: c.className, classLevel: lvl });
        }
      }
    }

    // 2. Check pending Subclass choice
    const req = subclassLevel(c.className);
    if (c.level >= req && !c.subclassName) {
      if (classDataCatalog) {
        const cd =
          classDataCatalog.find(
            (entry: any) =>
              entry.name?.toLowerCase() === c.className.toLowerCase() &&
              (!c.source || !entry.source || entry.source.toLowerCase() === c.source.toLowerCase())
          ) ??
          classDataCatalog.find(
            (entry: any) => entry.name?.toLowerCase() === c.className.toLowerCase()
          );

        if (cd && Array.isArray(cd.subclasses) && cd.subclasses.length === 0) {
          continue;
        }
      }

      pendingSubclasses.push({ className: c.className, classLevel: req });
    }
  }

  return {
    pendingAsi,
    pendingSubclasses,
  };
}

/**
 * Adds or replaces an AsiSelection for { className, classLevel } in character.asiSelections.
 * Pure transition: does not mutate the original character.
 */
export function applyAsiSelection(
  character: Character,
  selection: AsiSelection
): Character {
  const targetClass =
    selection.className ??
    (character.classes?.length === 1 ? character.classes[0].className : undefined);
  const targetLevel = selection.classLevel ?? selection.level;

  const normalizedSelection: AsiSelection = {
    ...selection,
    level: selection.level ?? targetLevel ?? 4,
    classLevel: selection.classLevel ?? targetLevel ?? 4,
    ...(targetClass ? { className: targetClass } : {}),
  };

  const selections = character.asiSelections ? [...character.asiSelections] : [];
  const existingIndex = selections.findIndex((s) => {
    const sClass =
      s.className ??
      (character.classes?.length === 1 ? character.classes[0].className : undefined);
    const sLevel = s.classLevel ?? s.level;
    if (!targetClass) {
      return sLevel === targetLevel;
    }
    return (
      sClass?.toLowerCase() === targetClass.toLowerCase() &&
      sLevel === targetLevel
    );
  });

  if (existingIndex >= 0) {
    selections[existingIndex] = normalizedSelection;
  } else {
    selections.push(normalizedSelection);
  }

  return {
    ...character,
    asiSelections: selections,
  };
}

/**
 * Removes the AsiSelection for the specified class and class level.
 * Pure transition: does not mutate the original character.
 */
export function removeAsiSelection(
  character: Character,
  className: string,
  classLevel: number
): Character {
  const selections = character.asiSelections ?? [];
  const filtered = selections.filter((s) => {
    const sClass =
      s.className ??
      (character.classes?.length === 1 ? character.classes[0].className : undefined);
    const sLevel = s.classLevel ?? s.level;
    const matchesClass = sClass
      ? sClass.toLowerCase() === className.toLowerCase()
      : true;
    const matchesLevel = sLevel === classLevel;
    return !(matchesClass && matchesLevel);
  });

  return {
    ...character,
    asiSelections: filtered,
  };
}
