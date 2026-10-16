import type { Character, KnownSpell } from "../../types/character.ts";
import { currentCompendium, type Compendium } from "../../services/compendium.ts";
import {
  type AvailableRuleChoice,
  type ChoiceOwner,
  formatCantripOptions,
  getSubclassName,
  setRuleChoicePick,
} from "./types.ts";

/** Who owns each fighting style choice id this module issues. Feat-granted ids have no class owner. */
const FIGHTING_STYLE_OWNERS = new Map<string, ChoiceOwner>([
  ["PHB__Fighter__Fighting Style", { className: "Fighter" }],
  ["PHB__Fighter__Additional Fighting Style 10", { className: "Fighter", subclass: "Champion" }],
  ["PHB__Paladin__Fighting Style", { className: "Paladin" }],
  ["PHB__Ranger__Fighting Style", { className: "Ranger" }],
  ["XGE__Bard__College of Swords__Fighting Style", { className: "Bard", subclass: "College of Swords" }],
  ["TCE__Paladin__Blessed Warrior Cantrips", { className: "Paladin" }],
  ["TCE__Ranger__Druidic Warrior Cantrips", { className: "Ranger" }],
]);

/** The owner of a fighting style choice id, or undefined when this module does not issue the id. */
export function fightingStyleOwnerOf(id: string): ChoiceOwner | undefined {
  return FIGHTING_STYLE_OWNERS.get(id);
}

/**
 * Checks if character has chosen this fighting style in any rule choice.
 */
export function hasFightingStyle(character: Character, styleName: string): boolean {
  const norm = styleName.toLowerCase().trim();
  return (character.ruleChoices || []).some(
    (rc) =>
      (rc.id.includes("Fighting Style") || rc.id.includes("Fighting Initiate")) &&
      rc.picked.some((p) => p.toLowerCase().trim() === norm)
  );
}

/**
 * Returns available fighting style choices for character with dynamic cross-choice deduplication.
 */
