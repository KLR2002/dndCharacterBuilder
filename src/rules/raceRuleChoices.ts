import type { ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { RaceData, TraitChoiceData, TraitData } from "../types/dnd5e.ts";
import { DND_SKILLS } from "../constants/rules.ts";
import { totalLevel } from "./proficiencies.ts";
import { grantGateOpen } from "./grantGate.ts";
import { type AvailableRuleChoice, ruleChoiceId } from "./choices/types.ts";
import { findHeldRace, heldSourceOf } from "./raceLookup.ts";

/**
 * Race Rule Choices: what an ancestry or lineage grants as choices, and how a granted race trait
 * resolves against the character's recorded pick. Kept apart from ruleChoices.ts so that the
 * Proficiency Sheet can resolve race traits (via grantedFeatures) without importing the Rule Choice
 * module, which imports the Character Reconciler.
 */
export const LINEAGE_NAMES = new Set(["Dhampir", "Hexblood", "Reborn"]);

export function lineageInheritsElements(
  character: Character,
  raceCatalog: RaceData[],
  activeBooks: ActiveBooks,
): boolean {
  if (!character.lineageReplacement || !character.race?.name) return false;
  if (LINEAGE_NAMES.has(character.race.name)) return false;

  const { race: priorRace, subrace: priorSubrace } = findHeldRace(raceCatalog, character.race, activeBooks);

  const hasSpecialSpeed = Boolean(
    ((priorRace?.speed?.swim ?? 0) > 0) ||
    ((priorRace?.speed?.climb ?? 0) > 0) ||
    ((priorRace?.speed?.fly ?? 0) > 0) ||
    ((priorSubrace?.speed?.swim ?? 0) > 0) ||
    ((priorSubrace?.speed?.climb ?? 0) > 0) ||
    ((priorSubrace?.speed?.fly ?? 0) > 0)
  );

  const grantsSkill = (record: { grants?: { category: string; gatedBy?: { choiceId: string; option: string } }[] } | undefined) =>
    (record?.grants ?? []).some((grant) => grant.category === "skills" && grantGateOpen(character, grant));
  let hasSkills = grantsSkill(priorRace) || grantsSkill(priorSubrace);

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
export function ancestryRuleChoices(
  character: Character,
  raceCatalog: RaceData[],
  activeBooks: ActiveBooks,
): AvailableRuleChoice[] {
  const choice = character.race;
  const lineageName = character.lineageReplacement || (choice && LINEAGE_NAMES.has(choice.name) ? choice.name : null);

  if (lineageName) {
    const inherits = lineageInheritsElements(character, raceCatalog, activeBooks);
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

  const { race, subrace } = findHeldRace(raceCatalog, choice, activeBooks);

  // The id carries the source the race was saved under; `source` is the book the record was found in, which gates the choice.
  const raceSource = race ? heldSourceOf(choice.source, race) : choice.source;
  const traitSource = subrace ? heldSourceOf(choice.subraceSource, subrace) : raceSource;
  const recordSource = subrace?.source ?? race?.source;

  const toChoice = (trait: TraitData, data: TraitChoiceData): AvailableRuleChoice => ({
    id: ruleChoiceId({ source: traitSource, race: choice.name, subrace: subrace ? { name: subrace.name } : null, trait: trait.name }),
    traitName: trait.name,
    origin: "race",
    choose: data.pick,
    level: data.level,
    effectLevel: data.effectLevel ?? data.level,
    ...(data.replaces ? { replaces: data.replaces } : {}),
    ...(recordSource ? { source: recordSource } : {}),
    options: data.options,
  });

  const out: AvailableRuleChoice[] = [];
  for (const trait of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    if (trait.choice) out.push(toChoice(trait, trait.choice));
  }
  return out;
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

/**
 * Names of traits a recorded choice has replaced, which must not appear on the
 * sheet at all. A replaced trait usually carries no choice of its own, so it
 * cannot discover its own replacement by looking inward.
 */
export function replacedTraitNames(
  character: Character,
  raceCatalog: RaceData[],
  activeBooks: ActiveBooks,
): Set<string> {
  const suppressed = new Set<string>();
  for (const choice of ancestryRuleChoices(character, raceCatalog, activeBooks)) {
    if (!choice.replaces) continue;
    const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choice.id);
    const picked = entry?.picked?.[0];
    // Skill Versatility survives only when it is what the player chose; picking
    // anything else means the variant replaced it.
    if (picked && picked !== choice.replaces) suppressed.add(choice.replaces);
  }
  return suppressed;
}
