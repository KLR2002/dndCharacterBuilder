import type { Character } from "../types/character.ts";
import type { SpellData } from "../types/dnd5e.ts";
import type { EvaluatedCharacter } from "./characterEvaluation.ts";
import { multiclassSlots as calculateMulticlassSpellSlots } from "./slots.ts";
import { calculateWarlockPactSlots } from "./spellcasting.ts";
import { getMysticArcanumTiers, type MysticArcanumTierInfo } from "./ruleChoices.ts";
import type { InnateSpellEntry } from "./innateMagic.ts";

export interface SpellSlotLedgerEntry {
  level: number;
  total: number;
  used: number;
  remaining: number;
}

export interface PactSlotLedger {
  level: number;
  total: number;
  used: number;
  remaining: number;
}

export interface SorceryPointsLedger {
  max: number;
  used: number;
  remaining: number;
}

export interface SpellbookLedger {
  standardSlots: SpellSlotLedgerEntry[];
  hasStandardSlots: boolean;
  pactSlots: PactSlotLedger | null;
  sorceryPoints: SorceryPointsLedger | null;
  mysticArcanum: MysticArcanumTierInfo[];
}

/**
 * Derives the active spellbook ledger containing standard slots, pact slots,
 * sorcery points, and mystic arcanum status for a character.
 */
export function getSpellSlotLedger(
  character: Character,
  evaluated?: EvaluatedCharacter | null
): SpellbookLedger {
  // 1. Standard multiclass spell slots
  const multiclassResult = calculateMulticlassSpellSlots(character);
  const usedMap = character.usedSpellSlots || {};
  const standardSlots: SpellSlotLedgerEntry[] = [];

  multiclassResult.slots.forEach((total, idx) => {
    const level = idx + 1;
    if (total > 0) {
      const used = Math.min(total, Math.max(0, usedMap[level] ?? 0));
      standardSlots.push({
        level,
        total,
        used,
        remaining: Math.max(0, total - used),
      });
    }
  });

  // 2. Warlock Pact Magic slots
  const pactMagic = evaluated?.pactMagic ?? calculateWarlockPactSlots(character);
  let pactSlots: PactSlotLedger | null = null;
  if (pactMagic && pactMagic.count > 0) {
    const used = character.pactSlotsUsed ?? character.usedPactSlots ?? 0;
    const clampedUsed = Math.min(pactMagic.count, Math.max(0, used));
    pactSlots = {
      level: pactMagic.level,
      total: pactMagic.count,
      used: clampedUsed,
      remaining: Math.max(0, pactMagic.count - clampedUsed),
    };
  }

  // 3. Sorcery points
  const sorcererClass = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "sorcerer"
  );
  let sorceryPoints: SorceryPointsLedger | null = null;
  if (sorcererClass && sorcererClass.level >= 2) {
    const max = sorcererClass.level;
    const used = Math.min(max, Math.max(0, character.sorceryPointsUsed ?? 0));
    sorceryPoints = {
      max,
      used,
      remaining: Math.max(0, max - used),
    };
  }

  // 4. Mystic Arcanum
  const mysticArcanum = getMysticArcanumTiers(character);

  return {
    standardSlots,
    hasStandardSlots: standardSlots.some((s) => s.total > 0),
    pactSlots,
    sorceryPoints,
    mysticArcanum,
  };
}

/**
 * Toggles a standard spell slot expenditure at the specified spell level and slot index.
 */
export function toggleSpellSlot(
  character: Character,
  level: number,
  slotIndex: number
): Character {
  const currentUsed = character.usedSpellSlots?.[level] ?? 0;
  const nextUsed = slotIndex < currentUsed ? slotIndex : slotIndex + 1;

  return {
    ...character,
    usedSpellSlots: {
      ...(character.usedSpellSlots || {}),
      [level]: nextUsed,
    },
  };
}

/**
 * Toggles a Warlock pact magic slot expenditure at the specified slot index.
 */
export function togglePactSlot(
  character: Character,
  slotIndex: number
): Character {
  const currentUsed = character.pactSlotsUsed ?? character.usedPactSlots ?? 0;
  const nextUsed = slotIndex < currentUsed ? slotIndex : slotIndex + 1;

  return {
    ...character,
    pactSlotsUsed: nextUsed,
    usedPactSlots: nextUsed,
  };
}

/**
 * Adjusts used sorcery points by a delta (positive spends, negative regains).
 */
export function spendSorceryPoints(
  character: Character,
  delta: number
): Character {
  const sorcererClass = (character.classes || []).find(
    (c) => c.className.toLowerCase() === "sorcerer"
  );
  const max = sorcererClass ? sorcererClass.level : 0;
  const currentUsed = character.sorceryPointsUsed ?? 0;
  const nextUsed = Math.min(max, Math.max(0, currentUsed + delta));

  return {
    ...character,
    sorceryPointsUsed: nextUsed,
  };
}

