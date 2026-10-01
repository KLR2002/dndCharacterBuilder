import type { Character, AsiSelection } from "../types/character.ts";
import { asiLevels } from "./classData.ts";

export { asiLevels } from "./classData.ts";

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
