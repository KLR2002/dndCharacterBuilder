import { DEFAULT_ACTIVE_BOOK_CODES, type ActiveBooks } from "../constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";
import type { AbilityKey, AsiSelection, Character } from "../types/character.ts";
import type { FeatData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { hasFeat } from "./abilities.ts";
import { applyAsiWithHitPoints } from "./builderTransitions.ts";
import {
  applyOriginFeat,
  grantBackgroundFeat,
  validateFeatPrerequisites,
  type FeatPrerequisiteResult,
  type OriginFeatEntry,
} from "./feats.ts";
import { featGrantedRuleChoices, featSpellChoicesOf, pickRuleChoice } from "./ruleChoices.ts";
import type { AvailableRuleChoice } from "./choices/types.ts";

/**
 * The module every Feat Slot reads: the ASI slot a class level opens and the origin slot a race or background
 * opens (ADR 0023). It answers which feats are offered, what a pick's increase is, which Rule Choices and feat
 * spells the pick opens, whether the pick is complete, and applies it.
 */

/** Where a feat is taken: a class level's Ability Score Improvement, or an origin feat the race or background grants. */
export type FeatSlot =
  | { kind: "asi"; className: string; classLevel: number }
  | { kind: "origin"; grantedBy: "race" | "background" };

/** A feat pick not yet applied. `subChoicePicks` maps a Rule Choice id the feat opens to the options picked for it. */
export interface FeatSlotPick {
  slot: FeatSlot;
  featName: string | null;
  featSource?: string;
  featAbility?: AbilityKey;
  subChoicePicks?: Record<string, string[]>;
}

/** The ability increase a feat grants: the fixed +1 its record states, the Increase Choice it states, or none. */
export interface FeatAbilityBonusOptions {
  type: "fixed" | "choice" | "none";
  abilities: AbilityKey[];
  amount: number;
}

export interface FeatSlotOffer {
  feat: FeatData;
  prerequisite: FeatPrerequisiteResult;
  /** The character already holds this feat from another slot. */
  held: boolean;
}

export interface FeatSlotView {
  offered: FeatSlotOffer[];
  picked: FeatData | null;
  increase: FeatAbilityBonusOptions;
  /** The Rule Choices the picked feat opens, not those the character already holds. */
  subChoices: AvailableRuleChoice[];
  /** The feat spell picks the picked feat opens. They never make the pick incomplete. */
  spellChoices: AvailableRuleChoice[];
  complete: boolean;
}

export interface FeatSlotOptions {
  compendium?: Compendium;
  activeBooks?: ActiveBooks;
}

export interface FeatSlotApplyOptions extends FeatSlotOptions {
  fullHealOnLevelUp?: boolean;
  /** The origin feat entry an origin pick replaces. */
  replacing?: OriginFeatEntry;
}

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const NO_INCREASE: FeatAbilityBonusOptions = { type: "none", abilities: [], amount: 0 };

/**
 * The feat with this name, from the active books. A source narrows it to one record. Without a source it is found only when
 * exactly one active feat has the name. The Background marker names where a background granted the feat, not a book, so it
 * is found by name.
 */
export function findFeat(
  name: string,
  source: string | undefined,
  compendium: Compendium,
  activeBooks: ActiveBooks
): FeatData | null {
  const wanted = name.trim().toLowerCase();
  const bookSource = source === BACKGROUND_FEAT_SOURCE ? undefined : source;
  const matches = compendium
    .for(activeBooks)
    .feats()
    .filter((feat) => feat.name.trim().toLowerCase() === wanted && (!bookSource || feat.source === bookSource));
  if (bookSource) return matches[0] ?? null;
  return matches.length === 1 ? matches[0] : null;
}

/**
 * The increase a feat grants, read from the record alone. A record with an Increase Choice gives its choice; a record with one
 * fixed score gives that +1; a record with neither, or no record, gives none.
 */
export function featIncreaseOptions(feat: FeatData | null): FeatAbilityBonusOptions {
  if (!feat) return NO_INCREASE;
  const choice = feat.abilityScoreChoices?.[0];
  if (choice) return { type: "choice", abilities: [...choice.from], amount: choice.amount };
  const fixed = fixedAbilitiesOf(feat);
  if (fixed.length === 1) return { type: "fixed", abilities: fixed, amount: 1 };
  return NO_INCREASE;
}

function fixedAbilitiesOf(feat: FeatData): AbilityKey[] {
  const abilities: AbilityKey[] = [];
  for (const increase of feat.abilityScoreIncrease ?? []) {
    for (const key of Object.keys(increase)) {
      const ability = key.toLowerCase().slice(0, 3) as AbilityKey;
      if (ABILITY_KEYS.includes(ability) && !abilities.includes(ability)) abilities.push(ability);
    }
  }
  return abilities;
}

/** The ability a pick places: a fixed increase's score, else the score the pick chose (kept on a stale catalog). */
function abilityOf(pick: FeatSlotPick, increase: FeatAbilityBonusOptions): AbilityKey | undefined {
  if (increase.type === "fixed") return increase.abilities[0];
  return pick.featAbility;
}

/** The saved entry a pick becomes: an ASI selection for the ASI slot, an origin feat entry for an origin slot. */
function selectionOf(pick: FeatSlotPick, picked: FeatData | null, featAbility: AbilityKey | undefined): AsiSelection {
  const { slot } = pick;
  const featName = pick.featName ?? "";
  if (slot.kind === "asi") {
    return {
      level: slot.classLevel,
      className: slot.className,
      classLevel: slot.classLevel,
      type: "feat",
      featName,
      featSource: picked?.source ?? pick.featSource,
      featAbility,
    };
  }
  return {
    level: 1,
    type: "feat",
    featName,
    featSource: slot.grantedBy === "background" ? BACKGROUND_FEAT_SOURCE : picked?.source ?? pick.featSource,
    featAbility,
  };
}

/** The character with the pick's entry added, so the Rule Choices and feat spells it opens can be read. */
function withSelection(character: Character, slot: FeatSlot, selection: AsiSelection): Character {
  if (slot.kind === "asi") return { ...character, asiSelections: [...(character.asiSelections ?? []), selection] };
  return { ...character, originFeats: [...(character.originFeats ?? []), selection] };
}

/** The Rule Choices the picked feat opens: those the pick adds to the character, not those it already holds. */
function opened<T extends { id: string }>(choices: T[], held: T[]): T[] {
  const heldIds = new Set(held.map((choice) => choice.id));
  return choices.filter((choice) => !heldIds.has(choice.id));
}

/**
 * Everything a Feat Slot shows for a pending pick: the feats offered, the picked feat's increase, the Rule Choices and feat
 * spells it opens, and whether the pick is complete. A pick is complete when a feat is picked, its Increase Choice is placed
 * when it is a choice, and every Rule Choice it opens has its picks. Feat spell picks never block it.
 */
export function featSlotView(character: Character, pick: FeatSlotPick, opts: FeatSlotOptions = {}): FeatSlotView {
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const catalogs = { compendium, activeBooks };

  const offered = compendium
    .for(activeBooks)
    .feats()
    .map((feat) => ({
      feat,
      prerequisite: validateFeatPrerequisites(character, feat, { catalogs }),
      held: hasFeat(character, feat.name),
    }));

  const picked = pick.featName ? findFeat(pick.featName, pick.featSource, compendium, activeBooks) : null;
  const increase = featIncreaseOptions(picked);
  const featAbility = abilityOf(pick, increase);

  let subChoices: AvailableRuleChoice[] = [];
  let spellChoices: AvailableRuleChoice[] = [];
  if (picked) {
    const selection = selectionOf(pick, picked, featAbility);
    const planned = withSelection(character, pick.slot, selection);
    subChoices = opened(
      featGrantedRuleChoices(planned, activeBooks, compendium),
      featGrantedRuleChoices(character, activeBooks, compendium)
    );
    spellChoices = featSpellChoicesOf(planned, { name: picked.name, source: picked.source }, compendium, activeBooks);
  }

  const increaseChosen = increase.type !== "choice" || featAbility !== undefined;
  const subChoicesFilled = subChoices.every(
    (choice) => (pick.subChoicePicks?.[choice.id] ?? []).length >= choice.choose
  );

  return {
    offered,
    picked,
    increase,
    subChoices,
    spellChoices,
    complete: picked !== null && increaseChosen && subChoicesFilled,
  };
}

/**
 * Applies a pick to the character. An ASI pick goes through the level-up ASI transition, an origin pick through the origin
 * feat rules. The picked feat's sub-choice picks are recorded afterwards, through the Rule Choice of each id the feat opens.
 * A pick with no feat leaves the character unchanged.
 */
export function applyFeatSlotPick(character: Character, pick: FeatSlotPick, opts: FeatSlotApplyOptions = {}): Character {
  if (!pick.featName) return character;
  const compendium = opts.compendium ?? currentCompendium();
  const activeBooks = opts.activeBooks ?? DEFAULT_ACTIVE_BOOK_CODES;
  const picked = findFeat(pick.featName, pick.featSource, compendium, activeBooks);
  const featAbility = abilityOf(pick, featIncreaseOptions(picked));
  const selection = selectionOf(pick, picked, featAbility);

  let updated: Character;
  if (pick.slot.kind === "asi") {
    updated = applyAsiWithHitPoints(
      character,
      {
        ...selection,
        asi: featAbility ? { [featAbility]: 1 } : undefined,
      },
      opts.fullHealOnLevelUp ?? false,
      compendium,
      activeBooks
    );
  } else if (pick.slot.grantedBy === "background") {
    updated = grantBackgroundFeat(character, pick.featName, featAbility, compendium, activeBooks);
  } else {
    updated = applyOriginFeat(character, selection, opts.replacing, compendium, activeBooks);
  }

  for (const [choiceId, options] of Object.entries(pick.subChoicePicks ?? {})) {
    const choice = featGrantedRuleChoices(updated, activeBooks, compendium).find((c) => c.id === choiceId);
    if (!choice) continue;
    for (const option of options) {
      updated = pickRuleChoice(updated, choice, option, compendium, activeBooks);
    }
  }
  return updated;
}