export function fightingStyleRuleChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const out: Omit<AvailableRuleChoice, "origin" | "pick">[] = [];
  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allOptions = compendium.for(upperBooks).optionsAndFeatures();

  const getStyleOptions = (featureTag: string): { name: string; description: string }[] => {
    return allOptions
      .filter((o) => o.featureType && o.featureType.includes(featureTag))
      .map((o) => ({
        name: o.name,
        description: o.description || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const getPickedInOtherChoices = (currentChoiceId: string): Set<string> => {
    const picked = new Set<string>();
    for (const rc of character.ruleChoices || []) {
      if (
        rc.id !== currentChoiceId &&
        (rc.id.includes("Fighting Style") || rc.id.includes("Fighting Initiate"))
      ) {
        for (const p of rc.picked || []) {
          picked.add(p.toLowerCase().trim());
        }
      }
    }
    return picked;
  };

  for (const c of character.classes || []) {
    const clsLower = c.className.toLowerCase().trim();
    const sub = getSubclassName(c);

    // Fighter level >= 1
    if (clsLower === "fighter" && c.level >= 1) {
      const id = "PHB__Fighter__Fighting Style";
      const otherPicked = getPickedInOtherChoices(id);
      out.push({
        id,
        traitName: "Fighting Style",
        choose: 1,
        level: 1,
        effectLevel: 1,
        options: getStyleOptions("FS:F").filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
      });

      // Fighter Champion level >= 10
      if (c.level >= 10 && sub.includes("champion")) {
        const champId = "PHB__Fighter__Additional Fighting Style 10";
        const champOtherPicked = getPickedInOtherChoices(champId);
        out.push({
          id: champId,
          traitName: "Additional Fighting Style",
          choose: 1,
          level: 10,
          effectLevel: 10,
          options: getStyleOptions("FS:F").filter((o) => !champOtherPicked.has(o.name.toLowerCase().trim())),
        });
      }
    }

    // Paladin level >= 2
    if (clsLower === "paladin" && c.level >= 2) {
      const id = "PHB__Paladin__Fighting Style";
      const otherPicked = getPickedInOtherChoices(id);
      out.push({
        id,
        traitName: "Fighting Style",
        choose: 1,
        level: 2,
        effectLevel: 2,
        options: getStyleOptions("FS:P").filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
      });
    }

    // Ranger level >= 2
    if (clsLower === "ranger" && c.level >= 2) {
      const id = "PHB__Ranger__Fighting Style";
      const otherPicked = getPickedInOtherChoices(id);
      out.push({
        id,
        traitName: "Fighting Style",
        choose: 1,
        level: 2,
        effectLevel: 2,
        options: getStyleOptions("FS:R").filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
      });
    }

    // Bard College of Swords level >= 3
    if (clsLower === "bard" && c.level >= 3 && (sub.includes("swords") || sub.includes("college of swords"))) {
      const id = "XGE__Bard__College of Swords__Fighting Style";
      const otherPicked = getPickedInOtherChoices(id);
      out.push({
        id,
        traitName: "Fighting Style",
        choose: 1,
        level: 3,
        effectLevel: 3,
        options: getStyleOptions("FS:B").filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
      });
    }
  }

  // Feat Fighting Initiate
  const hasFightingInitiate = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase() === "fighting initiate");

  if (hasFightingInitiate) {
    const id = "TCE__Feat__Fighting Initiate__Style";
    const otherPicked = getPickedInOtherChoices(id);
    out.push({
      id,
      traitName: "Fighting Initiate Style",
      choose: 1,
      level: 1,
      effectLevel: 1,
      options: getStyleOptions("FS:F").filter((o) => !otherPicked.has(o.name.toLowerCase().trim())),
    });
  }

  // Cantrip Sub-Choices
  if (hasFightingStyle(character, "Blessed Warrior")) {
    const clericCantrips = compendium.for(upperBooks).spells().filter(
      (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "cleric")
    );
    out.push({
      id: "TCE__Paladin__Blessed Warrior Cantrips",
      traitName: "Blessed Warrior Cantrips",
      choose: 2,
      level: 2,
      effectLevel: 2,
      options: formatCantripOptions(clericCantrips),
    });
  }

  if (hasFightingStyle(character, "Druidic Warrior")) {
    const druidCantrips = compendium.for(upperBooks).spells().filter(
      (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "druid")
    );
    out.push({
      id: "TCE__Ranger__Druidic Warrior Cantrips",
      traitName: "Druidic Warrior Cantrips",
      choose: 2,
      level: 2,
      effectLevel: 2,
      options: formatCantripOptions(druidCantrips),
    });
  }

  // Every row here records through the specialised fighting style pick. The origin matches
  // what that pick stores: College of Swords styles are subclass-granted, the rest are class.
  return out.map(
    (choice): AvailableRuleChoice => ({
      ...choice,
      origin: choice.id.includes("College of Swords") ? "subclass" : "class",
      pick: "fightingStyle",
    })
  );
}

/**
 * Records or updates a fighting style rule choice pick for a character.
 */
export function pickFightingStyleChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string,
  compendium: Compendium = currentCompendium()
): Character {
  const isSubclass = choice.id.includes("College of Swords");
  let updated = setRuleChoicePick(
    character,
    choice.id,
    choice.traitName,
    option,
    choice.options.map((o) => o.name),
    choice.choose,
    isSubclass ? "subclass" : "class"
  );

  // Synchronize Blessed Warrior cantrips
  if (choice.id === "TCE__Paladin__Blessed Warrior Cantrips") {
    const picked = updated.ruleChoices?.find((rc) => rc.id === choice.id)?.picked || [];
    const prevKnown = (updated.knownSpells || []).filter((k) => k.ownerKey !== "Paladin__TCE");
    const newSpells: KnownSpell[] = picked.map((cName) => {
      const sp = compendium.for().spells().find((s) => s.name.toLowerCase() === cName.toLowerCase());
      return {
        name: cName,
        source: sp?.source || "PHB",
        ownerKey: "Paladin__TCE",
        ability: "cha",
        className: "Paladin",
      };
    });
    updated = {
      ...updated,
      knownSpells: [...prevKnown, ...newSpells],
    };
  }

  // Synchronize Druidic Warrior cantrips
  if (choice.id === "TCE__Ranger__Druidic Warrior Cantrips") {
    const picked = updated.ruleChoices?.find((rc) => rc.id === choice.id)?.picked || [];
    const prevKnown = (updated.knownSpells || []).filter((k) => k.ownerKey !== "Ranger__TCE");
    const newSpells: KnownSpell[] = picked.map((cName) => {
      const sp = compendium.for().spells().find((s) => s.name.toLowerCase() === cName.toLowerCase());
      return {
        name: cName,
        source: sp?.source || "PHB",
        ownerKey: "Ranger__TCE",
        ability: "wis",
        className: "Ranger",
      };
    });
    updated = {
      ...updated,
      knownSpells: [...prevKnown, ...newSpells],
    };
  }

  // If Blessed Warrior is no longer chosen, cleanup sub-choice and cantrips
  if (!hasFightingStyle(updated, "Blessed Warrior")) {
    updated = {
      ...updated,
      ruleChoices: (updated.ruleChoices || []).filter((rc) => rc.id !== "TCE__Paladin__Blessed Warrior Cantrips"),
      knownSpells: (updated.knownSpells || []).filter((k) => k.ownerKey !== "Paladin__TCE"),
    };
  }

  // If Druidic Warrior is no longer chosen, cleanup sub-choice and cantrips
  if (!hasFightingStyle(updated, "Druidic Warrior")) {
    updated = {
      ...updated,
      ruleChoices: (updated.ruleChoices || []).filter((rc) => rc.id !== "TCE__Ranger__Druidic Warrior Cantrips"),
      knownSpells: (updated.knownSpells || []).filter((k) => k.ownerKey !== "Ranger__TCE"),
    };
  }

  // If Superior Technique is no longer chosen, cleanup sub-choice
  if (!hasFightingStyle(updated, "Superior Technique")) {
    updated = {
      ...updated,
      ruleChoices: (updated.ruleChoices || []).filter((rc) => rc.id !== "TCE__Fighter__Superior Technique__Maneuver"),
    };
  }

  return updated;
}

/**
 * Prunes invalid fighting style choices and cantrips when classes, levels, or feats change.
 */
export function pruneInvalidFightingStyles(character: Character): Character {
  const classes = character.classes || [];
  const fighter = classes.find((c) => c.className.toLowerCase() === "fighter");
  const paladin = classes.find((c) => c.className.toLowerCase() === "paladin");
  const ranger = classes.find((c) => c.className.toLowerCase() === "ranger");
  const bard = classes.find((c) => c.className.toLowerCase() === "bard");
  const subBard = bard ? getSubclassName(bard) : "";
  const subFighter = fighter ? getSubclassName(fighter) : "";

  const hasFightingInitiate = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase() === "fighting initiate");

  const validIds = new Set<string>();
  if (fighter && fighter.level >= 1) validIds.add("PHB__Fighter__Fighting Style");
  if (fighter && fighter.level >= 10 && subFighter.includes("champion")) {
    validIds.add("PHB__Fighter__Additional Fighting Style 10");
  }
  if (paladin && paladin.level >= 2) validIds.add("PHB__Paladin__Fighting Style");
  if (ranger && ranger.level >= 2) validIds.add("PHB__Ranger__Fighting Style");
  if (bard && bard.level >= 3 && (subBard.includes("swords") || subBard.includes("college of swords"))) {
    validIds.add("XGE__Bard__College of Swords__Fighting Style");
  }
  if (hasFightingInitiate) validIds.add("TCE__Feat__Fighting Initiate__Style");

  let nextChoices = (character.ruleChoices || []).filter((rc) => {
    if (rc.id.includes("Fighting Style") || rc.id.includes("Fighting Initiate")) {
      return validIds.has(rc.id);
    }
    return true;
  });

  let nextKnownSpells = character.knownSpells;

  // Paladin Blessed Warrior check
  const paladinHasBlessedWarrior = nextChoices.some(
    (rc) => rc.id === "PHB__Paladin__Fighting Style" && rc.picked.some((p) => p.toLowerCase() === "blessed warrior")
  );
  if (!paladinHasBlessedWarrior) {
    nextChoices = nextChoices.filter((rc) => rc.id !== "TCE__Paladin__Blessed Warrior Cantrips");
    nextKnownSpells = (nextKnownSpells || []).filter((k) => k.ownerKey !== "Paladin__TCE");
  }

  // Ranger Druidic Warrior check
  const rangerHasDruidicWarrior = nextChoices.some(
    (rc) => rc.id === "PHB__Ranger__Fighting Style" && rc.picked.some((p) => p.toLowerCase() === "druidic warrior")
  );
  if (!rangerHasDruidicWarrior) {
    nextChoices = nextChoices.filter((rc) => rc.id !== "TCE__Ranger__Druidic Warrior Cantrips");
    nextKnownSpells = (nextKnownSpells || []).filter((k) => k.ownerKey !== "Ranger__TCE");
  }

  const hasSuperiorTechnique = nextChoices.some(
    (rc) => (rc.id.includes("Fighting Style") || rc.id.includes("Fighting Initiate")) &&
      rc.picked.some((p) => p.toLowerCase() === "superior technique")
  );
  if (!hasSuperiorTechnique) {
    nextChoices = nextChoices.filter((rc) => rc.id !== "TCE__Fighter__Superior Technique__Maneuver");
  }

  const removed = (character.ruleChoices || []).filter((rc) => !nextChoices.includes(rc));

  return {
    ...character,
    ruleChoices: nextChoices,
    knownSpells: nextKnownSpells,
    ...(removed.length > 0
      ? {
          needsReview: Array.from(
            new Set([
              ...(character.needsReview || []),
              ...removed.map((rc) => `${rc.trait} removed: prerequisite no longer satisfied`),
            ])
          ),
        }
      : {}),
  };
}
