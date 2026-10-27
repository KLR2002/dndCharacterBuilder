import type { AbilityKey, AsiSelection, Character } from "../types/character.ts";
import type { RaceData, SubraceData } from "../types/dnd5e.ts";
import {
  offeredRuleChoices,
  pickRuleChoice,
  type AvailableRuleChoice,
} from "./ruleChoices.ts";
import { catalogListings, type CharacterCatalogs } from "./characterEvaluation.ts";
import { setChoiceRacialBonus } from "./builderTransitions.ts";
import { reconcile } from "./characterReconciler.ts";
import { currentCompendium } from "../services/compendium.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";
import { normalizeSkillName } from "./skills.ts";
import { isGrantSpellChoiceId, releaseSupersededRacePicks } from "./choices/featSpells.ts";
import { moveLegacySkillPicks } from "./proficiencyPicks.ts";
import { releaseExpandedOnlySpells } from "./backgroundSpells.ts";
import { findHeldRace } from "./raceLookup.ts";

export interface AncestryTraitView {
  name: string;
  description: string;
  source?: string;
}

export interface AncestryState {
  selectedRace?: RaceData;
  selectedSubrace?: SubraceData;
  speed: number;
  size: string;
  darkvision: number;
  traits: AncestryTraitView[];
  fixedBonuses: Record<string, number>;
  hasFixedASI: boolean;
  isChoiceASIRace: boolean;
  isFlexibleMPMM: boolean;
  choiceASIConfig: { count: number; amount: number };
  availableRuleChoices: AvailableRuleChoice[];
  ruleChoicesWithPicks: { choice: AvailableRuleChoice; picked: string[] }[];
  hasOriginFeat: boolean;
  originFeatTitle?: string;
  currentOriginFeat?: AsiSelection;
}

const CHOICE_ASI_RACES = new Set(["Half-Elf", "Custom Lineage"]);

export function collectFixedBonuses(
  raceASI?: Record<string, number>[],
  subraceASI?: Record<string, number>[]
): Record<string, number> {
  const bonuses: Record<string, number> = {};
  for (const item of [...(raceASI || []), ...(subraceASI || [])]) {
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === "number") {
        bonuses[k.toLowerCase()] = (bonuses[k.toLowerCase()] || 0) + v;
      }
    }
  }
  return bonuses;
}

/**
 * Whether a race's card in the race picker offers a plain form: the race with no subrace. Only a race the
 * integrated catalog splits into several named subraces qualifies, when the SRD Baseline holds a race of
 * the same name with no subraces (or only unnamed ones). Races the SRD holds only with a named subrace
 * already select through that subrace, so they get no plain form.
 */
export function offersPlainRaceForm(race: RaceData, srdRaces: readonly RaceData[]): boolean {
  const subraces = race.subraces ?? [];
  if (subraces.length < 2 || subraces.some((sr) => !sr.name?.trim())) return false;
  return srdRaces.some(
    (srd) =>
      srd.name === race.name && (srd.subraces ?? []).every((sr) => !sr.name?.trim())
  );
}

export function resolveAncestryState(
  character: Character,
  catalogs?: CharacterCatalogs
): AncestryState {
  const allRaces = catalogListings(catalogs).races();
  const { race: selectedRace, subrace: selectedSubrace } = findHeldRace(allRaces, character.race, catalogs?.activeBooks);

  const fixedBonuses = character.race
    ? collectFixedBonuses(selectedRace?.abilityScoreIncrease, selectedSubrace?.abilityScoreIncrease)
    : {};
  const hasFixedASI = Object.keys(fixedBonuses).length > 0;

  const isChoiceASIRace =
    character.race != null &&
    (!hasFixedASI ||
      CHOICE_ASI_RACES.has(character.race.name) ||
      character.race.subraceName === "Variant" ||
      character.race.subraceName === "Custom Lineage");

  const isFlexibleMPMM =
    character.race != null &&
    !hasFixedASI &&
    character.race.name !== "Custom Lineage" &&
    character.race.subraceName !== "Variant";

  const choiceASIConfig = (() => {
    if (!character.race) return { count: 2, amount: 1 };
    const name = character.race.subraceName || character.race.name;
    if (name === "Custom Lineage") return { count: 1, amount: 2 };
    return { count: 2, amount: 1 };
  })();

  const availChoices = (character.race || character.lineageReplacement)
    ? offeredRuleChoices(character, { raceCatalog: allRaces, activeBooks: catalogs?.activeBooks, origins: ["race"] })
    : [];

  const ruleChoicesWithPicks = availChoices.map((choice) => {
    const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choice.id);
    return {
      choice,
      picked: entry?.picked ?? [],
    };
  });

  // Origin Feat resolution (Variant Human, Custom Lineage)
  let hasOriginFeat = false;
  let originFeatTitle: string | undefined;
  let currentOriginFeat: AsiSelection | undefined;

  const lineageRace = character.lineageReplacement
    ? findHeldRace(allRaces, { name: character.lineageReplacement }, catalogs?.activeBooks).race
    : undefined;

  const speed =
    lineageRace?.speed?.walk ??
    (selectedSubrace as any)?.speed?.walk ??
    selectedRace?.speed?.walk ??
    30;

  const size =
    lineageRace?.size?.[0] ??
    selectedRace?.size?.[0] ??
    "Medium";

  const darkvision =
    lineageRace?.darkvision ??
    selectedSubrace?.darkvision ??
    selectedRace?.darkvision ??
    0;

  const traits: AncestryTraitView[] = lineageRace
    ? (lineageRace.traits ?? []).map((t) => ({ name: t.name, description: t.description, source: lineageRace.source }))
    : [
        ...(selectedRace?.traits ?? []).map((t) => ({ name: t.name, description: t.description, source: selectedRace?.source })),
        ...(selectedSubrace?.traits ?? []).map((t) => ({ name: t.name, description: t.description, source: selectedSubrace?.source })),
      ];

  if (character.race) {
    if (character.race.name === "Custom Lineage") {
      hasOriginFeat = true;
      originFeatTitle = "Custom Lineage Feat";
    } else if (character.race.subraceName === "Variant" || character.race.name === "Variant Human") {
      hasOriginFeat = true;
      originFeatTitle = "Variant Human Origin Feat";
    }

    if (hasOriginFeat) {
      // The feat a background grants carries the Background source, so the origin feat is the one the player chose.
      currentOriginFeat = (character.originFeats || []).find((f) => f.featSource !== BACKGROUND_FEAT_SOURCE);
    }
  }

  return {
    selectedRace,
    selectedSubrace,
    speed,
    size,
    darkvision,
    traits,
    fixedBonuses,
    hasFixedASI,
    isChoiceASIRace,
    isFlexibleMPMM,
    choiceASIConfig,
    availableRuleChoices: availChoices,
    ruleChoicesWithPicks,
    hasOriginFeat,
    originFeatTitle,
    currentOriginFeat,
  };
}

