import type { Character } from "../types/character.ts";
import { skills } from "./skills.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { proficiencySheet, type ProficiencySheet } from "./proficiencySheet.ts";
import { withNotices } from "./needsReview.ts";
import { hasFeat } from "./abilities.ts";

export interface ExpertiseMilestone {
  id: string;
  label: string;
  count: number;
  options: string[];
}

/**
 * Places each saved pick, in saved order, into the first milestone with a free slot that offers it. When none has
 * room, the last placed pick that can move to a free milestone steps aside for it, if its own milestone offers the
 * new pick. A pick that cannot be placed is left out of every milestone.
 */
export function getMilestonePicks(
  milestones: ExpertiseMilestone[],
  chosenExpertise: string[]
): { milestone: ExpertiseMilestone; chosen: string[]; from: string[] }[] {
  const picks = [...(chosenExpertise || [])];
  const owner = picks.map(() => -1);
  const used = milestones.map(() => 0);
  const claimed = new Set<string>();
  const offers = (mi: number, name: string) =>
    milestones[mi].options.some((opt) => opt.toLowerCase() === name.toLowerCase());
  const freeFor = (name: string) =>
    milestones.findIndex((m, mi) => used[mi] < m.count && offers(mi, name));

  picks.forEach((pick, i) => {
    const key = pick.toLowerCase();
    if (claimed.has(key)) return;
    const open = freeFor(pick);
    if (open >= 0) {
      owner[i] = open;
      used[open]++;
      claimed.add(key);
      return;
    }
    for (let j = i - 1; j >= 0; j--) {
      const held = owner[j];
      if (held < 0 || !offers(held, pick)) continue;
      const moveTo = freeFor(picks[j]);
      if (moveTo < 0) continue;
      owner[j] = moveTo;
      used[moveTo]++;
      owner[i] = held;
      claimed.add(key);
      return;
    }
  });

  return milestones.map((m, mi) => {
    const claimedBefore = new Set(
      picks.filter((_, i) => owner[i] >= 0 && owner[i] < mi).map((p) => p.toLowerCase())
    );
    return {
      milestone: m,
      chosen: picks.filter((_, i) => owner[i] === mi),
      from: m.options.filter((opt) => !claimedBefore.has(opt.toLowerCase())),
    };
  });
}

export function getAvailableExpertiseMilestones(
  character: Character,
  catalogs: CharacterCatalogs
): ExpertiseMilestone[] {
  return milestonesFromSheet(character, proficiencySheet(character, catalogs));
}

/**
 * The Expertise milestones the character has, read from its Proficiency Sheet. A skill whose Expertise a grant
 * already gives is not offered to any milestone: Expertise does not stack, so a pick there would waste its slot.
 */
function milestonesFromSheet(character: Character, sheet: ProficiencySheet): ExpertiseMilestone[] {
  const milestones: ExpertiseMilestone[] = [];
  // Skills and tools both come from the Proficiency Sheet, so background, feat and subclass grants and
  // Added tools are eligible (ADR 0015).
  const grantExpertise = grantExpertiseNames(sheet);
  const proficientSkills = skills(character, sheet.skills)
    .filter((s) => s.isProficient && !grantExpertise.has(s.name.toLowerCase()))
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
  if (hasFeat(character, "Skill Expert")) {
    milestones.push({
      id: "feat_skill_expert",
      label: "Feat: Skill Expert",
      count: 1,
      options: proficientSkills,
    });
  }

  if (hasFeat(character, "Prodigy")) {
    milestones.push({
      id: "feat_prodigy",
      label: "Feat: Prodigy",
      count: 1,
      options: proficientSkills,
    });
  }

  return milestones;
}

/** The lower-cased names of the skills a Proficiency Grant gives Expertise. */
function grantExpertiseNames(sheet: ProficiencySheet): Set<string> {
  return new Set(sheet.skills.filter((entry) => entry.expertise).map((entry) => entry.name.toLowerCase()));
}

export function pruneInvalidExpertise(
  character: Character,
  catalogs: CharacterCatalogs
): Character {
  const sheet = proficiencySheet(character, catalogs);
  const grantExpertise = grantExpertiseNames(sheet);
  const milestones = milestonesFromSheet(character, sheet);
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

  // Each dropped pick gets a review notice saying why it lost its Expertise: a grant gives it, no slot is left for
  // it, no slot takes it, or it is no longer held.
  const held = new Set<string>([
    ...skills(character, sheet.skills).filter((s) => s.isProficient).map((s) => s.name.toLowerCase()),
    ...sheet.tools.map((t) => t.name.toLowerCase()),
  ]);
  const keptKeys = new Set(pruned.map((x) => x.trim().toLowerCase()));
  const notices: string[] = [];
  const seenKeys = new Set<string>();
  for (const exp of character.chosenExpertise || []) {
    const key = exp.trim().toLowerCase();
    if (keptKeys.has(key) || seenKeys.has(key)) continue;
    seenKeys.add(key);
    notices.push(
      grantExpertise.has(key)
        ? `${exp} Expertise removed: ${exp} already has Expertise from a grant`
        : allAllowedOptions.has(key) || (held.has(key) && milestones.length === 0)
          ? `${exp} Expertise removed: no Expertise slot left`
          : held.has(key)
            ? `${exp} Expertise removed: no Expertise slot takes ${exp}`
            : `${exp} Expertise removed: ${exp} is no longer a proficient skill or tool`
    );
  }

  return withNotices({ ...character, chosenExpertise: pruned }, notices);
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
  const placed = getMilestonePicks(milestones, [...current, item]).some((p) =>
    p.chosen.some((c) => c.trim().toLowerCase() === cleanItem)
  );

  if (!placed) {
    return character;
  }

  current.push(item);
  return {
    ...character,
    chosenExpertise: current,
  };
}
