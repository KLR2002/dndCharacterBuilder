import type { Character, RuleChoiceEntry } from "../../types/character.ts";
import { currentCompendium, type Compendium } from "../../services/compendium.ts";
import {
  type AvailableRuleChoice,
  type ChoiceOwner,
  resolveOptionName,
  setRuleChoicePick,
} from "./types.ts";

/** An Artificer Infusion as the catalog offers it. Its level comes from the record's prerequisite. */
export interface ArtificerInfusion {
  name: string;
  level: number;
  description: string;
}

/** The Artificer level a prerequisite names, as "6th-level Artificer". An infusion that names none is a 2nd-level infusion. */
function infusionLevel(prerequisite: string | null): number {
  const match = /(\d+)(?:st|nd|rd|th)-level Artificer/i.exec(prerequisite ?? "");
  return match ? parseInt(match[1], 10) : 2;
}

/**
 * The infusions the catalog offers, read from its AI option records. The umbrella record that carries
 * the replicable-item tables is not an infusion of its own. An empty list means the catalog offers no
 * infusions: the SRD Baseline, or a catalog synced before they were scraped.
 */
export function catalogArtificerInfusions(compendium: Compendium = currentCompendium()): ArtificerInfusion[] {
  return compendium
    .for()
    .optionsAndFeatures()
    .filter((o) => o.featureType?.includes("AI") && !o.isUmbrella)
    .map((o) => ({ name: o.name, level: infusionLevel(o.prerequisite), description: o.description || "" }));
}

/** The catalog's infusion a saved name refers to, matched as saved picks are. Undefined when the catalog does not offer it. */
export function findArtificerInfusion(
  savedName: string,
  compendium: Compendium = currentCompendium()
): ArtificerInfusion | undefined {
  const infusions = catalogArtificerInfusions(compendium);
  const name = resolveOptionName(savedName, infusions.map((i) => i.name));
  return infusions.find((i) => i.name === name);
}

/**
 * Checks if a rule choice ID corresponds to an Artificer Infusions choice.
 */
export function isInfusionChoiceId(id: string): boolean {
  return id.startsWith("TCE__Artificer__Infusions");
}

/** Infusion choices are owned by the Artificer class: they are not subclass-granted. */
export function infusionOwnerOf(id: string): ChoiceOwner | undefined {
  return isInfusionChoiceId(id) ? { className: "Artificer" } : undefined;
}

/**
 * Checks if character has chosen this infusion in any rule choice.
 */
export function hasInfusion(character: Character, infusionName: string): boolean {
  const norm = infusionName.toLowerCase().trim();
  return (character.ruleChoices || []).some(
    (rc) => isInfusionChoiceId(rc.id) && rc.picked?.some((p) => p.toLowerCase().trim() === norm)
  );
}

/**
 * Returns all known Artificer infusions chosen by the character.
 */
export function getKnownInfusions(character: Character): string[] {
  const known: string[] = [];
  for (const rc of character.ruleChoices || []) {
    if (isInfusionChoiceId(rc.id)) {
      for (const p of rc.picked || []) {
        if (!known.includes(p)) {
          known.push(p);
        }
      }
    }
  }
  return known;
}

/**
 * Returns the maximum number of active infused items an Artificer can sustain.
 * 2 at lvl 2, 3 at lvl 6, 4 at lvl 10, 5 at lvl 14, 6 at lvl 18.
 * +2 if Armorer subclass and level >= 9.
 */
export function getMaxActiveInfusions(character: Character): number {
  const classes = character.classes || [];
  const artificer = classes.find((c) => c.className.toLowerCase() === "artificer");
  if (!artificer || artificer.level < 2) return 0;

  const lvl = artificer.level;
  let maxActive = 2;
  if (lvl >= 18) {
    maxActive = 6;
  } else if (lvl >= 14) {
    maxActive = 5;
  } else if (lvl >= 10) {
    maxActive = 4;
  } else if (lvl >= 6) {
    maxActive = 3;
  } else {
    maxActive = 2;
  }

  const sub = (artificer.subclassName || artificer.subclass || "").toLowerCase();
  if (sub.includes("armorer") && lvl >= 9) {
    maxActive += 2;
  }

  return maxActive;
}

/**
 * Checks whether an item is a nonmagical mundane item eligible for Artificer item-enhancement infusions.
 * Under 2014 RAW, infusions must target nonmagical mundane objects.
 * Returns true if the item has no rarity (or rarity "None") and no intrinsic bonusWeapon or bonusAc.
 */
export function isMundaneItem(item: {
  rarity?: string;
  bonusWeapon?: number;
  bonusAc?: number;
}): boolean {
  const isMundaneRarity = !item.rarity || item.rarity === "None" || item.rarity.toLowerCase() === "none";
  return Boolean(isMundaneRarity && !item.bonusWeapon && !item.bonusAc);
}

export function isMundaneInfusionTarget(item: {
  rarity?: string;
  bonusWeapon?: number;
  bonusAc?: number;
}): boolean {
  return isMundaneItem(item);
}

