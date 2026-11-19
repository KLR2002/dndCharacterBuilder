import type { Character, RitualBookEntry } from "../types/character.ts";
import type { SpellData } from "../types/dnd5e.ts";
import type { ClassSpellProfile, LockedPreparedCard } from "./spellcasting.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import type { ActiveBooks } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { effectiveScores } from "./abilities.ts";
import { evaluateCharacter, type EvaluatedCharacter } from "./characterEvaluation.ts";
import {
  countPrepared,
  getSpellSlotLedger,
  isPrepared,
  type PactSlotLedger,
  type SorceryPointsLedger,
  type SpellSlotLedgerEntry,
} from "./characterSpells.ts";
import { learnableSpells } from "./learnableSpells.ts";
import {
  getAtWillInvocationSpells,
  getMaxRitualBookLevel,
  hasInvocation,
  isSpellEligibleForRitualBook,
  type MysticArcanumTierInfo,
} from "./ruleChoices.ts";
import type { InnateSpellProfile } from "./innateMagic.ts";
import {
  getEligibleSubclassSpellSwaps,
  getSubclassAllowedSwapSchools,
  isSubclassSpellReplaceable,
} from "./subclassSpells.ts";

export const SPELL_LEVEL_NAMES = [
  "Cantrips",
  "1st Level",
  "2nd Level",
  "3rd Level",
  "4th Level",
  "5th Level",
  "6th Level",
  "7th Level",
  "8th Level",
  "9th Level",
];

const PACT_OF_THE_TOME_OWNER = "Warlock__Tome";

export interface SpellPageOwner {
  ownerKey: string;
  label: string;
  selected: boolean;
}

export interface SpellPageBadge {
  label: string;
  tone: "accent" | "secondary" | "surface";
}

export interface SpellPageRow {
  name: string;
  source: string;
  ownerKey: string;
  level: number;
  details?: SpellData;
  subtitle: string;
  badges: SpellPageBadge[];
  prepare: "toggle" | "locked" | "none";
  prepared: boolean;
  canForget: boolean;
  swap: { canSwap: boolean; canReset: boolean; originalName: string } | null;
}

export interface SpellPageLevel {
  level: number;
  title: string;
  rows: SpellPageRow[];
}

export interface SpellPage {
  owners: SpellPageOwner[];
  /** The open Spell Owner's key, or null when the character has no class spell profile. */
  owner: string | null;
  header: { ability: string; className: string; spellSaveDc: number; spellAttackBonus: number } | null;
  prepared: {
    count: number;
    limit: number;
    alwaysPrepared: number;
    overLimit: boolean;
    text: string;
  } | null;
  listTitle: string;
  listSubtitle: string;
  canAddSpells: boolean;
  levels: SpellPageLevel[];
  /** The open Spell Owner's class profile, for the write calls. Null when the character has none. */
  profile: ClassSpellProfile | null;
  /** The standard slot levels the character has, clamped. Null when there are none. */
  slots: SpellSlotLedgerEntry[] | null;
  pactSlots: PactSlotLedger | null;
  sorceryPoints: SorceryPointsLedger | null;
  /** From Sorcerer 3. */
  metamagic: { allowance: number; chosen: string[] } | null;
  mysticArcanum: SpellPageArcanumTier[];
  ritualBook: SpellPageRitualBook | null;
  grantedCards: InnateSpellProfile[];
  lockedCards: LockedPreparedCard[];
  atWillCards: SpellPageAtWillCard[];
}

/** A Mystic Arcanum tier with the Warlock owner's spell save DC and attack bonus. */
export interface SpellPageArcanumTier extends MysticArcanumTierInfo {
  /** Null when the character has no Warlock profile. */
  dc: number | null;
  attackBonus: number | null;
}

export interface SpellPageRitualBook {
  maxLevel: number;
  entries: RitualBookEntry[];
  /** The rituals the book can still take: eligible, not inscribed, sorted by level then name. */
  inscribeOffer: SpellData[];
}

