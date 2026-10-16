import type { Character, RuleChoiceEntry } from "../types/character.ts";
import type { RaceData, TraitChoiceData, TraitData } from "../types/dnd5e.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { reconcile } from "./characterReconciler.ts";
import { totalLevel } from "./proficiencies.ts";
import { DND_SKILLS } from "../constants/rules.ts";
import { RACE_SKILL_PROFICIENCIES } from "./skills.ts";

import {
  type AvailableRuleChoice,
  type RuleChoiceOrigin,
  getSubclassName,
  ruleChoiceId,
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
  isPointerRow,
  readPointerRow,
  resolveRowOptions,
  rowOwnedBy,
} from "./subclassChoiceTable.ts";

export * from "./choices/types.ts";
export * from "./choices/fightingStyles.ts";
export * from "./choices/maneuvers.ts";
export * from "./choices/warlockChoices.ts";
export * from "./choices/artificerInfusions.ts";

export { BARBARIAN_CLASS_SKILLS, getUnchosenBarbarianSkills } from "./subclassChoiceTable.ts";

/**
 * A Rule Choice is a selection from a fixed set of options granted by a single
 * trait, of which exactly one takes effect. The catalog declares them
 * declaratively; this module resolves them for a character.
 *
 * Choice identity leads with source because two ancestries share a subrace
 * name - DMG and MToF both ship an Eladrin, with different Fey Step text.
 */

export const LINEAGE_NAMES = new Set(["Dhampir", "Hexblood", "Reborn"]);

export function lineageInheritsElements(character: Character, raceCatalog: RaceData[]): boolean {
  if (!character.lineageReplacement || !character.race?.name) return false;
  if (LINEAGE_NAMES.has(character.race.name)) return false;

  const priorRace = raceCatalog.find(
    (r) => r.name === character.race?.name && (!character.race?.source || r.source === character.race.source)
  );
  const priorSubrace = character.race?.subraceName
    ? priorRace?.subraces?.find(
        (s) =>
          s.name === character.race?.subraceName &&
          (!character.race?.subraceSource || s.source === character.race.subraceSource)
      )
    : undefined;

  const hasSpecialSpeed = Boolean(
    ((priorRace?.speed?.swim ?? 0) > 0) ||
    ((priorRace?.speed?.climb ?? 0) > 0) ||
    ((priorRace?.speed?.fly ?? 0) > 0) ||
    ((priorSubrace?.speed?.swim ?? 0) > 0) ||
    ((priorSubrace?.speed?.climb ?? 0) > 0) ||
    ((priorSubrace?.speed?.fly ?? 0) > 0)
  );

  let hasSkills = Boolean(
    (priorRace?.name && (RACE_SKILL_PROFICIENCIES[priorRace.name]?.length ?? 0) > 0) ||
    (priorSubrace?.name && (RACE_SKILL_PROFICIENCIES[priorSubrace.name]?.length ?? 0) > 0)
  );

  if (!hasSkills) {
    const priorTraits = [...(priorRace?.traits || []), ...(priorSubrace?.traits || [])];
    for (const t of priorTraits) {
      const desc = t.description || "";
      for (const skill of DND_SKILLS) {
        const reg = new RegExp(
          `(?:proficient in|proficiency in)(?: the)?\\s+${skill.name}\\s+skill|\\{@skill\\s+${skill.name}\\}`,
          "i"
        );
        if (reg.test(desc)) {
          hasSkills = true;
          break;
        }
      }
      if (hasSkills) break;
    }
  }

  return hasSpecialSpeed || hasSkills;
}

/**
 * Every Rule Choice the character's ancestry grants, ignoring level gating.
 * Level gating is applied by `availableRuleChoices`, which needs the level.
 */
export function ancestryRuleChoices(character: Character, raceCatalog: RaceData[]): AvailableRuleChoice[] {
  const choice = character.race;
  const lineageName = character.lineageReplacement || (choice && LINEAGE_NAMES.has(choice.name) ? choice.name : null);

  if (lineageName) {
    const inherits = lineageInheritsElements(character, raceCatalog);
    if (!inherits) {
      return [
        {
          id: ruleChoiceId({ source: "VRGR", race: lineageName, trait: "Ancestral Legacy" }),
          traitName: "Ancestral Legacy: Skill Proficiencies",
          origin: "race",
          choose: 2,
          level: 1,
          effectLevel: 1,
          options: DND_SKILLS.map((s) => ({
            name: s.name,
            description: `Gain proficiency in ${s.name} (${s.ability.toUpperCase()})`,
          })),
        },
      ];
    }
    return [];
  }

  if (!choice) return [];

  const race = raceCatalog.find(
    (r) => r.name === choice.name && (!choice.source || r.source === choice.source)
  );
  const subrace = choice.subraceName
    ? race?.subraces?.find(
        (s) =>
          s.name === choice.subraceName &&
          (!choice.subraceSource || s.source === choice.subraceSource)
      )
    : undefined;

  const source = subrace?.source ?? choice.source;
  const traitSource = subrace ? source : race?.source ?? choice.source;

  const toChoice = (trait: TraitData, data: TraitChoiceData): AvailableRuleChoice => ({
    id: ruleChoiceId({ source: traitSource, race: choice.name, subrace: subrace ? { name: subrace.name } : null, trait: trait.name }),
    traitName: trait.name,
    origin: "race",
    choose: data.pick,
    level: data.level,
    effectLevel: data.effectLevel ?? data.level,
    ...(data.replaces ? { replaces: data.replaces } : {}),
    options: data.options,
  });

  const out: AvailableRuleChoice[] = [];
  for (const trait of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    if (trait.choice) out.push(toChoice(trait, trait.choice));
  }
  return out;
}

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

