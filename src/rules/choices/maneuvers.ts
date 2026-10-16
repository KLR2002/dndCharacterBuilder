import type { Character } from "../../types/character.ts";
import { currentCompendium, type Compendium } from "../../services/compendium.ts";
import { setRuleChoicePick } from "../builderTransitions.ts";
import { type AvailableRuleChoice, getSubclassName } from "./types.ts";
import { hasFightingStyle } from "./fightingStyles.ts";

/**
 * Checks if a rule choice ID belongs to a maneuver choice.
 */
export function isManeuverChoiceId(id: string): boolean {
  return (
    id.includes("Battle Master__Maneuvers") ||
    id.includes("Superior Technique__Maneuver") ||
    id.includes("Martial Adept__Maneuvers") ||
    id.toLowerCase().includes("maneuver")
  );
}

/**
 * Returns all maneuvers chosen across any maneuver rule choices on the character.
 */
export function getChosenManeuvers(character: Character): string[] {
  const maneuvers: string[] = [];
  const seen = new Set<string>();
  for (const rc of character.ruleChoices || []) {
    if (isManeuverChoiceId(rc.id)) {
      for (const p of rc.picked || []) {
        const norm = p.trim();
        if (norm && !seen.has(norm.toLowerCase())) {
          seen.add(norm.toLowerCase());
          maneuvers.push(norm);
        }
      }
    }
  }
  return maneuvers;
}

/**
 * Returns Battle Master, Superior Technique, and Martial Adept maneuver choices
 * with dynamic cross-choice deduplication.
 */
export function battleMasterManeuverChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allOptions = compendium.for(upperBooks).optionsAndFeatures();

  const seenManeuverNames = new Set<string>();
  const maneuverOptions: { name: string; description: string }[] = [];
  for (const o of allOptions) {
    if ((o.category && o.category.includes("Maneuver")) || (o.featureType && o.featureType.includes("MV:B"))) {
      if (!seenManeuverNames.has(o.name)) {
        seenManeuverNames.add(o.name);
        maneuverOptions.push({
          name: o.name,
          description: o.description || "",
        });
      }
    }
  }
  maneuverOptions.sort((a, b) => a.name.localeCompare(b.name));

  const getPickedInOtherChoices = (currentChoiceId: string): Set<string> => {
    const picked = new Set<string>();
    for (const rc of character.ruleChoices || []) {
      if (rc.id !== currentChoiceId && isManeuverChoiceId(rc.id)) {
        for (const p of rc.picked || []) {
          picked.add(p.toLowerCase().trim());
        }
      }
    }
    return picked;
  };

  // 1. Fighter Battle Master milestones
  const fighter = (character.classes || []).find((c) => c.className.toLowerCase() === "fighter");
  const sub = fighter ? getSubclassName(fighter) : "";
  const isBattleMaster = fighter && (sub.includes("battle master") || sub.includes("battlemaster"));

  if (isBattleMaster && fighter.level >= 3) {
    const milestones = [
      { level: 3, choose: 3, id: "PHB__Fighter__Battle Master__Maneuvers 3", trait: "Combat Superiority (3rd Level)" },
      { level: 7, choose: 2, id: "PHB__Fighter__Battle Master__Maneuvers 7", trait: "Additional Maneuvers (7th Level)" },
      { level: 10, choose: 2, id: "PHB__Fighter__Battle Master__Maneuvers 10", trait: "Additional Maneuvers (10th Level)" },
      { level: 15, choose: 2, id: "PHB__Fighter__Battle Master__Maneuvers 15", trait: "Additional Maneuvers (15th Level)" },
    ];

    for (const m of milestones) {
      if (fighter.level >= m.level) {
        const otherPicked = getPickedInOtherChoices(m.id);
        out.push({
          id: m.id,
          traitName: m.trait,
          choose: m.choose,
          level: m.level,
          effectLevel: m.level,
          origin: "subclass",
          options: maneuverOptions.filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
        });
      }
    }
  }

  // 2. Fighting Style: Superior Technique
  if (hasFightingStyle(character, "Superior Technique")) {
    const id = "TCE__Fighter__Superior Technique__Maneuver";
    const otherPicked = getPickedInOtherChoices(id);
    out.push({
      id,
      traitName: "Superior Technique Maneuver",
      choose: 1,
      level: 1,
      effectLevel: 1,
      origin: "class",
      options: maneuverOptions.filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
    });
  }

  // 3. Feat: Martial Adept
  const hasMartialAdept = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase() === "martial adept");

  if (hasMartialAdept) {
    const id = "PHB__Feat__Martial Adept__Maneuvers";
    const otherPicked = getPickedInOtherChoices(id);
    out.push({
      id,
      traitName: "Martial Adept Maneuvers",
      choose: 2,
      level: 1,
      effectLevel: 1,
      origin: "class",
      options: maneuverOptions.filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
    });
  }

  return out;
}

/**
 * Prunes invalid maneuver choices when Battle Master levels, feats, or fighting styles change.
 */
export function pruneInvalidManeuvers(character: Character): Character {
  const fighter = (character.classes || []).find((c) => c.className.toLowerCase() === "fighter");
  const sub = fighter ? getSubclassName(fighter) : "";
  const isBattleMaster = Boolean(fighter && (sub.includes("battle master") || sub.includes("battlemaster")));
  const level = fighter ? fighter.level : 0;

  const validIds = new Set<string>();
  if (isBattleMaster && level >= 3) validIds.add("PHB__Fighter__Battle Master__Maneuvers 3");
  if (isBattleMaster && level >= 7) validIds.add("PHB__Fighter__Battle Master__Maneuvers 7");
  if (isBattleMaster && level >= 10) validIds.add("PHB__Fighter__Battle Master__Maneuvers 10");
  if (isBattleMaster && level >= 15) validIds.add("PHB__Fighter__Battle Master__Maneuvers 15");

  if (hasFightingStyle(character, "Superior Technique")) {
    validIds.add("TCE__Fighter__Superior Technique__Maneuver");
  }

  const hasMartialAdept = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase() === "martial adept");

  if (hasMartialAdept) {
    validIds.add("PHB__Feat__Martial Adept__Maneuvers");
  }

  const nextRuleChoices = (character.ruleChoices || []).filter((rc) => {
    if (isManeuverChoiceId(rc.id)) {
      return validIds.has(rc.id);
    }
    return true;
  });

  return {
    ...character,
    ruleChoices: nextRuleChoices,
  };
}

export function pickManeuverChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string
): Character {
  const origin = choice.id.includes("Feat") || choice.id.includes("Superior Technique")
    ? "class"
    : "subclass";
  return setRuleChoicePick(
    character,
    choice.id,
    choice.traitName,
    option,
    choice.options.map((o) => o.name),
    choice.choose,
    origin
  );
}
