import type { CharacterClass, Character, KnownSpell, RuleChoiceEntry } from "../../types/character.ts";
import type { ClassData } from "../../types/dnd5e.ts";
import { SRD_SOURCE } from "../../constants/books.ts";
import { currentCompendium, type Compendium } from "../../services/compendium.ts";
import { heldClass } from "../classData.ts";
import { heldSourceOf } from "../raceLookup.ts";
import {
  type AvailableRuleChoice,
  type ChoiceOwner,
  formatCantripOptions,
  getSubclassName,
  setRuleChoicePick,
} from "./types.ts";

/** The Fighting Initiate feat choice. Its id is frozen. Callers look it up by this exact id. */
export const FIGHTING_INITIATE_CHOICE_ID = "TCE__Feat__Fighting Initiate__Style";

const STYLE_TITLE = "Fighting Style";
const CHAMPION_STYLE_TITLE = "Additional Fighting Style 10";
const COLLEGE_OF_SWORDS_STYLE_ID = "XGE__Bard__College of Swords__Fighting Style";

/** A class-owned fighting style choice: the class and the title its id carries after the source. */
interface ClassStyle {
  className: string;
  title: string;
  owner: ChoiceOwner;
}

/**
 * The class-owned fighting style choices. Each id is `<source>__<class>__<title>`, and its source is the class's own (see
 * classSourceOf), so a class from any book offers the choice under that book.
 */
const CLASS_STYLES: readonly ClassStyle[] = [
  { className: "Fighter", title: STYLE_TITLE, owner: { className: "Fighter" } },
  { className: "Fighter", title: CHAMPION_STYLE_TITLE, owner: { className: "Fighter", subclass: "Champion" } },
  { className: "Paladin", title: STYLE_TITLE, owner: { className: "Paladin" } },
  { className: "Ranger", title: STYLE_TITLE, owner: { className: "Ranger" } },
];

/** The fighting style choices whose id keeps its own fixed source: a subclass's book, or the book of a cantrip's options. */
const FIXED_STYLE_OWNERS = new Map<string, ChoiceOwner>([
  [COLLEGE_OF_SWORDS_STYLE_ID, { className: "Bard", subclass: "College of Swords" }],
  ["TCE__Paladin__Blessed Warrior Cantrips", { className: "Paladin" }],
  ["TCE__Ranger__Druidic Warrior Cantrips", { className: "Ranger" }],
]);

/**
 * The source a class's fighting style ids carry: the source the class was saved under, else its held record's (heldSourceOf). A
 * class saved under a source keeps its ids on every catalog that holds it.
 */
function classSourceOf(entry: CharacterClass, classes: readonly ClassData[]): string {
  return heldSourceOf(entry.source, heldClass(entry, classes) ?? { source: SRD_SOURCE });
}

/** The id of a class's style choice under the class's source: the source, the class name and the choice's title. */
function heldStyleId(entry: CharacterClass, className: string, title: string, classes: readonly ClassData[]): string {
  return `${classSourceOf(entry, classes)}__${className}__${title}`;
}

/**
 * The class-owned style a choice id names, whatever its source. Undefined for a fixed-source id and for an id no class owns.
 */
function classStyleOf(id: string): ClassStyle | undefined {
  if (FIXED_STYLE_OWNERS.has(id)) return undefined;
  const [, className, ...title] = id.split("__");
  return CLASS_STYLES.find((style) => style.className === className && style.title === title.join("__"));
}

/** The owner of a fighting style choice id, or undefined when this module does not issue the id. */
export function fightingStyleOwnerOf(id: string): ChoiceOwner | undefined {
  return FIXED_STYLE_OWNERS.get(id) ?? classStyleOf(id)?.owner;
}

/**
 * Moves a fighting style pick saved under an id with another source to the id its class now gives. A pick moves only
 * when no entry holds a pick under the new id. An empty entry already under the new id is filled by the pick, as
 * moveLegacyRacePickIds fills one. Otherwise the entry stays under its old id, and the pruning pass releases it.
 */