/**
 * Resolves a granted feature against the character's recorded choice.
 *
 * A trait that grants a Rule Choice keeps its own prose and gains the chosen
 * option's text beneath it, but only once the character's level reaches the
 * choice's effect level. The trait is suppressed entirely when the catalog marks
 * the choice as replacing it.
 */
export function applyRuleChoice<T extends { name: string; description: string }>(
  character: Character,
  feature: T,
  data: TraitChoiceData | undefined,
  choiceId: string
): T & { chosenOption?: string; suppressed?: boolean } {
  if (!data) return feature;

  const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choiceId);
  const picked = entry?.picked?.[0];

  const option = picked && data.options.find((o) => o.name === picked);
  const inEffect = option != null && totalLevel(character) >= (data.effectLevel ?? data.level);

  // A trait that grants a choice has the options rendered into its description
  // upstream, so the sheet would list every option regardless of the pick. Show
  // the trait's own prose plus only the chosen option's effect.
  const base = withoutOptionList(feature.description, data);
  if (!inEffect || !option) return { ...feature, description: base, chosenOption: undefined };

  return {
    ...feature,
    chosenOption: option.name,
    description: base
      ? `${base}\n\n**${option.name}** ${option.description}`
      : `**${option.name}** ${option.description}`,
  };
}

/**
 * Drops the trailing bullet list of options a choice-granting trait carries, so
 * the sheet shows the chosen option rather than every option. Falls back to the
 * original text when no such list is found.
 */
function withoutOptionList(description: string, data: TraitChoiceData): string {
  const first = data.options[0]?.name;
  if (!description || !first) return description;
  // The option list renders as a heading ("### Name"), a bullet ("- **Name**") or
  // a bare bold run ("**Name**"), depending on the source entry's shape.
  const markers = [`### ${first}`, `- **${first}**`, `**${first}**`];
  const marker = markers
    .map((candidate) => description.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (marker === undefined) return description;
  return description.slice(0, marker).trim();
}

/** The chosen option for a given choice id, if the character has made it. */
export function selectedRuleChoice(
  character: Character,
  id: string
): RuleChoiceEntry | undefined {
  return (character.ruleChoices ?? []).find((entry) => entry.id === id);
}

/**
 * Names of traits a recorded choice has replaced, which must not appear on the
 * sheet at all. A replaced trait usually carries no choice of its own, so it
 * cannot discover its own replacement by looking inward.
 */
export function replacedTraitNames(character: Character, raceCatalog: RaceData[]): Set<string> {
  const suppressed = new Set<string>();
  for (const choice of ancestryRuleChoices(character, raceCatalog)) {
    if (!choice.replaces) continue;
    const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choice.id);
    const picked = entry?.picked?.[0];
    // Skill Versatility survives only when it is what the player chose; picking
    // anything else means the variant replaced it.
    if (picked && picked !== choice.replaces) suppressed.add(choice.replaces);
  }
  return suppressed;
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
      // Written as a negated comparison so a missing level offers nothing, as the hand-written chain did.
      if (!(c.level >= row.level)) continue;
      if (!rowOwnedBy(row, c.className, subName)) continue;
      if (row.requiresOptionalFeature && !hasOptionalFeature(character, row.requiresOptionalFeature)) continue;
      const offer = isPointerRow(row)
        ? readPointerRow(row, compendium, activeBooks)
        : {
            choose: row.choose,
            options: resolveRowOptions(row, { character, choiceId: row.id, activeBooks, compendium }),
          };
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
  out.push(...artificerInfusionChoices(character, activeBooks));

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
  compendium: Compendium = currentCompendium()
): Character {
  const recorded =
    choice.pick === "fightingStyle"
      ? pickFightingStyleChoice(character, choice, option, compendium)
      : choice.pick === "artificerInfusion"
      ? pickInfusionChoice(character, choice, option)
      : setRuleChoicePick(
          character,
          choice.id,
          choice.traitName,
          option,
          choice.options.map((o) => o.name),
          choice.choose,
          choice.origin
        );
  return reconcile(recorded, compendium);
}