export interface SpellPageAtWillCard {
  invocationName: string;
  spellName: string;
  details?: SpellData;
}

/** A spell entry while the rows are merged, before its badges and controls are decided. */
interface SpellEntry {
  name: string;
  source: string;
  ownerKey: string;
  details?: SpellData;
  isAlwaysPrepared?: boolean;
  grantedSource?: string;
  isSubclassGrant?: boolean;
  isReplaced?: boolean;
  originalName?: string;
  isAtWillInvocation?: boolean;
}

/**
 * The Spell Page for one Spell Owner: the class pills, the open owner's header and prepared counter,
 * and its spells grouped by level with their badges and controls. The key picks the open owner; an
 * unknown or missing key opens the first owner.
 */
export function spellPage(character: Character, catalogs: CharacterCatalogs, ownerKey?: string): SpellPage {
  const compendium = catalogs.compendium ?? currentCompendium();
  const evaluated = evaluateCharacter(character, catalogs);
  const profiles = evaluated.spellProfiles;
  const open = profiles.find((p) => p.ownerKey === ownerKey) ?? profiles[0] ?? null;
  const resources = spellPageResources(character, evaluated, catalogs, compendium);

  if (!open) {
    return {
      owners: [],
      owner: null,
      profile: null,
      header: null,
      prepared: null,
      listTitle: "",
      listSubtitle: "",
      canAddSpells: false,
      levels: [],
      ...resources,
    };
  }

  const owners = profiles.map((p) => ({ ownerKey: p.ownerKey, label: ownerLabel(p), selected: p === open }));
  const knownCount = open.knownSpells.length;
  const subclassKnownCount = open.subclassKnownSpells?.length ?? 0;
  const alwaysPrepared = alwaysPreparedCount(open);
  const isMonk = open.className === "Monk";

  return {
    owners,
    owner: open.ownerKey,
    header: {
      ability: open.ability.toUpperCase(),
      className: open.className,
      spellSaveDc: open.spellSaveDc,
      spellAttackBonus: open.spellAttackBonus,
    },
    prepared: preparedCounter(character, open, compendium, alwaysPrepared),
    listTitle: isMonk ? "MONK KI SPELLS" : `${open.className.toUpperCase()} SPELLBOOK & CANTRIPS`,
    listSubtitle: listSubtitle(character, open, compendium, alwaysPrepared, knownCount, subclassKnownCount),
    canAddSpells: !isMonk,
    levels: buildLevels(character, open, profiles, catalogs, compendium),
    profile: open,
    ...resources,
  };
}

/**
 * The resource cards and the granted, locked and at-will cards. They do not depend on the open owner,
 * and a character without a class spell profile still reads them.
 */
function spellPageResources(
  character: Character,
  evaluated: EvaluatedCharacter,
  catalogs: CharacterCatalogs,
  compendium: Compendium,
): SpellPageResources {
  const ledger = getSpellSlotLedger(character, evaluated);
  const warlock = evaluated.spellProfiles.find((p) => p.className === "Warlock");
  const warlockLevel = classLevel(character, "warlock");
  const sorcererLevel = classLevel(character, "sorcerer");

  return {
    slots: ledger.hasStandardSlots ? ledger.standardSlots : null,
    pactSlots: ledger.pactSlots,
    sorceryPoints: ledger.sorceryPoints,
    metamagic:
      sorcererLevel >= 3
        ? { allowance: metamagicAllowance(sorcererLevel), chosen: chosenMetamagic(character) }
        : null,
    mysticArcanum: ledger.mysticArcanum.map((tier) => ({
      ...tier,
      dc: warlock?.spellSaveDc ?? null,
      attackBonus: warlock?.spellAttackBonus ?? null,
    })),
    ritualBook: hasInvocation(character, "Book of Ancient Secrets")
      ? {
          maxLevel: getMaxRitualBookLevel(warlockLevel),
          entries: character.ritualBook ?? [],
          inscribeOffer: inscribeOffer(character, warlockLevel, catalogs.activeBooks, compendium),
        }
      : null,
    grantedCards: evaluated.grantedSpellSources ?? [],
    lockedCards: evaluated.lockedPreparedCards ?? [],
    atWillCards: getAtWillInvocationSpells(character).map(({ invocationName, spellName }) => ({
      invocationName,
      spellName,
      details: compendium.findSpell(spellName),
    })),
  };
}

