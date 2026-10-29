import { ORIGIN_CUSTOMIZATION_BOOK, type ActiveBooks } from "../constants/books.ts";
import { ABILITY_SCORE_CAP } from "../constants/rules.ts";
import type { CompendiumListings, Compendium } from "../services/compendium.ts";
import type { AbilityKey, Character } from "../types/character.ts";
import type { RaceData, SubraceData } from "../types/dnd5e.ts";
import { ABILITIES, ABILITY_NAMES, abilityKeyOf, baseAbilityScores } from "./abilities.ts";
import { allCatalogRaces, catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { withNotices } from "./needsReview.ts";
import { findHeldRace } from "./raceLookup.ts";

/**
 * One ability increase of the held race or subrace: one (entry, ability) pair of its `abilityScoreIncrease`. Its id is
 * built from the held race or subrace and the entry's position, so a swap saved for one race never reads as another's.
 */
export interface AbilitySlot {
  id: string;
  defaultAbility: AbilityKey;
  amount: number;
}

export interface OriginAbilitySlotView {
  id: string;
  defaultAbility: AbilityKey;
  amount: number;
  target: AbilityKey;
  /** Abilities this increase may not move to right now. */
  blocked: AbilityKey[];
}

/** What the Origin Customization card shows. Absent when the rule is not available. */
export interface OriginCustomizationView {
  /** Empty when the race's increases already cover all six abilities, so there is nothing to move. */
  abilitySlots: OriginAbilitySlotView[];
}

interface AbilityState {
  slots: AbilitySlot[];
  available: boolean;
}

const RELEASED_NOTICE = (ability: AbilityKey) => `Ability swap to ${ABILITY_NAMES[ability]} removed: ancestry no longer grants it`;
const COLLIDING_NOTICE = (ability: AbilityKey) => `Ability swap to ${ABILITY_NAMES[ability]} removed: another increase already uses it`;

/** TCE is active when the books are unscoped (every book counts) or TCE is one of them. */
function ruleBookActive(activeBooks: ActiveBooks): boolean {
  return activeBooks === undefined || activeBooks.includes(ORIGIN_CUSTOMIZATION_BOOK);
}

function incrementsOf(entries: Record<string, number>[] | undefined): { index: number; ability: AbilityKey; amount: number }[] {
  return (entries ?? []).flatMap((entry, index) =>
    Object.entries(entry).flatMap(([name, amount]) => {
      const ability = abilityKeyOf(name);
      return ability && Number.isFinite(amount) ? [{ index, ability, amount }] : [];
    }),
  );
}

function slotsFrom(prefix: string[], entries: Record<string, number>[] | undefined): AbilitySlot[] {
  return incrementsOf(entries).map(({ index, ability, amount }) => ({
    id: [...prefix, String(index), ability].join("|"),
    defaultAbility: ability,
    amount,
  }));
}

function slotsOf(held: NonNullable<Character["race"]>, race: RaceData, subrace: SubraceData | undefined): AbilitySlot[] {
  const raceSlots = slotsFrom(["race", held.name, held.source], race.abilityScoreIncrease);
  const subraceSlots = subrace
    ? slotsFrom(["subrace", held.name, held.source, held.subraceName ?? "", held.subraceSource ?? ""], subrace.abilityScoreIncrease)
    : [];
  return [...raceSlots, ...subraceSlots];
}

/**
 * The slots and availability of a character. The held race resolves against `races`, the unscoped records, so a book that is
 * turned off leaves it its increases; `listings` (scoped to the active books) decides only whether the rule is offered.
 * Undefined when the held race or subrace is not in the catalog, so its saved state is kept untouched.
 */
function stateIn(
  character: Character,
  races: readonly RaceData[],
  listings: CompendiumListings,
  activeBooks: ActiveBooks,
): AbilityState | undefined {
  const held = character.race;
  if (!held) return { slots: [], available: false };
  const found = findHeldRace(races, held, activeBooks);
  if (!found.race || (held.subraceName && !found.subrace)) return undefined;
  const slots = slotsOf(held, found.race, found.subrace);
  const available =
    ruleBookActive(activeBooks) && listings.originRules().length > 0 && slots.length > 0;
  return { slots, available };
}

/** The slots and availability of a character, resolved against the catalogs. Nothing held means no slots. */
export function originAbilityState(character: Character, catalogs?: CharacterCatalogs): AbilityState {
  return stateIn(character, allCatalogRaces(catalogs), catalogListings(catalogs), catalogs?.activeBooks) ?? { slots: [], available: false };
}

/** The ability an increase targets: its swap when one is saved, else the ability the race gives it. */
function targetOf(slot: AbilitySlot, swaps: Record<string, AbilityKey>): AbilityKey {
  return swaps[slot.id] ?? slot.defaultAbility;
}

/**
 * Whether an increase may move to `ability`: no other increase or chosen pick lands there, and the base score plus the
 * increase stays at or under the cap. An increase's own default is the race's own, so another increase that defaults there
 * does not block it (the race's increases may share a score), and the cap does not apply to it either. A chosen pick still does.
 */
export function abilityTargetBlocked(
  character: Character,
  slots: readonly AbilitySlot[],
  slot: AbilitySlot,
  ability: AbilityKey,
): boolean {
  const picks = (character.racialChoiceBonus ?? []).map((pick) => pick.key);
  if (ability === slot.defaultAbility) return picks.includes(ability);
  const swaps = character.originAbilitySwaps ?? {};
  const taken = [...slots.filter((other) => other.id !== slot.id).map((other) => targetOf(other, swaps)), ...picks];
  if (taken.includes(ability)) return true;
  return baseAbilityScores(character)[ability] + slot.amount > ABILITY_SCORE_CAP;
}

/**
 * The swapped increases whose target another increase already lands on, or a chosen pick holds. A slot at its default is never
 * listed. Repeats until none is left, since dropping one swap returns its increase to its default.
 */
function collidingSwapIds(
  slots: readonly AbilitySlot[],
  swaps: Record<string, AbilityKey>,
  picks: readonly { key: AbilityKey }[],
): string[] {
  const colliding = slots
    .filter((slot) => swaps[slot.id] !== undefined)
    .filter((slot) => {
      const target = swaps[slot.id];
      return picks.some((pick) => pick.key === target) || slots.some((other) => other.id !== slot.id && targetOf(other, swaps) === target);
    })
    .map((slot) => slot.id);
  return colliding.length === 0 ? colliding : [...colliding, ...collidingSwapIds(slots, withoutSwaps(swaps, colliding), picks)];
}

function withoutSwaps(swaps: Record<string, AbilityKey>, ids: readonly string[]): Record<string, AbilityKey> {
  return Object.fromEntries(Object.entries(swaps).filter(([id]) => !ids.includes(id)));
}

/** The racial ability bonuses a character's increases give: each slot at its target, plus the chosen picks. */
function racialBonusesOf(
  slots: readonly AbilitySlot[],
  swaps: Record<string, AbilityKey>,
  picks: readonly { key: AbilityKey; amount: number }[],
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const { ability, amount } of [
    ...slots.map((slot) => ({ ability: targetOf(slot, swaps), amount: slot.amount })),
    ...picks.map((pick) => ({ ability: pick.key, amount: pick.amount })),
  ]) {
    bonuses[ability] = (bonuses[ability] ?? 0) + amount;
  }
  return bonuses;
}

