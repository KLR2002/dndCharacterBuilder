import type { Character } from "../../types/character.ts";
import type { SpellData } from "../../types/dnd5e.ts";

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

/** The source a Rule Choice comes from. Persisted on each recorded entry. */
export type RuleChoiceOrigin = "race" | "class" | "subclass" | "feat";

/**
 * Who a class or subclass Rule Choice belongs to: its class, and the subclass when the choice is
 * subclass-granted. Absent subclass means the class owns it, whatever subclass it has. Feat-granted
 * choices have no class owner at all, so no owner is returned for them.
 */
export interface ChoiceOwner {
  className: string;
  subclass?: string;
}

/**
 * Sources whose picks have state of their own to record. Absent on a choice means the default
 * pick: record the option, then reconcile.
 */
export type SpecialisedPick = "fightingStyle" | "artificerInfusion" | "proficiency";

/** The Path of the Giant cantrip choice. Its id is frozen. The Reconciler reads it too. */
export const GIANT_POWER_CHOICE_ID = "BGG__Barbarian__Path of the Giant__Giant Power";

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
  /** The book the choice is printed in. Set by table rows, which gate on it; others gate on the id prefix. */
  source?: string;
  origin: RuleChoiceOrigin;
  pick?: SpecialisedPick;
  options: { name: string; description: string }[];
}

/**
 * Old saved option names, lower-case, mapped to the name the catalog prints now. Names only: a pick
 * stored under an old name is never rewritten, it is read through this table.
 */
export const OPTION_NAME_ALIASES: ReadonlyMap<string, string> = new Map([
  ["fist of unbroken air", "Unbroken Air"],
]);

function findNamed(name: string, optionNames: readonly string[]): string | undefined {
  const wanted = name.trim().toLowerCase();
  return optionNames.find((candidate) => candidate.trim().toLowerCase() === wanted);
}

/**
 * The name an offered option is saved under, for a pick saved as `saved`. Matching ignores case and
 * surrounding space: saved picks were written title-cased, while the catalog's text is not. A saved
 * name no offered name matches is retried through the alias table. Undefined when neither matches.
 * Every saved-pick match against an option name goes through this function.
 */
export function resolveOptionName(saved: string, optionNames: readonly string[]): string | undefined {
  const direct = findNamed(saved, optionNames);
  if (direct !== undefined) return direct;
  const aliased = OPTION_NAME_ALIASES.get(saved.trim().toLowerCase());
  return aliased === undefined ? undefined : findNamed(aliased, optionNames);
}

/**
 * The saved picks of a choice, each shown as the offered name it resolves to. A pick no offered name
 * matches is kept as saved. The stored picks themselves are not changed.
 */
export function pickedOptionNames(picked: readonly string[], optionNames: readonly string[]): string[] {
  return picked.map((saved) => resolveOptionName(saved, optionNames) ?? saved);
}

export function getSubclassName(c: { subclassName?: string; subclass?: string }): string {
  return (c.subclassName || c.subclass || "").trim().toLowerCase();
}

export function formatCantripOptions(cantrips: SpellData[]): { name: string; description: string }[] {
  const seen = new Set<string>();
  const options: { name: string; description: string }[] = [];
  for (const s of cantrips) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      const classList = s.classes && s.classes.length > 0 ? `(${s.classes.join(", ")}) ` : "";
      options.push({
        name: s.name,
        description: s.description ? `${classList}${s.description}` : `${classList}${s.school} cantrip`,
      });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Records a player's pick for a Rule Choice, or clears it when the option is
 * deselected. Choices are keyed by id, so switching ancestries cannot leave a
 * stale pick behind under an id the new ancestry never offered.
 *
 * This is the recording step only. It lives in this leaf module because the
 * specialised choice modules record their picks with it; callers reach it through
 * `pickRuleChoice` in the Rule Choice module, which then reconciles.
 */
export function setRuleChoicePick(
  character: Character,
  id: string,
  trait: string,
  option: string,
  from: string[],
  choose: number,
  origin: RuleChoiceOrigin = "race"
): Character {
  const current = character.ruleChoices ?? [];
  const entry = current.find((rc) => rc.id === id);
  // A saved pick and the option match when they resolve to the same offered name, so a pick saved
  // under an old name toggles off when its current name is chosen.
  const offeredName = (name: string) => resolveOptionName(name, from) ?? name;
  const isOption = (saved: string) => offeredName(saved) === offeredName(option);
  const picked = entry
    ? entry.picked.some(isOption)
      ? entry.picked.filter((p) => !isOption(p))
      : choose === 1
      ? [option]
      : entry.picked.length >= choose
      ? [...entry.picked.slice(1), option]
      : [...entry.picked, option]
    : [option];
  const originToUse = entry?.origin ?? origin;
  const next = { id, trait, origin: originToUse, choose, from, picked };
  const others = current.filter((rc) => rc.id !== id);
  return {
    ...character,
    ruleChoices: picked.length === 0 ? others : [...others, next],
  };
}