type SpellPageResources = Pick<
  SpellPage,
  | "slots"
  | "pactSlots"
  | "sorceryPoints"
  | "metamagic"
  | "mysticArcanum"
  | "ritualBook"
  | "grantedCards"
  | "lockedCards"
  | "atWillCards"
>;

function classLevel(character: Character, className: string): number {
  return (character.classes || []).find((c) => c.className.toLowerCase() === className)?.level ?? 0;
}

/** Sorcerer 3 allows 2 Metamagic options, 10 allows 3 and 17 allows 4. */
function metamagicAllowance(sorcererLevel: number): number {
  return sorcererLevel >= 17 ? 4 : sorcererLevel >= 10 ? 3 : 2;
}

function chosenMetamagic(character: Character): string[] {
  return character.chosenMetamagic?.length ? character.chosenMetamagic : (character.metamagicOptions ?? []);
}

/** The rituals a Book of Ancient Secrets can still take, from Warlock 2. */
function inscribeOffer(
  character: Character,
  warlockLevel: number,
  activeBooks: ActiveBooks,
  compendium: Compendium,
): SpellData[] {
  if (warlockLevel < 2) return [];
  const inscribed = new Set((character.ritualBook ?? []).map((r) => r.name.toLowerCase().trim()));
  const upperBooks = activeBooks?.map((b) => b.toUpperCase());
  return compendium
    .for(upperBooks)
    .spells()
    .filter((s) => isSpellEligibleForRitualBook(s, warlockLevel, activeBooks))
    .filter((s) => !inscribed.has(s.name.toLowerCase().trim()))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

/** The subclass spell replacements the open owner's subclass allows for one granted spell, and the schools it may take. */
export function subclassSwapOffer(
  character: Character,
  ownerKey: string,
  originalSpellName: string,
  catalogs: CharacterCatalogs,
): { allowedSchools: string[]; eligible: SpellData[] } {
  const compendium = catalogs.compendium ?? currentCompendium();
  const subclass = evaluateCharacter(character, catalogs).spellProfiles.find((p) => p.ownerKey === ownerKey)?.subclass;
  const original = compendium.findSpell(originalSpellName);
  if (!subclass || !original) return { allowedSchools: [], eligible: [] };
  return {
    allowedSchools: getSubclassAllowedSwapSchools(subclass),
    eligible: getEligibleSubclassSpellSwaps(subclass, original, catalogs.activeBooks, compendium),
  };
}

function ownerLabel(profile: ClassSpellProfile): string {
  const sign = profile.spellAttackBonus >= 0 ? "+" : "";
  return `${profile.className} (${profile.ability.toUpperCase()} DC ${profile.spellSaveDc} / ${sign}${profile.spellAttackBonus})`;
}

/** The always-prepared levelled spells the subclass gives. Feat and race grants are not counted. */
function alwaysPreparedCount(profile: ClassSpellProfile): number {
  if (!profile.alwaysPreparedSpells) return 0;
  const granted = profile.grantedPreparedSources ?? {};
  return profile.alwaysPreparedSpells.filter((s) => s.level > 0 && granted[s.name.toLowerCase()] === undefined).length;
}

function preparedCounter(
  character: Character,
  profile: ClassSpellProfile,
  compendium: Compendium,
  alwaysPrepared: number,
): SpellPage["prepared"] {
  if (profile.preparedLimit === undefined) return null;
  const count = countPrepared(character, profile, compendium);
  const limit = profile.preparedLimit;
  const text =
    alwaysPrepared > 0
      ? `${count} / ${limit} prepared (+ ${alwaysPrepared} always prepared)`
      : `${count} / ${limit} Prepared`;
  return { count, limit, alwaysPrepared, overLimit: count > limit, text };
}

function listSubtitle(
  character: Character,
  profile: ClassSpellProfile,
  compendium: Compendium,
  alwaysPrepared: number,
  knownCount: number,
  subclassKnownCount: number,
): string {
  if (profile.preparedLimit !== undefined) {
    const count = countPrepared(character, profile, compendium);
    const always = alwaysPrepared > 0 ? ` (+ ${alwaysPrepared} always prepared)` : "";
    const spellbook = profile.className.toLowerCase() === "wizard" ? ` • ${knownCount} in spellbook` : "";
    return `${count} / ${profile.preparedLimit} prepared${always}${spellbook}`;
  }
  if (profile.className === "Monk") return `${knownCount + subclassKnownCount} Ki spells available`;
  return `${knownCount + subclassKnownCount} spells known`;
}

/** The spells the open owner lists: known, always prepared, subclass-granted and, for Warlocks, at-will. */
function mergeEntries(
  character: Character,
  profile: ClassSpellProfile,
  profiles: ClassSpellProfile[],
  compendium: Compendium,
): Map<number, SpellEntry[]> {
  const map = new Map<number, SpellEntry[]>();
  for (let i = 0; i <= 9; i++) map.set(i, []);
  const push = (level: number, entry: SpellEntry) => map.get(level)?.push(entry);

  const alwaysPrepMap = new Map<string, SpellData>();
  for (const s of profile.alwaysPreparedSpells || []) alwaysPrepMap.set(s.name.toLowerCase(), s);

  const seen = new Set<string>();
  const ownerKey = profile.ownerKey;

  for (const item of profile.knownSpells) {
    const details = compendium.findSpell(item.name, item.source);
    const norm = item.name.toLowerCase();
    seen.add(norm);
    const isAlwaysPrepared = alwaysPrepMap.has(norm);
    push(details?.level ?? 0, {
      name: item.name,
      source: item.source,
      ownerKey: item.ownerKey ?? ownerKey,
      details,
      isAlwaysPrepared,
      grantedSource: isAlwaysPrepared ? profile.grantedPreparedSources?.[norm] : undefined,
    });
  }

  for (const spell of profile.alwaysPreparedSpells || []) {
    const norm = spell.name.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    push(spell.level ?? 0, {
      name: spell.name,
      source: spell.source,
      ownerKey,
      details: spell,
      isAlwaysPrepared: true,
      grantedSource: profile.grantedPreparedSources?.[norm],
    });
  }

  for (const spell of profile.subclassKnownSpells || []) {
    const norm = spell.name.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    push(spell.level ?? 0, {
      name: spell.name,
      source: spell.source,
      ownerKey,
      details: spell,
      isSubclassGrant: true,
      isReplaced: spell.isReplaced,
      originalName: spell.originalName,
    });
  }

  const isWarlockOrPrimary =
    profile.className === "Warlock" ||
    (!profiles.some((p) => p.className === "Warlock") && profiles[0] === profile);
  if (isWarlockOrPrimary) {
    for (const { spellName } of getAtWillInvocationSpells(character)) {
      const norm = spellName.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      const details = compendium.findSpell(spellName);
      push(0, {
        name: spellName,
        source: details?.source || "PHB",
        ownerKey: `${profile.className}__Invocation`,
        details,
        isAtWillInvocation: true,
      });
    }
  }

  for (const entries of map.values()) entries.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

function buildLevels(
  character: Character,
  profile: ClassSpellProfile,
  profiles: ClassSpellProfile[],
  catalogs: CharacterCatalogs,
  compendium: Compendium,
): SpellPageLevel[] {
  const entriesByLevel = mergeEntries(character, profile, profiles, compendium);
  const restrictedSchools = learnableSpells(character, profile, {
    compendium,
    activeBooks: catalogs.activeBooks,
  }).restrictedSchools;
  const hasAgonizingBlast = hasInvocation(character, "Agonizing Blast");
  const chaModifier = effectiveScores(character).modifiers.cha;

  const levels: SpellPageLevel[] = [];
  for (let level = 0; level <= 9; level++) {
    const entries = entriesByLevel.get(level) ?? [];
    if (entries.length === 0) continue;
    const hasAtWill = entries.some((e) => e.isAtWillInvocation);
    const title = level === 0 && hasAtWill ? "CANTRIPS & AT-WILL" : SPELL_LEVEL_NAMES[level].toUpperCase();
    const rows = entries.map((entry) =>
      buildRow(character, profile, level, entry, restrictedSchools, hasAgonizingBlast, chaModifier),
    );
    levels.push({ level, title, rows });
  }
  return levels;
}

function buildRow(
  character: Character,
  profile: ClassSpellProfile,
  level: number,
  entry: SpellEntry,
  restrictedSchools: string[],
  hasAgonizingBlast: boolean,
  chaModifier: number,
): SpellPageRow {
  const school = entry.details?.school;
  const isEldritchBlast = entry.name.toLowerCase() === "eldritch blast";
  const showAgonizingBlast = isEldritchBlast && hasAgonizingBlast;

  const badges: SpellPageBadge[] = [];
  if (entry.isAlwaysPrepared) {
    badges.push({
      label: entry.grantedSource ?? profile.subclass ?? profile.className,
      tone: "secondary",
    });
  }
  if (entry.isSubclassGrant && !entry.isAlwaysPrepared) {
    badges.push({
      label: level === 0 ? "Subclass Cantrip" : profile.className === "Monk" ? "Ki Spell" : "Subclass Grant",
      tone: "secondary",
    });
  }
  if (entry.ownerKey === PACT_OF_THE_TOME_OWNER) {
    badges.push({ label: "[Pact of the Tome]", tone: "accent" });
  }
  const kiCost = entry.details?.kiCost;
  if (kiCost !== undefined && kiCost > 0) {
    badges.push({ label: `${kiCost} Ki`, tone: "accent" });
  }
  if (entry.isReplaced && entry.originalName) {
    badges.push({ label: `Replaced: ${entry.originalName}`, tone: "accent" });
  }
  if (level > 0 && school !== undefined && restrictedSchools.length > 0 && !restrictedSchools.includes(school)) {
    badges.push({ label: "Any school", tone: "secondary" });
  }
  if (entry.isAtWillInvocation) {
    badges.push({ label: "At Will - Invocation", tone: "accent" });
  }
  if (showAgonizingBlast) {
    badges.push({ label: `[Agonizing Blast: +${chaModifier} dmg]`, tone: "accent" });
  }

  const subtitle =
    `${entry.details?.school || ""} • ${entry.details?.castingTime || "1 action"} • ${entry.source}` +
    (showAgonizingBlast ? ` • 1d10 + ${chaModifier} force` : "");

  const levelled = level > 0 && profile.className !== "Monk";
  const prepare = !levelled ? "none" : entry.isAlwaysPrepared ? "locked" : "toggle";

  const canForget =
    !entry.isAlwaysPrepared &&
    !entry.isSubclassGrant &&
    !entry.isAtWillInvocation &&
    entry.ownerKey !== PACT_OF_THE_TOME_OWNER;

  const swappable =
    entry.isSubclassGrant &&
    !entry.isAlwaysPrepared &&
    level > 0 &&
    isSubclassSpellReplaceable(profile.className, profile.subclass, level);

  return {
    name: entry.name,
    source: entry.source,
    ownerKey: entry.ownerKey,
    level,
    details: entry.details,
    subtitle,
    badges,
    prepare,
    prepared: isPrepared(character, profile, { name: entry.name, source: entry.source, ownerKey: entry.ownerKey }),
    canForget,
    swap: swappable
      ? {
          canSwap: true,
          canReset: entry.isReplaced === true,
          originalName: entry.originalName || entry.name,
        }
      : null,
  };
}
