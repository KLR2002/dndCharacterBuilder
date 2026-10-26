import type { Character, KnownSpell } from "../types/character.ts";
import type { SpellData } from "../types/dnd5e.ts";
import type { EvaluatedCharacter } from "./characterEvaluation.ts";
import { multiclassSlots as calculateMulticlassSpellSlots } from "./slots.ts";
import {
  calculateWarlockPactSlots,
  isSpellAvailableForClass,
  profileSpellContext,
  type ClassSpellProfile,
} from "./spellcasting.ts";
import { reconcile } from "./characterReconciler.ts";
import type { Compendium } from "../services/compendium.ts";
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
  const max = spell.maxUses ?? 1;
  const counter = character.resourceCounters?.[counterId];
  const currentlyRemaining = counter !== undefined ? counter.current : max;
  const newRemaining = currentlyRemaining > 0 ? 0 : max;

  return {
    ...character,
    resourceCounters: {
      ...(character.resourceCounters || {}),
      [counterId]: {
        id: counterId,
        name: `Innate: ${spell.name}`,
        current: newRemaining,
        max,
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

/** A spell as the spells tab identifies it: its name, source and, optionally, the Spell Owner it is listed under. */
export interface SpellIdentity {
  name: string;
  source: string;
  ownerKey?: string;
}

function ownerOf(spell: SpellIdentity, profile: ClassSpellProfile): string {
  return spell.ownerKey ?? profile.ownerKey;
}

/** The stored form of a prepared entry under an owner: `name__source__owner`. */
function canonicalPreparedKey(spell: SpellIdentity, profile: ClassSpellProfile): string {
  return `${spell.name}__${spell.source}__${ownerOf(spell, profile)}`;
}

/** The legacy, owner-less prepared entry: `name__source`. */
function legacyPreparedKey(spell: SpellIdentity): string {
  return `${spell.name}__${spell.source}`;
}

/**
 * Whether the spell is known by the profile's Spell Owner. A stored entry matches when its owner is
 * the profile's owner, or when it is a legacy entry with no owner and the same class.
 */
export function isKnown(character: Character, profile: ClassSpellProfile, spell: SpellIdentity): boolean {
  const owner = ownerOf(spell, profile);
  return (character.knownSpells || []).some(
    (k) =>
      k.name === spell.name &&
      k.source === spell.source &&
      (k.ownerKey === owner || (!k.ownerKey && k.className === profile.className))
  );
}

/** Whether the spell is prepared under the Spell Owner. Exact match on the canonical or legacy key. */
export function isPrepared(character: Character, profile: ClassSpellProfile, spell: SpellIdentity): boolean {
  const canonical = canonicalPreparedKey(spell, profile);
  const legacy = legacyPreparedKey(spell);
  return (character.preparedSpells || []).some((k) => k === canonical || k === legacy);
}

/**
 * Counts the prepared spells that count against the preparation limit: prepared, levelled, and not
 * always-prepared. Always-prepared spells are excluded.
 */
export function countPrepared(character: Character, profile: ClassSpellProfile, compendium: Compendium): number {
  return profile.knownSpells.filter((k) => {
    if (isAlwaysPrepared(profile, k.name)) return false;
    if ((compendium.findSpell(k.name, k.source)?.level ?? 0) === 0) return false;
    return isPrepared(character, profile, k);
  }).length;
}

function isAlwaysPrepared(profile: ClassSpellProfile, name: string): boolean {
  const lower = name.toLowerCase();
  return (profile.alwaysPreparedSpells || []).some((s) => s.name.toLowerCase() === lower);
}

/**
 * Whether the spell is on the owner's class list under the active books. Fighter and Rogue gate
 * against the Wizard list.
 */
function isOnOwnerList(profile: ClassSpellProfile, spell: SpellData, activeBooks?: string[]): boolean {
  const gatingClass =
    profile.className === "Fighter" || profile.className === "Rogue" ? "Wizard" : profile.className;
  return isSpellAvailableForClass(spell, gatingClass, activeBooks, profileSpellContext(profile));
}

/**
 * Whether the owner may learn or prepare the spell: on its class list under the active books, and
 * within the owner's maximum spell level.
 */
function withinOwnerGate(profile: ClassSpellProfile, spell: SpellData, activeBooks?: string[]): boolean {
  return spell.level <= profile.maxSpellLevel && isOnOwnerList(profile, spell, activeBooks);
}

/**
 * Toggles a spell's preparation under its Spell Owner. Unpreparing removes only that owner's entry
 * (and a matching legacy entry). Preparing is rejected, returning the character unchanged, when the
 * spell is always prepared or fails the class-list, active-book or level gate. The prepared limit is
 * not enforced: going over it is a warning shown by the spells tab.
 */
export function togglePrepared(
  character: Character,
  profile: ClassSpellProfile,
  spell: SpellIdentity,
  compendium: Compendium,
  activeBooks?: string[]
): Character {
  if (isAlwaysPrepared(profile, spell.name)) return character;

  const current = character.preparedSpells || [];
  const canonical = canonicalPreparedKey(spell, profile);
  const legacy = legacyPreparedKey(spell);

  if (isPrepared(character, profile, spell)) {
    return reconcile(
      { ...character, preparedSpells: current.filter((k) => k !== canonical && k !== legacy) },
      compendium
    );
  }

  const data = compendium.findSpell(spell.name, spell.source);
  if (data && !withinOwnerGate(profile, data, activeBooks)) return character;

  return reconcile({ ...character, preparedSpells: [...current, canonical] }, compendium);
}

/**
 * Learns a spell under the profile's Spell Owner. Rejected, returning the character unchanged, when
 * the spell fails the owner's class-list, active-book or maximum-spell-level gate, or when the owner
 * already knows it. A spell the Compendium does not know is not gated, matching the existing
 * synthetic-spell behaviour.
 */
export function learnSpell(
  character: Character,
  profile: ClassSpellProfile,
  spell: { name: string; source: string },
  compendium: Compendium,
  activeBooks?: string[]
): Character {
  const data = compendium.findSpell(spell.name, spell.source);
  if (data && !withinOwnerGate(profile, data, activeBooks)) return character;
  if (isKnown(character, profile, spell)) return character;

  const learned: KnownSpell = {
    name: spell.name,
    source: spell.source,
    ownerKey: profile.ownerKey,
    className: profile.className,
  };
  return reconcile({ ...character, knownSpells: [...(character.knownSpells || []), learned] }, compendium);
}

/**
 * Forgets a spell under its Spell Owner. Removes that owner's known entry and that owner's prepared
 * entry; other owners' copies are untouched. The legacy prepared key names no owner, so it is dropped
 * only once no owner still knows the spell.
 */
export function forgetSpell(
  character: Character,
  profile: ClassSpellProfile,
  spell: SpellIdentity,
  compendium: Compendium
): Character {
  const owner = ownerOf(spell, profile);
  const knownSpells = (character.knownSpells || []).filter(
    (k) =>
      !(
        k.name === spell.name &&
        k.source === spell.source &&
        (k.ownerKey === owner || (!k.ownerKey && (!k.className || k.className === profile.className)))
      )
  );
  const stillKnown = knownSpells.some((k) => k.name === spell.name && k.source === spell.source);
  const canonical = canonicalPreparedKey(spell, profile);
  const legacy = legacyPreparedKey(spell);
  const preparedSpells = (character.preparedSpells || []).filter(
    (k) => k !== canonical && !(k === legacy && !stillKnown)
  );

  return reconcile({ ...character, knownSpells, preparedSpells }, compendium);
}
