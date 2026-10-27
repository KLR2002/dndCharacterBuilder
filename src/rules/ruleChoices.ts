import type { Character, RuleChoiceEntry } from "../types/character.ts";
import type { RaceData } from "../types/dnd5e.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { reconcile } from "./characterReconciler.ts";
import { totalLevel } from "./proficiencies.ts";

import {
  type AvailableRuleChoice,
  type RuleChoiceOrigin,
  getSubclassName,
  setRuleChoicePick,
} from "./choices/types.ts";
import {
  FIGHTING_INITIATE_CHOICE_ID,
  fightingStyleRuleChoices,
  pickFightingStyleChoice,
} from "./choices/fightingStyles.ts";
import { MARTIAL_ADEPT_CHOICE_ID, battleMasterManeuverChoices } from "./choices/maneuvers.ts";
import {
  ELDRITCH_ADEPT_CHOICE_ID,
  warlockPactBoonChoices,
  warlockTomeCantripChoices,
  warlockAncientSecretsStartingRituals,
  warlockMysticArcanumChoices,
  warlockInvocationChoices,
} from "./choices/warlockChoices.ts";
import {
  artificerInfusionChoices,
  pickInfusionChoice,
} from "./choices/artificerInfusions.ts";
import {
  SUBCLASS_CHOICE_ROWS,
  hasOptionalFeature,
  readPointerRow,
  rowOwnedBy,
} from "./subclassChoiceTable.ts";
import { recordProficiencyPick } from "./proficiencyPools.ts";
import { ancestryRuleChoices } from "./raceRuleChoices.ts";

export * from "./choices/types.ts";
export * from "./choices/fightingStyles.ts";
export * from "./choices/maneuvers.ts";
export * from "./choices/warlockChoices.ts";
export * from "./choices/artificerInfusions.ts";
export { LINEAGE_NAMES, ancestryRuleChoices, applyRuleChoice, lineageInheritsElements, replacedTraitNames } from "./raceRuleChoices.ts";
export { featSpellChoicesOf, featSpellRuleChoices, raceSpellRuleChoices } from "./choices/featSpells.ts";

/**
 * A Rule Choice is a selection from a fixed set of options granted by a single
 * trait, of which exactly one takes effect. The catalog declares them
 * declaratively; this module resolves them for a character.
 *
 * Choice identity leads with source because two ancestries share a subrace
 * name - DMG and MToF both ship an Eladrin, with different Fey Step text.
 */

/**
 * The Rule Choices a character may make right now: gated by level, and by the
 * active resource books. Below its level a choice is absent rather than locked.
 */
export function availableRuleChoices(
  character: Character,
  raceCatalog: RaceData[],
  level?: number,
  activeBooks?: string[]
): AvailableRuleChoice[] {
  const currentLevel = level ?? totalLevel(character);
  const books = activeBooks ? new Set(activeBooks.map((b) => b.toUpperCase())) : null;

  return ancestryRuleChoices(character, raceCatalog).filter((choice) => {
    if (choice.level > currentLevel) return false;
    if (books) {
      const source = choice.id.split("__")[0]?.toUpperCase();
      if (source && !books.has(source)) return false;
    }
    return true;
  });
}

/** The chosen option for a given choice id, if the character has made it. */
export function selectedRuleChoice(
  character: Character,
  id: string
): RuleChoiceEntry | undefined {
  return (character.ruleChoices ?? []).find((entry) => entry.id === id);
}

/**
 * Rule Choices a long rest lets the player change: the eladrin's Season is the
 * only one, per MToF ("when finishing a long rest, you can change your season").
 * Modelled as a curated trait name rather than inferred from prose.
 */
export const CHANGEABLE_AT_LONG_REST = new Set(["Fey Step"]);

/**
 * Clears the picks of choices that a long rest lets the player change, so they
 * are offered again. Other choices are untouched.
 */
export function clearChangeableChoices(character: Character): Character {
  const entries = character.ruleChoices;
  if (!entries?.length) return character;
  const kept = entries.filter((entry) => !CHANGEABLE_AT_LONG_REST.has(entry.trait));
  if (kept.length === entries.length) return character;
  return { ...character, ruleChoices: kept };
}

/** The feat-granted choices. They are offered through the feat path, not the class and subclass list. */
const FEAT_GRANTED_CHOICE_IDS = new Set<string>([
  FIGHTING_INITIATE_CHOICE_ID,
  MARTIAL_ADEPT_CHOICE_ID,
  ELDRITCH_ADEPT_CHOICE_ID,
]);

/**
 * Returns all subclass rule choices defined by the character's active classes and subclasses.
 * Class and subclass choices come from the table in `subclassChoiceTable.ts`, in table order
 * within each class. Pointer rows read their options from the Compendium and are not offered
 * when it has none. The specialised choice modules follow as dynamic sources.
 */