function sameBonuses(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
}

/**
 * The abilities the Origin Customization increases land on, each at its target, while the rule is available. A Choice ASI
 * pick may not take one of them, so that every increase lands on a different score. Empty when the rule is not available.
 */
export function originAbilityTargets(character: Character, catalogs?: CharacterCatalogs): AbilityKey[] {
  const { slots, available } = originAbilityState(character, catalogs);
  if (!available) return [];
  const swaps = character.originAbilitySwaps ?? {};
  return slots.map((slot) => targetOf(slot, swaps));
}

/** Whether the card is offered: TCE active, the Catalog holds the swap table, and the held race or subrace has an increase. */
export function originCustomizationAvailable(character: Character, catalogs?: CharacterCatalogs): boolean {
  return originAbilityState(character, catalogs).available;
}

/** The Origin Customization card's content, or undefined when the rule is not available. */
export function originCustomizationView(character: Character, catalogs?: CharacterCatalogs): OriginCustomizationView | undefined {
  const { slots, available } = originAbilityState(character, catalogs);
  if (!available) return undefined;
  if (new Set(slots.map((slot) => slot.defaultAbility)).size === ABILITIES.length) return { abilitySlots: [] };
  const swaps = character.originAbilitySwaps ?? {};
  return {
    abilitySlots: slots.map((slot) => ({
      id: slot.id,
      defaultAbility: slot.defaultAbility,
      amount: slot.amount,
      target: targetOf(slot, swaps),
      blocked: ABILITIES.filter((ability) => abilityTargetBlocked(character, slots, slot, ability)),
    })),
  };
}

/**
 * Releases the saved swaps whose increase the held race or subrace no longer has, with a notice each, and derives the
 * racial ability bonuses: each increase at its target while the rule is available (the default otherwise), plus the chosen
 * picks. A held race missing from the catalog is left as it is. Deterministic, so a second pass changes nothing.
 */
export function reconcileOriginAbilities(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const state = stateIn(character, compendium.for().races(), compendium.for(activeBooks), activeBooks);
  if (!state) return character;

  const ids = new Set(state.slots.map((slot) => slot.id));
  const kept: Record<string, AbilityKey> = {};
  const notices: string[] = [];
  for (const [id, ability] of Object.entries(character.originAbilitySwaps ?? {})) {
    if (ids.has(id)) kept[id] = ability;
    else notices.push(RELEASED_NOTICE(ability));
  }
  if (state.available) {
    const picks = character.racialChoiceBonus ?? [];
    for (const id of collidingSwapIds(state.slots, kept, picks)) {
      notices.push(COLLIDING_NOTICE(kept[id]));
      delete kept[id];
    }
  }

  const derived = character.race
    ? racialBonusesOf(state.slots, state.available ? kept : {}, character.racialChoiceBonus ?? [])
    : character.racialAbilityBonuses;
  const racialAbilityBonuses = sameBonuses(derived, character.racialAbilityBonuses)
    ? character.racialAbilityBonuses
    : derived;

  const next: Character = { ...character, racialAbilityBonuses };
  if (Object.keys(kept).length > 0) next.originAbilitySwaps = kept;
  else delete next.originAbilitySwaps;
  return withNotices(next, notices);
}