export function moveLegacyFightingStyleIds(character: Character, classes: readonly ClassData[]): Character {
  const entries = character.ruleChoices ?? [];
  const pickedIds = new Set(entries.filter((entry) => entry.picked.length > 0).map((entry) => entry.id));
  const emptyIds = new Set(entries.filter((entry) => entry.picked.length === 0).map((entry) => entry.id));
  // The first legacy entry that moves onto each new id claims it.
  const targetOf = new Map<RuleChoiceEntry, string>();
  const claimantOf = new Map<string, RuleChoiceEntry>();
  for (const entry of entries) {
    const target = currentStyleIdOf(character, classes, entry.id);
    if (!target || target === entry.id || pickedIds.has(target) || claimantOf.has(target)) continue;
    claimantOf.set(target, entry);
    targetOf.set(entry, target);
  }
  if (targetOf.size === 0) return character;

  const ruleChoices: RuleChoiceEntry[] = [];
  for (const entry of entries) {
    const target = targetOf.get(entry);
    if (target !== undefined) {
      // A claimant whose new id already has an empty entry takes that entry's place when the entry is reached.
      if (!emptyIds.has(target)) ruleChoices.push({ ...entry, id: target });
      continue;
    }
    const claimant = entry.picked.length === 0 ? claimantOf.get(entry.id) : undefined;
    ruleChoices.push(claimant ? { ...claimant, id: entry.id } : entry);
  }
  return { ...character, ruleChoices };
}

/** The id a class-owned style id takes under the character's class, or undefined when the id is not class-owned or the class is not held. */
function currentStyleIdOf(character: Character, classes: readonly ClassData[], id: string): string | undefined {
  const style = classStyleOf(id);
  const entry = style ? (character.classes ?? []).find((candidate) => candidate.className === style.className) : undefined;
  return style && entry ? heldStyleId(entry, style.className, style.title, classes) : undefined;
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
  // A held class resolves whatever the active books, so its record's source is read from the unscoped listing.
  const classes = compendium.for().classes();

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
      const id = heldStyleId(c, "Fighter", STYLE_TITLE, classes);
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
        const champId = heldStyleId(c, "Fighter", CHAMPION_STYLE_TITLE, classes);
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
      const id = heldStyleId(c, "Paladin", STYLE_TITLE, classes);
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
      const id = heldStyleId(c, "Ranger", STYLE_TITLE, classes);
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
      const id = COLLEGE_OF_SWORDS_STYLE_ID;
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
    const id = FIGHTING_INITIATE_CHOICE_ID;
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
export function pruneInvalidFightingStyles(character: Character, catalog: readonly ClassData[]): Character {
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
  if (fighter && fighter.level >= 1) validIds.add(heldStyleId(fighter, "Fighter", STYLE_TITLE, catalog));
  if (fighter && fighter.level >= 10 && subFighter.includes("champion")) {
    validIds.add(heldStyleId(fighter, "Fighter", CHAMPION_STYLE_TITLE, catalog));
  }
  if (paladin && paladin.level >= 2) validIds.add(heldStyleId(paladin, "Paladin", STYLE_TITLE, catalog));
  if (ranger && ranger.level >= 2) validIds.add(heldStyleId(ranger, "Ranger", STYLE_TITLE, catalog));
  if (bard && bard.level >= 3 && (subBard.includes("swords") || subBard.includes("college of swords"))) {
    validIds.add(COLLEGE_OF_SWORDS_STYLE_ID);
  }
  if (hasFightingInitiate) validIds.add(FIGHTING_INITIATE_CHOICE_ID);

  let nextChoices = (character.ruleChoices || []).filter((rc) => {
    if (rc.id.includes("Fighting Style") || rc.id.includes("Fighting Initiate")) {
      return validIds.has(rc.id);
    }
    return true;
  });

  let nextKnownSpells = character.knownSpells;

  // Paladin Blessed Warrior check
  const paladinHasBlessedWarrior = nextChoices.some(
    (rc) => classStyleOf(rc.id)?.className === "Paladin" && rc.picked.some((p) => p.toLowerCase() === "blessed warrior")
  );
  if (!paladinHasBlessedWarrior) {
    nextChoices = nextChoices.filter((rc) => rc.id !== "TCE__Paladin__Blessed Warrior Cantrips");
    nextKnownSpells = (nextKnownSpells || []).filter((k) => k.ownerKey !== "Paladin__TCE");
  }

  // Ranger Druidic Warrior check
  const rangerHasDruidicWarrior = nextChoices.some(
    (rc) => classStyleOf(rc.id)?.className === "Ranger" && rc.picked.some((p) => p.toLowerCase() === "druidic warrior")
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