export function subclassRuleChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];

  for (const c of character.classes ?? []) {
    const subName = getSubclassName(c);
    for (const row of SUBCLASS_CHOICE_ROWS) {
      // Written as a negated comparison so a missing level offers nothing.
      if (!(c.level >= row.level)) continue;
      if (!rowOwnedBy(row, c.className, subName)) continue;
      if (row.requiresOptionalFeature && !hasOptionalFeature(character, row.requiresOptionalFeature)) continue;
      const offer = readPointerRow(row, compendium, activeBooks, { character, choiceId: row.id });
      if (!offer) continue;
      out.push({
        id: row.id,
        traitName: row.traitName,
        origin: "subclass",
        source: row.source,
        choose: offer.choose,
        level: row.level,
        effectLevel: row.effectLevel,
        options: offer.options,
      });
    }
  }

  out.push(...fightingStyleRuleChoices(character, activeBooks, compendium).filter((c) => !FEAT_GRANTED_CHOICE_IDS.has(c.id)));
  out.push(...battleMasterManeuverChoices(character, activeBooks, compendium).filter((c) => !FEAT_GRANTED_CHOICE_IDS.has(c.id)));
  out.push(...warlockPactBoonChoices(character, activeBooks, compendium));
  out.push(...warlockTomeCantripChoices(character, activeBooks, compendium));
  out.push(...warlockAncientSecretsStartingRituals(character, activeBooks, compendium));
  out.push(...warlockMysticArcanumChoices(character, activeBooks, compendium));
  out.push(...warlockInvocationChoices(character, activeBooks, compendium).filter((c) => !FEAT_GRANTED_CHOICE_IDS.has(c.id)));
  out.push(...artificerInfusionChoices(character, activeBooks, compendium));

  return out;
}



/**
 * Returns subclass rule choices filtered by active books.
 */
export function availableSubclassRuleChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const choices = subclassRuleChoices(character, activeBooks, compendium);
  if (!activeBooks || activeBooks.length === 0) return choices;

  const books = new Set(activeBooks.map((b) => b.toUpperCase()));
  const allKnownBooks = new Set(ALL_RESOURCE_BOOKS.map((b) => b.code.toUpperCase()));

  return choices.filter((choice) => {
    const source = (choice.source ?? choice.id.split("__")[0])?.toUpperCase();
    if (!source || !allKnownBooks.has(source)) return true;
    return books.has(source);
  });
}

/**
 * Every Rule Choice the character is offered, across ancestry, class and subclass.
 * Ancestry choices come from the catalog and are level-gated; class and subclass
 * choices are gated by their own class levels. Each choice carries its `origin`.
 */
export interface RuleChoiceQuery {
  /** The ancestry catalog. Without it, no ancestry choices are offered. */
  raceCatalog?: RaceData[];
  /** Level for ancestry gating. Defaults to total level. */
  level?: number;
  activeBooks?: string[];
  compendium?: Compendium;
  /** Keep only choices from these sources. Every source when omitted. */
  origins?: RuleChoiceOrigin[];
}

export function offeredRuleChoices(
  character: Character,
  query: RuleChoiceQuery = {}
): AvailableRuleChoice[] {
  const race = query.raceCatalog
    ? availableRuleChoices(character, query.raceCatalog, query.level, query.activeBooks)
    : [];
  const classAndSubclass = availableSubclassRuleChoices(character, query.activeBooks, query.compendium);
  return [...race, ...classAndSubclass].filter(
    (choice) => !query.origins || query.origins.includes(choice.origin)
  );
}

/**
 * Records a player's pick for an offered Rule Choice, then reconciles the character.
 * Fighting style and Artificer infusion picks record through their own modules; every
 * other choice records under its origin. Derived state (invocations, Tome cantrips,
 * Mystic Arcanum, the Giant Power cantrip and the rest) is brought up to date by the
 * Reconciler, not by the pick.
 */
export function pickRuleChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string,
  compendium: Compendium = currentCompendium(),
  activeBooks?: string[]
): Character {
  const recorded =
    choice.pick === "fightingStyle"
      ? pickFightingStyleChoice(character, choice, option, compendium)
      : choice.pick === "artificerInfusion"
      ? pickInfusionChoice(character, choice, option)
      : choice.pick === "proficiency"
      ? recordProficiencyPick(character, choice, option)
      : setRuleChoicePick(
          character,
          choice.id,
          choice.traitName,
          option,
          choice.options.map((o) => o.name),
          choice.choose,
          choice.origin
        );
  return reconcile(recorded, compendium, { activeBooks });
}
