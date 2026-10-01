import type { Character, RuleChoiceEntry } from "../types/character.ts";
import type { RaceData, TraitChoiceData, TraitData } from "../types/dnd5e.ts";
import { totalLevel } from "./proficiencies.ts";

/**
 * A Rule Choice is a selection from a fixed set of options granted by a single
 * trait, of which exactly one takes effect. The catalog declares them
 * declaratively; this module resolves them for a character.
 *
 * Choice identity leads with source because two ancestries share a subrace
 * name - DMG and MToF both ship an Eladrin, with different Fey Step text.
 */
export interface RuleChoiceIdParts {
  source: string;
  race: string;
  subrace?: { name?: string; source?: string } | null;
  trait: string;
  index?: number;
}

export function ruleChoiceId({ source, race, subrace, trait, index }: RuleChoiceIdParts): string {
  const base = [source, race, subrace?.name ?? "", trait].join("__");
  return index ? `${base}#${index}` : base;
}

/** A Rule Choice the character is currently offered. */
export interface AvailableRuleChoice {
  id: string;
  traitName: string;
  choose: number;
  /** Level at which the choice becomes offerable. */
  level: number;
  /** Level from which the chosen option's effect applies; defaults to `level`. */
  effectLevel: number;
  /** The feature this choice replaces, when the catalog marks one. */
  replaces?: string;
  options: Array<{ name: string; description: string }>;
}

function findTrait(traits: TraitData[] | undefined, name: string): TraitData | undefined {
  return (traits ?? []).find((trait) => trait.name === name);
}

/**
 * Every Rule Choice the character's ancestry grants, ignoring level gating.
 * Level gating is applied by `availableRuleChoices`, which needs the level.
 */
export function ancestryRuleChoices(character: Character, raceCatalog: RaceData[]): AvailableRuleChoice[] {
  const choice = character.race;
  if (!choice) return [];

  const race = raceCatalog.find(
    (r) => r.name === choice.name && (!choice.source || r.source === choice.source)
  );
  const subrace = race?.subraces?.find(
    (s) =>
      (!choice.subraceName || s.name === choice.subraceName) &&
      (!choice.subraceSource || s.source === choice.subraceSource)
  );

  const source = subrace?.source ?? choice.source;
  const traitSource = subrace ? source : race?.source ?? choice.source;

  const toChoice = (trait: TraitData, data: TraitChoiceData): AvailableRuleChoice => ({
    id: ruleChoiceId({ source: traitSource, race: choice.name, subrace: subrace ? { name: subrace.name } : null, trait: trait.name }),
    traitName: trait.name,
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
