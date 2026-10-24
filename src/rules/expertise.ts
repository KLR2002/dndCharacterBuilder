import type { Character } from "../types/character.ts";
import { skills } from "./skills.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { proficiencySheet } from "./proficiencySheet.ts";

export interface ExpertiseMilestone {
  id: string;
  label: string;
  count: number;
  options: string[];
}

export function getMilestonePicks(
  milestones: ExpertiseMilestone[],
  chosenExpertise: string[]
): { milestone: ExpertiseMilestone; chosen: string[]; from: string[] }[] {
  const remainingChosen = [...(chosenExpertise || [])];
  const allClaimed = new Set<string>();
  const result: { milestone: ExpertiseMilestone; chosen: string[]; from: string[] }[] = [];

  for (const m of milestones) {
    const from = m.options.filter((opt) => !allClaimed.has(opt.toLowerCase()));
    const chosen: string[] = [];

    for (let i = 0; i < remainingChosen.length && chosen.length < m.count; ) {
      const exp = remainingChosen[i];
      if (from.some((f) => f.toLowerCase() === exp.toLowerCase())) {
        chosen.push(exp);
        allClaimed.add(exp.toLowerCase());
        remainingChosen.splice(i, 1);
      } else {
        i++;
      }
    }

    result.push({ milestone: m, chosen, from });
  }

  return result;
}

export function getAvailableExpertiseMilestones(
  character: Character,
  catalogs: CharacterCatalogs
): ExpertiseMilestone[] {
  const milestones: ExpertiseMilestone[] = [];
  // Skills and tools both come from the Proficiency Sheet, so background, feat and subclass grants and
  // Added tools are eligible (ADR 0015).
  const sheet = proficiencySheet(character, catalogs);
  const proficientSkills = skills(character, sheet.skills)
    .filter((s) => s.isProficient)
    .map((s) => s.name);
  const sheetTools = sheet.tools.map((t) => t.name);
  const hasThievesTools = sheetTools.some((t) => t.toLowerCase() === "thieves' tools");

  // Rogue
  const rogue = (character.classes || []).find((c) => c.className === "Rogue");
  if (rogue) {
    const rogueOptions = hasThievesTools
      ? Array.from(new Set([...proficientSkills, "Thieves' Tools"]))
      : [...proficientSkills];
    if (rogue.level >= 1) {
      milestones.push({
        id: "rogue_1",
        label: "Rogue Expertise (Level 1)",
        count: 2,
        options: rogueOptions,
      });
    }
    if (rogue.level >= 6) {
      milestones.push({
        id: "rogue_6",
        label: "Rogue Expertise (Level 6)",
        count: 2,
        options: rogueOptions,
      });
    }
  }

  // Bard
  const bard = (character.classes || []).find((c) => c.className === "Bard");
  if (bard) {
    if (bard.level >= 3) {
      milestones.push({
        id: "bard_3",
        label: "Bard Expertise (Level 3)",
        count: 2,
        options: proficientSkills,
      });
    }
    if (bard.level >= 10) {
      milestones.push({
        id: "bard_10",
        label: "Bard Expertise (Level 10)",
        count: 2,
        options: proficientSkills,
      });
    }
  }

  // Ranger (TCoE Deft Explorer: Canny)
  const ranger = (character.classes || []).find((c) => c.className === "Ranger");
  const isDeftExplorer = Boolean(
    character.optionalFeatureReplacements?.["Natural Explorer"] ||
    character.optionalFeatureReplacements?.["Deft Explorer"]
  );
  if (ranger && ranger.level >= 1 && isDeftExplorer) {
    milestones.push({
      id: "ranger_deft_explorer_1",
      label: "Deft Explorer: Canny (Ranger Level 1)",
      count: 1,
      options: proficientSkills,
    });
  }

  // Feats
  const hasSkillExpert = (character.asiSelections || []).some(
    (asi) => asi.type === "feat" && asi.featName?.toLowerCase() === "skill expert"
  );
  if (hasSkillExpert) {
    milestones.push({
      id: "feat_skill_expert",
      label: "Feat: Skill Expert",
      count: 1,
      options: proficientSkills,
    });
  }

  const hasProdigy = (character.asiSelections || []).some(
    (asi) => asi.type === "feat" && asi.featName?.toLowerCase() === "prodigy"
  );
  if (hasProdigy) {
    milestones.push({
      id: "feat_prodigy",
      label: "Feat: Prodigy",
      count: 1,
      options: proficientSkills,
    });
  }

  return milestones;
}

export function pruneInvalidExpertise(
  character: Character,
  catalogs: CharacterCatalogs
): Character {
  const milestones = getAvailableExpertiseMilestones(character, catalogs);
  const totalCapacity = milestones.reduce((sum, m) => sum + m.count, 0);

  const allAllowedOptions = new Set<string>();
  for (const m of milestones) {
    for (const opt of m.options) {
      allAllowedOptions.add(opt.toLowerCase());
    }
  }

  const validChosen: string[] = [];
  for (const exp of character.chosenExpertise || []) {
    const clean = exp.trim().toLowerCase();
    if (allAllowedOptions.has(clean) && !validChosen.map((x) => x.toLowerCase()).includes(clean)) {
      validChosen.push(exp);
    }
  }

  const pruned = validChosen.slice(0, totalCapacity);

  if (
    character.chosenExpertise &&
    character.chosenExpertise.length === pruned.length &&
    character.chosenExpertise.every((val, idx) => val === pruned[idx])
  ) {
    return character;
  }

  // Each dropped pick gets a review notice: no longer offered, or no slot left for it.
  const keptKeys = new Set(pruned.map((x) => x.trim().toLowerCase()));
  const notices: string[] = [];
  const seenKeys = new Set<string>();
  for (const exp of character.chosenExpertise || []) {
    const key = exp.trim().toLowerCase();
    if (keptKeys.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    notices.push(
      allAllowedOptions.has(key)
        ? `${exp} Expertise removed: no Expertise slot left`
        : `${exp} Expertise removed: ${exp} is no longer a proficient skill or tool`
    );
  }

  return {
    ...character,
    chosenExpertise: pruned,
    needsReview: Array.from(new Set([...(character.needsReview || []), ...notices])),
  };
}

export function toggleExpertiseChoice(
  character: Character,
  item: string,
  catalogs: CharacterCatalogs
): Character {
  const current = [...(character.chosenExpertise || [])];
  const cleanItem = item.trim().toLowerCase();
  const index = current.findIndex((x) => x.trim().toLowerCase() === cleanItem);

  if (index >= 0) {
    current.splice(index, 1);
    return {
      ...character,
      chosenExpertise: current,
    };
  }

  const milestones = getAvailableExpertiseMilestones(character, catalogs);
  const milestonePicks = getMilestonePicks(milestones, current);

  const eligibleMilestone = milestonePicks.find(
    (p) =>
      p.chosen.length < p.milestone.count &&
      p.from.some((o) => o.trim().toLowerCase() === cleanItem)
  );

  if (!eligibleMilestone) {
    return character;
  }

  current.push(item);
  return {
    ...character,
    chosenExpertise: current,
  };
}