export const ARTIFICER_INFUSIONS_KNOWN_ID = "TCE__Artificer__Infusions Known";

export function getArtificerInfusionCapacity(level: number): number {
  if (level < 2) return 0;
  if (level >= 18) return 12;
  if (level >= 14) return 10;
  if (level >= 10) return 8;
  if (level >= 6) return 6;
  return 4;
}

/**
 * Returns available Artificer Infusions Known rule choices for the character. Options come from the
 * catalog's infusions. A catalog without them offers no choice.
 * Supports both milestone-based IDs (e.g. TCE__Artificer__Infusions 2) and canonical unified ID (TCE__Artificer__Infusions Known).
 */
export function artificerInfusionChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium(),
  preferUnified = false
): AvailableRuleChoice[] {
  const classes = character.classes || [];
  const artificer = classes.find((c) => c.className.toLowerCase() === "artificer");
  const artificerLevel = artificer ? artificer.level : 0;
  if (artificerLevel < 2) return [];

  if (activeBooks && activeBooks.length > 0) {
    const upper = activeBooks.map((b) => b.toUpperCase());
    if (!upper.includes("TCE") && !upper.includes("ERLW")) {
      return [];
    }
  }

  // A stale catalog may hold infusion records from before the umbrella flag and the Replicate rows: no choice until re-sync.
  if (compendium.stale) return [];
  const infusions = catalogArtificerInfusions(compendium);
  if (infusions.length === 0) return [];

  const isUnified = Boolean(
    preferUnified ||
    character.ruleChoices?.some((rc) => rc.id === ARTIFICER_INFUSIONS_KNOWN_ID)
  );

  if (isUnified) {
    const eligible = infusions
      .filter((opt) => opt.level <= artificerLevel)
      .map((opt) => ({
        name: opt.name,
        description: opt.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [
      {
        id: ARTIFICER_INFUSIONS_KNOWN_ID,
        traitName: "Infusions Known",
        origin: "class",
        pick: "artificerInfusion",
        choose: getArtificerInfusionCapacity(artificerLevel),
        level: 2,
        effectLevel: 2,
        options: eligible,
      },
    ];
  }

  const milestones: { level: number; choose: number; traitName: string }[] = [
    { level: 2, choose: 4, traitName: "Infusions Known (2nd Level)" },
    { level: 6, choose: 2, traitName: "Infusions Known (6th Level)" },
    { level: 10, choose: 2, traitName: "Infusions Known (10th Level)" },
    { level: 14, choose: 2, traitName: "Infusions Known (14th Level)" },
    { level: 18, choose: 2, traitName: "Infusions Known (18th Level)" },
  ];

  const getPickedInOtherInfusionChoices = (currentChoiceId: string): Set<string> => {
    const picked = new Set<string>();
    for (const rc of character.ruleChoices || []) {
      if (rc.id !== currentChoiceId && isInfusionChoiceId(rc.id)) {
        for (const p of rc.picked || []) {
          picked.add(p.toLowerCase().trim());
        }
      }
    }
    return picked;
  };

  const out: AvailableRuleChoice[] = [];
  for (const m of milestones) {
    if (artificerLevel >= m.level) {
      const id = `TCE__Artificer__Infusions ${m.level}`;
      const otherPicked = getPickedInOtherInfusionChoices(id);
      const eligible = infusions
        .filter((opt) => opt.level <= artificerLevel)
        .filter((opt) => !otherPicked.has(opt.name.toLowerCase().trim()))
        .map((opt) => ({
          name: opt.name,
          description: opt.description,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      out.push({
        id,
        traitName: m.traitName,
        origin: "class",
        pick: "artificerInfusion",
        choose: m.choose,
        level: m.level,
        effectLevel: m.level,
        options: eligible,
      });
    }
  }

  return out;
}

/**
 * Prunes invalid Artificer infusions when levels change or character delevels. A catalog without
 * infusions, or a stale one, cannot say which picks are still valid, so nothing is pruned.
 */
export function pruneInvalidInfusions(character: Character, compendium: Compendium = currentCompendium()): Character {
  if (compendium.stale) return character;
  const infusions = catalogArtificerInfusions(compendium);
  if (infusions.length === 0) return character;

  const classes = character.classes || [];
  const artificer = classes.find((c) => c.className.toLowerCase() === "artificer");
  const artificerLevel = artificer ? artificer.level : 0;

  const validChoices = artificerInfusionChoices(character, undefined, compendium);
  const validChoiceMap = new Map<string, AvailableRuleChoice>();
  for (const c of validChoices) {
    validChoiceMap.set(c.id, c);
  }

  if (artificerLevel >= 2 && !validChoiceMap.has(ARTIFICER_INFUSIONS_KNOWN_ID)) {
    const unifiedChoices = artificerInfusionChoices(character, undefined, compendium, true);
    for (const c of unifiedChoices) {
      validChoiceMap.set(c.id, c);
    }
  }

  const seenPicks = new Set<string>();
  const nextRuleChoices: RuleChoiceEntry[] = [];
  const removedInfusions: string[] = [];
  const eligibleNames = infusions.filter((i) => i.level <= artificerLevel).map((i) => i.name);

  for (const rc of character.ruleChoices || []) {
    if (isInfusionChoiceId(rc.id)) {
      const validChoice = validChoiceMap.get(rc.id);
      if (!validChoice) {
        for (const p of rc.picked || []) {
          removedInfusions.push(p);
        }
        continue;
      }

      // A saved pick is kept under the catalog's name, so it is stored as the catalog spells it from now on.
      const keptPicks: string[] = [];
      for (const p of rc.picked || []) {
        const name = resolveOptionName(p, eligibleNames);
        if (name === undefined) {
          removedInfusions.push(p);
          continue;
        }
        const norm = name.toLowerCase();
        if (!seenPicks.has(norm)) {
          seenPicks.add(norm);
          keptPicks.push(name);
        }
      }

      const cappedPicks = keptPicks.slice(0, validChoice.choose);
      if (cappedPicks.length > 0) {
        nextRuleChoices.push({
          ...rc,
          picked: cappedPicks,
          choose: validChoice.choose,
        });
      }
    } else {
      nextRuleChoices.push(rc);
    }
  }

  const knownSet = new Set(
    nextRuleChoices
      .filter((rc) => isInfusionChoiceId(rc.id))
      .flatMap((rc) => rc.picked || [])
      .map((p) => p.toLowerCase().trim())
  );

  const maxActive = getMaxActiveInfusions({ ...character, classes, ruleChoices: nextRuleChoices });
  const rawActive = character.activeInfusions || [];
  const validActive: { infusionName: string; targetItemId?: string; targetItemName?: string }[] = [];

  for (const act of rawActive) {
    const actNorm = act.infusionName.toLowerCase().trim();
    if (!knownSet.has(actNorm)) {
      removedInfusions.push(act.infusionName);
      continue;
    }
    if (!actNorm.startsWith("replicate magic item:") && act.targetItemId) {
      const targetItem = (character.items || []).find((i) => i.id === act.targetItemId);
      if (targetItem && !isMundaneItem(targetItem)) {
        removedInfusions.push(`${act.infusionName} (target item is magical; requires nonmagical object)`);
        continue;
      }
    }
    validActive.push(act);
  }

  const cappedActive = validActive.slice(0, maxActive);
  if (rawActive.length > cappedActive.length) {
    for (const excess of rawActive.slice(cappedActive.length)) {
      if (!removedInfusions.includes(excess.infusionName)) {
        removedInfusions.push(excess.infusionName);
      }
    }
  }

  const activeInfusionNames = new Set(cappedActive.map((a) => a.infusionName.toLowerCase().trim()));
  const activeTargetItemIds = new Set(cappedActive.map((a) => a.targetItemId).filter(Boolean));

  let nextItems = character.items || [];
  if (nextItems.length > 0) {
    nextItems = nextItems
      .filter((item) => {
        if (item.isInfused && item.infusedWith) {
          const norm = item.infusedWith.toLowerCase().trim();
          if (norm.startsWith("replicate magic item:")) {
            return activeInfusionNames.has(norm);
          }
        }
        return true;
      })
      .map((item) => {
        if (item.infusedWith && !item.infusedWith.toLowerCase().trim().startsWith("replicate magic item:")) {
          const norm = item.infusedWith.toLowerCase().trim();
          if (
            !activeInfusionNames.has(norm) ||
            (item.id && !activeTargetItemIds.has(item.id)) ||
            !isMundaneItem(item)
          ) {
            const { infusedWith, isInfused, ...rest } = item;
            return rest;
          }
        }
        return item;
      });
  }

  const needsReviewSet = new Set(character.needsReview || []);
  for (const removed of removedInfusions) {
    needsReviewSet.add(`${removed} removed: Artificer level or known infusion no longer meets prerequisite`);
  }

  return {
    ...character,
    ruleChoices: nextRuleChoices,
    activeInfusions: cappedActive.length > 0 ? cappedActive : undefined,
    items: nextItems,
    needsReview: needsReviewSet.size > 0 ? Array.from(needsReviewSet) : undefined,
  };
}

/**
 * Records or updates an Artificer infusion choice pick for a character. Saved picks on the choice are
 * first rewritten to the catalog's names, so the pick toggles and compares as the catalog spells it.
 */
export function pickInfusionChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string
): Character {
  const names = choice.options.map((o) => o.name);
  const canonical = (name: string) => resolveOptionName(name, names) ?? name;
  const withCatalogNames: Character = {
    ...character,
    ruleChoices: (character.ruleChoices ?? []).map((rc) =>
      rc.id === choice.id ? { ...rc, picked: (rc.picked ?? []).map(canonical) } : rc
    ),
  };
  return setRuleChoicePick(
    withCatalogNames,
    choice.id,
    choice.traitName,
    canonical(option),
    names,
    choice.choose,
    "class"
  );
}
