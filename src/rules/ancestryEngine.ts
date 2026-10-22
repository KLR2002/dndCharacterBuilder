import type { AbilityKey, AsiSelection, Character, RuleChoiceEntry } from "../types/character.ts";
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
import { getBackgroundFeatGrant } from "./feats.ts";
import { normalizeSkillName } from "./skills.ts";
import { moveLegacySkillPicks } from "./proficiencyPicks.ts";

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
  hasRacialCantrip: boolean;
  racialCantripTitle?: string;
  currentRacialCantrip?: string;
}

const CHOICE_ASI_RACES = new Set(["Half-Elf", "Custom Lineage"]);
export const HIGH_ELF_CANTRIP_CHOICE_ID = "PHB__Elf__PHB__High Elf__Cantrip";

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

export function resolveAncestryState(
  character: Character,
  catalogs?: CharacterCatalogs
): AncestryState {
  const allRaces = catalogListings(catalogs).races();
  const selectedRace = character.race
    ? allRaces.find(
        (r) =>
          r.name === character.race?.name &&
          (!character.race.source || r.source === character.race.source)
      ) || allRaces.find((r) => r.name === character.race?.name)
    : undefined;
  const selectedSubrace = selectedRace?.subraces?.find(
    (sr) =>
      sr.name === character.race?.subraceName &&
      (!character.race?.subraceSource || sr.source === character.race.subraceSource)
  ) || selectedRace?.subraces?.find((sr) => sr.name === character.race?.subraceName);

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
    ? allRaces.find((r) => r.name === character.lineageReplacement)
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
      const bgGrant = character.background ? getBackgroundFeatGrant(character.background.name) : null;
      currentOriginFeat = (character.originFeats || []).find(
        (f) => !bgGrant || f.featName?.toLowerCase() !== bgGrant.featName.toLowerCase()
      );
    }
  }

  // Racial Cantrip resolution (High Elf, Half-Elf High descent)
  let hasRacialCantrip = false;
  let racialCantripTitle: string | undefined;
  let currentRacialCantrip: string | undefined;

  if (character.race) {
    const raceLower = character.race.name.toLowerCase();
    const subraceLower = (character.race.subraceName || "").toLowerCase();

    const isElfHigh =
      raceLower === "elf" &&
      (subraceLower === "high" ||
        subraceLower === "high elf" ||
        subraceLower.includes("high") ||
        subraceLower.includes("sun") ||
        subraceLower.includes("moon"));

    const isHalfElfHigh =
      raceLower.includes("half-elf") &&
      (subraceLower.includes("high") || subraceLower.includes("sun") || subraceLower.includes("moon"));

    const halfElfHasCantrip =
      isHalfElfHigh &&
      Boolean(
        character.ruleChoices?.some(
          (r) => r.from?.includes("Cantrip") && r.picked?.includes("Cantrip")
        )
      );

    if (isElfHigh) {
      hasRacialCantrip = true;
      racialCantripTitle = "High Elf Cantrip";
    } else if (halfElfHasCantrip) {
      hasRacialCantrip = true;
      racialCantripTitle = "Half-Elf Cantrip";
    }

    if (hasRacialCantrip) {
      const highElfPick = character.ruleChoices?.find(
        (r) => r.id === HIGH_ELF_CANTRIP_CHOICE_ID || r.id.includes("High Elf")
      )?.picked?.[0];
      currentRacialCantrip = highElfPick || character.knownSpells?.find((k) => k.ownerKey === "racial__innate")?.name;
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
    hasRacialCantrip,
    racialCantripTitle,
    currentRacialCantrip,
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
  const migrated = moveLegacySkillPicks(character, compendium);
  const oldRaceChoices = (migrated.skillChoices || []).filter((sc) => sc.origin === "race");
  const oldRacePicks = new Set(oldRaceChoices.flatMap((sc) => sc.picked.map(normalizeSkillName)));
  const nextSkillChoices = (migrated.skillChoices || []).filter((sc) => sc.origin !== "race");
  const nextChosenSkills = (migrated.chosenSkills || []).filter((s) => !oldRacePicks.has(normalizeSkillName(s)));

  const cleaned: Character = {
    ...migrated,
    race: updatedRace,
    racialAbilityBonuses: bonuses,
    racialChoiceBonus: [],
    chosenLanguages: nextChosenLanguages,
    chosenTools: nextChosenTools,
    ruleChoices: (character.ruleChoices || []).filter((rc) => rc.origin !== "race"),
    skillChoices: nextSkillChoices,
    chosenSkills: nextChosenSkills,
  };

  return reconcile(cleaned, compendium);
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

  const updated = pickRuleChoice(character, choice, option, catalogs?.compendium);

  // Cascading invalidation: if this choice has a "Cantrip" option, and "Cantrip" is NOT picked in updated state
  // (either because user picked another option OR toggled Cantrip off), purge any cantrip choice!
  const hasCantripOption = choice.options.some((o) => o.name === "Cantrip");
  const isCantripStillPicked = (updated.ruleChoices || [])
    .find((rc) => rc.id === choice.id)
    ?.picked.includes("Cantrip");

  if (hasCantripOption && !isCantripStillPicked) {
    return {
      ...updated,
      ruleChoices: (updated.ruleChoices || []).filter(
        (rc) => rc.id !== HIGH_ELF_CANTRIP_CHOICE_ID && !rc.id.includes("High Elf")
      ),
    };
  }

  return updated;
}

export function clearAncestryChoice(
  character: Character,
  choiceId: string
): Character {
  return {
    ...character,
    ruleChoices: (character.ruleChoices || []).filter(
      (rc) => rc.id !== choiceId && (rc.id !== HIGH_ELF_CANTRIP_CHOICE_ID && !rc.id.includes("High Elf"))
    ),
  };
}

export function setRacialCantrip(
  character: Character,
  cantripName: string | null
): Character {
  if (!cantripName) {
    return {
      ...character,
      ruleChoices: (character.ruleChoices || []).filter(
        (rc) => rc.id !== HIGH_ELF_CANTRIP_CHOICE_ID && !rc.id.includes("High Elf")
      ),
      knownSpells: (character.knownSpells || []).filter(
        (k) => k.ownerKey !== "racial__innate"
      ),
    };
  }

  const existingChoices = (character.ruleChoices || []).filter(
    (rc) => rc.id !== HIGH_ELF_CANTRIP_CHOICE_ID && !rc.id.includes("High Elf")
  );

  const cantripEntry: RuleChoiceEntry = {
    id: HIGH_ELF_CANTRIP_CHOICE_ID,
    trait: "Cantrip",
    origin: "race",
    choose: 1,
    from: [cantripName],
    picked: [cantripName],
  };

  return {
    ...character,
    ruleChoices: [...existingChoices, cantripEntry],
  };
}

export function setAncestryChoiceASI(
  character: Character,
  picks: { key: AbilityKey; amount: number }[]
): Character {
  return setChoiceRacialBonus(character, picks);
}