/**
 * Toggles the expenditure state of a Mystic Arcanum spell of a given spell level.
 */
export function toggleMysticArcanumCast(
  character: Character,
  spellLevel: number
): Character {
  const currentSpent = Boolean(character.mysticArcanumSpent?.[spellLevel]);
  return {
    ...character,
    mysticArcanumSpent: {
      ...(character.mysticArcanumSpent || {}),
      [spellLevel]: !currentSpent,
    },
  };
}

/**
 * Toggles the usage counter for an innate / racial spell.
 */
export function toggleInnateSpellUse(
  character: Character,
  spell: InnateSpellEntry
): Character {
  if (!spell.resourceCounterId) return character;
  const counterId = spell.resourceCounterId;
  const counter = character.resourceCounters?.[counterId];
  const currentlyRemaining = counter !== undefined ? counter.current : 1;
  const newRemaining = currentlyRemaining > 0 ? 0 : 1;

  return {
    ...character,
    resourceCounters: {
      ...(character.resourceCounters || {}),
      [counterId]: {
        id: counterId,
        name: `Innate: ${spell.name}`,
        current: newRemaining,
        max: 1,
        resetOn: "long",
      },
    },
  };
}

/**
 * Inscribes a new ritual spell into the character's Ritual Book.
 */
export function inscribeRitual(
  character: Character,
  spell: SpellData
): Character {
  const currentBook = character.ritualBook || [];
  if (currentBook.some((r) => r.name.toLowerCase() === spell.name.toLowerCase())) {
    return character;
  }

  const updatedBook = [
    ...currentBook,
    {
      name: spell.name,
      source: spell.source,
      level: spell.level,
      isStarting: false,
    },
  ];

  return {
    ...character,
    ritualBook: updatedBook,
  };
}

/**
 * Removes an inscribed (non-starting) ritual from the character's Ritual Book.
 */
export function removeInscribedRitual(
  character: Character,
  ritualName: string
): Character {
  const currentBook = character.ritualBook || [];
  const updatedBook = currentBook.filter(
    (r) => !(r.name.toLowerCase() === ritualName.toLowerCase() && !r.isStarting)
  );

  return {
    ...character,
    ritualBook: updatedBook.length > 0 ? updatedBook : undefined,
  };
}

/**
 * Sets a replacement spell swap for a subclass spell (e.g. Clockwork Soul, Aberrant Mind).
 */
export function swapSubclassSpell(
  character: Character,
  originalSpellName: string,
  replacementSpellName: string
): Character {
  return {
    ...character,
    subclassSpellSwaps: {
      ...(character.subclassSpellSwaps || {}),
      [originalSpellName]: replacementSpellName,
    },
  };
}

/**
 * Resets a subclass spell swap back to its default spell.
 */
export function resetSubclassSpellSwap(
  character: Character,
  originalSpellName: string
): Character {
  const nextSwaps = { ...(character.subclassSpellSwaps || {}) };
  const targetLower = originalSpellName.toLowerCase().trim();

  for (const k of Object.keys(nextSwaps)) {
    if (k.toLowerCase().trim() === targetLower) {
      delete nextSwaps[k];
    }
  }

  return {
    ...character,
    subclassSpellSwaps: Object.keys(nextSwaps).length > 0 ? nextSwaps : undefined,
  };
}

/**
 * Toggles a spell's preparation state in character.preparedSpells.
 */
export function togglePreparedSpell(
  character: Character,
  item: { name: string; source: string; ownerKey?: string }
): Character {
  const currentPrepared = character.preparedSpells || [];
  const ownerKey = item.ownerKey || "";
  const canonicalKey = ownerKey ? `${item.name}__${item.source}__${ownerKey}` : `${item.name}__${item.source}`;
  const legacyKey = `${item.name}__${item.source}`;

  const isPrepared = currentPrepared.some(
    (k) =>
      k === canonicalKey ||
      k === legacyKey ||
      (typeof k === "string" && k.toLowerCase().startsWith(`${item.name.toLowerCase()}__${item.source.toLowerCase()}`))
  );

  const updatedPrepared = isPrepared
    ? currentPrepared.filter(
        (k) =>
          k !== canonicalKey &&
          k !== legacyKey &&
          !k.toLowerCase().startsWith(`${item.name.toLowerCase()}__${item.source.toLowerCase()}`)
      )
    : [...currentPrepared, canonicalKey];

  return {
    ...character,
    preparedSpells: updatedPrepared,
  };
}