export function applyAncestrySelection(
  character: Character,
  race: RaceData,
  subrace?: SubraceData,
  catalogs?: CharacterCatalogs
): Character {
  const fixed = collectFixedBonuses(race.abilityScoreIncrease, subrace?.abilityScoreIncrease);
  const hasFixed = Object.keys(fixed).length > 0;
  const isChoice = !hasFixed || CHOICE_ASI_RACES.has(race.name) || subrace?.name === "Variant" || subrace?.name === "Custom Lineage";
  const bonuses = isChoice ? {} : fixed;

  const updatedRace = {
    name: race.name,
    source: race.source,
    subraceName: subrace?.name,
    subraceSource: subrace?.source,
  };

  const nextChosenLanguages = { ...character.chosenLanguages, race: [] };
  const nextChosenTools = { ...character.chosenTools, race: [] };

  const compendium = catalogs?.compendium ?? currentCompendium();
  // A skill pick saved in the old bucket moves into its choice while the old race is still held; a pick no choice
  // takes is the old race's legacy entry, and it goes with the race.
  const migrated = moveLegacySkillPicks(character, compendium, catalogs?.activeBooks);
  const oldRaceChoices = (migrated.skillChoices || []).filter((sc) => sc.origin === "race");
  const oldRacePicks = new Set(oldRaceChoices.flatMap((sc) => sc.picked.map(normalizeSkillName)));
  const nextSkillChoices = (migrated.skillChoices || []).filter((sc) => sc.origin !== "race");
  const nextChosenSkills = (migrated.chosenSkills || []).filter((s) => !oldRacePicks.has(normalizeSkillName(s)));

  // A race's pick of spells is kept here: the reconciler releases it, with a notice, once the race no longer grants it.
  const cleaned: Character = {
    ...migrated,
    race: updatedRace,
    racialAbilityBonuses: bonuses,
    racialChoiceBonus: [],
    chosenLanguages: nextChosenLanguages,
    chosenTools: nextChosenTools,
    ruleChoices: (character.ruleChoices || []).filter((rc) => rc.origin !== "race" || isGrantSpellChoiceId(rc.id)),
    skillChoices: nextSkillChoices,
    chosenSkills: nextChosenSkills,
  };

  // The spells only the old race's or subrace's expanded lists gave are released, with a notice (ADR 0017).
  const activeBooks = catalogs?.activeBooks;
  return releaseExpandedOnlySpells(
    character,
    reconcile(releaseSupersededRacePicks(character, cleaned), compendium, { activeBooks }),
    compendium,
    activeBooks
  );
}

export function applyAncestryChoice(
  character: Character,
  choiceId: string,
  option: string,
  catalogs?: CharacterCatalogs
): Character {
  const allRaces = catalogListings(catalogs).races();
  const choices = offeredRuleChoices(character, {
    raceCatalog: allRaces,
    activeBooks: catalogs?.activeBooks,
    origins: ["race"],
  });
  const choice = choices.find((c) => c.id === choiceId);
  if (!choice) return character;

  return pickRuleChoice(character, choice, option, catalogs?.compendium, catalogs?.activeBooks);
}

export function clearAncestryChoice(character: Character, choiceId: string, catalogs?: CharacterCatalogs): Character {
  const cleared: Character = {
    ...character,
    ruleChoices: (character.ruleChoices || []).filter((rc) => rc.id !== choiceId),
  };
  return reconcile(cleared, catalogs?.compendium ?? currentCompendium(), { activeBooks: catalogs?.activeBooks });
}

export function setAncestryChoiceASI(
  character: Character,
  picks: { key: AbilityKey; amount: number }[]
): Character {
  return setChoiceRacialBonus(character, picks);
}
