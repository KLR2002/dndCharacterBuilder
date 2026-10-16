import type { Character, KnownSpell, RitualBookEntry, RuleChoiceEntry } from "../../types/character.ts";
import type { OptionFeatureData, SpellData } from "../../types/dnd5e.ts";
import { currentCompendium, type Compendium } from "../../services/compendium.ts";
import { isSpellAvailableForClass } from "../spellcasting.ts";
import { type AvailableRuleChoice, formatCantripOptions } from "./types.ts";

/**
 * Invocations that grant at-will spells without expending spell slots.
 */
export const INVOCATION_AT_WILL_SPELLS: Record<string, string> = {
  "Armor of Shadows": "Mage Armor",
  "Ascendant Step": "Levitate",
  "Beast Speech": "Speak with Animals",
  "Chains of Carceri": "Hold Monster",
  "Eldritch Sight": "Detect Magic",
  "Fiendish Vigor": "False Life",
  "Mask of Many Faces": "Disguise Self",
  "Master of Myriad Forms": "Alter Self",
  "Misty Visions": "Silent Image",
  "Otherworldly Leap": "Jump",
  "Shroud of Shadow": "Invisibility",
  "Visions of Distant Realms": "Arcane Eye",
  "Whispers of the Grave": "Speak with Dead",
};

/**
 * Returns all at-will spells granted by chosen invocations on the character.
 */
export function getAtWillInvocationSpells(
  character: Character
): { invocationName: string; spellName: string }[] {
  const chosen = getChosenInvocations(character);
  const out: { invocationName: string; spellName: string }[] = [];
  for (const inv of chosen) {
    const spellName = INVOCATION_AT_WILL_SPELLS[inv];
    if (spellName) {
      out.push({ invocationName: inv, spellName });
    }
  }
  return out;
}

/**
 * Returns the character's chosen Pact Boon option, if any.
 */
export function getChosenPactBoon(character: Character): string | null {
  for (const rc of character.ruleChoices || []) {
    if (rc.id.includes("Pact Boon") || rc.trait.toLowerCase().includes("pact boon")) {
      if (rc.picked && rc.picked.length > 0) {
        return rc.picked[0];
      }
    }
  }
  return null;
}

/**
 * Returns available Pact Boon rule choices for a Warlock of level 3 or higher.
 */
export function warlockPactBoonChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  if (!warlock || warlock.level < 3) return [];

  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allOptions = compendium.for(upperBooks).optionsAndFeatures();
  const boonOptions = allOptions
    .filter(
      (o) =>
        (o.category && o.category.includes("Pact Boon")) ||
        (o.featureType && o.featureType.includes("PB"))
    )
    .map((o) => ({
      name: o.name,
      description: o.description || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const defaultOptions = [
    { name: "Pact of the Blade", description: "You can create a pact weapon in your empty hand." },
    { name: "Pact of the Chain", description: "You learn the find familiar spell and can cast it as a ritual." },
    { name: "Pact of the Tome", description: "Your patron gives you a grimoire called a Book of Shadows." },
    ...((!activeBooks || activeBooks.some((b) => b.toUpperCase() === "TCE"))
      ? [{ name: "Pact of the Talisman", description: "Your patron gives you an amulet that can aid the wearer." }]
      : []),
  ];

  const finalOptions = boonOptions.length > 0 ? boonOptions : defaultOptions;

  return [
    {
      id: "PHB__Warlock__Pact Boon",
      traitName: "Pact Boon",
      origin: "class",
      choose: 1,
      level: 3,
      effectLevel: 3,
      options: finalOptions,
    },
  ];
}

/**
 * Returns available Pact of the Tome cantrip choices for a Warlock of level 3 or higher
 * who has chosen Pact of the Tome.
 */
export function warlockTomeCantripChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  if (!warlock || warlock.level < 3) return [];

  const hasPactOfTheTome = (character.ruleChoices || []).some(
    (rc) => rc.id.includes("Pact Boon") && rc.picked?.includes("Pact of the Tome")
  );
  if (!hasPactOfTheTome) return [];

  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allCantrips = compendium.for(upperBooks).spells().filter((s) => s.level === 0);

  return [
    {
      id: "Warlock__Pact of the Tome__Cantrips",
      traitName: "Pact of the Tome Cantrips",
      origin: "class",
      choose: 3,
      level: 3,
      effectLevel: 3,
      options: formatCantripOptions(allCantrips),
    },
  ];
}

/**
 * Returns a Map of lowercase spell names to SpellData objects, optionally filtered by active sourcebooks.
 */
export function getSpellLookupMap(
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): Map<string, SpellData> {
  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allSpells = compendium.for(upperBooks).spells();
  const spellMap = new Map<string, SpellData>();
  for (const s of allSpells) {
    const key = s.name.toLowerCase().trim();
    if (!spellMap.has(key)) {
      spellMap.set(key, s);
    }
  }
  return spellMap;
}

/**
 * Returns the maximum spell level that can be inscribed into a Book of Ancient Secrets ritual book.
 * Half warlock level rounded up (minimum 1).
 */
export function getMaxRitualBookLevel(warlockLevel: number): number {
  return Math.max(1, Math.ceil(warlockLevel / 2));
}

/**
 * Checks whether a spell is eligible to be inscribed into a Book of Ancient Secrets ritual book.
 * Must have ritual: true, level >= 1, level <= getMaxRitualBookLevel(warlockLevel), and source in activeBooks (if provided).
 */
export function isSpellEligibleForRitualBook(
  spell: SpellData,
  warlockLevel: number,
  activeBooks?: string[]
): boolean {
  if (spell.ritual !== true) return false;
  if (spell.level < 1) return false;
  if (spell.level > getMaxRitualBookLevel(warlockLevel)) return false;
  if (activeBooks && activeBooks.length > 0) {
    const upperBooks = new Set(activeBooks.map((b) => b.toUpperCase()));
    if (!upperBooks.has(spell.source.toUpperCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Synchronizes Pact of the Tome cantrips into character.knownSpells (with ownerKey: "Warlock__Tome").
 * If the character is not eligible (level < 3, pact boon changed, or non-warlock),
 * purges Warlock__Pact of the Tome__Cantrips from ruleChoices and all Tome cantrips from knownSpells,
 * and adds a notice to character.needsReview.
 */
export function syncWarlockTomeCantrips(
  character: Character,
  compendium: Compendium = currentCompendium()
): Character {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const isEligible = Boolean(
    warlock &&
    warlock.level >= 3 &&
    (character.ruleChoices || []).some(
      (rc) => rc.id.includes("Pact Boon") && rc.picked?.includes("Pact of the Tome")
    )
  );

  if (!isEligible) {
    const hasTomeChoice = (character.ruleChoices || []).some(
      (rc) =>
        rc.id === "Warlock__Pact of the Tome__Cantrips" ||
        (rc.id.includes("Pact of the Tome") && rc.id.includes("Cantrip"))
    );
    const hasTomeSpells = (character.knownSpells || []).some(
      (k) => k.ownerKey === "Warlock__Tome"
    );

    if (!hasTomeChoice && !hasTomeSpells) {
      return character;
    }

    const needsReviewSet = new Set(character.needsReview || []);
    needsReviewSet.add(
      "Pact of the Tome Cantrips removed: character no longer possesses Pact of the Tome"
    );

    return {
      ...character,
      ruleChoices: (character.ruleChoices || []).filter(
        (rc) =>
          rc.id !== "Warlock__Pact of the Tome__Cantrips" &&
          !(rc.id.includes("Pact of the Tome") && rc.id.includes("Cantrip"))
      ),
      knownSpells: (character.knownSpells || []).filter(
        (k) => k.ownerKey !== "Warlock__Tome"
      ),
      needsReview: Array.from(needsReviewSet),
    };
  }

  const tomeChoice = (character.ruleChoices || []).find(
    (rc) =>
      rc.id === "Warlock__Pact of the Tome__Cantrips" ||
      (rc.id.includes("Pact of the Tome") && rc.id.includes("Cantrip"))
  );
  const pickedCantrips = tomeChoice?.picked || [];

  const otherKnownSpells = (character.knownSpells || []).filter(
    (k) => k.ownerKey !== "Warlock__Tome"
  );

  const spellMap = getSpellLookupMap(undefined, compendium);

  const syncedTomeSpells: KnownSpell[] = pickedCantrips.map((name) => {
    const s = spellMap.get(name.toLowerCase().trim());
    return {
      name,
      source: s?.source || "PHB",
      ownerKey: "Warlock__Tome",
      ability: "cha",
      className: "Warlock",
    };
  });

  return {
    ...character,
    knownSpells: [...otherKnownSpells, ...syncedTomeSpells],
  };
}

/**
 * Returns available Book of Ancient Secrets starting ritual choices for a Warlock
 * who has chosen the Book of Ancient Secrets invocation.
 */
export function warlockAncientSecretsStartingRituals(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  if (!warlock || warlock.level < 2) return [];

  if (!hasInvocation(character, "Book of Ancient Secrets")) return [];

  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const all1stRituals = compendium.for(upperBooks).spells().filter(
    (s) => s.level === 1 && s.ritual === true
  );

  return [
    {
      id: "Warlock__Book of Ancient Secrets__Starting Rituals",
      traitName: "Book of Ancient Secrets: Starting Rituals",
      origin: "class",
      choose: 2,
      level: 2,
      effectLevel: 2,
      options: all1stRituals
        .map((s) => ({
          name: s.name,
          description: `1st-level ${s.school || ""} ritual (${s.source}) - ${s.classes?.join(", ") || "General"}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  ];
}

/**
 * Synchronizes Book of Ancient Secrets starting rituals into character.ritualBook (with isStarting: true).
 * If the character is not eligible (level < 2, invocation lost, non-warlock, or pact boon changed away from Tome),
 * purges Warlock__Book of Ancient Secrets__Starting Rituals from ruleChoices, cleanses all ritualBook entries,
 * and adds a notice to character.needsReview.
 */
export function syncAncientSecretsRituals(
  character: Character,
  compendium: Compendium = currentCompendium()
): Character {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const hasPactOfTheTome = (character.ruleChoices || []).some(
    (rc) => rc.id.includes("Pact Boon") && rc.picked?.includes("Pact of the Tome")
  );
  const isEligible = Boolean(
    warlock &&
    warlock.level >= 2 &&
    hasPactOfTheTome &&
    hasInvocation(character, "Book of Ancient Secrets")
  );

  if (!isEligible) {
    const hasRitualChoice = (character.ruleChoices || []).some(
      (rc) =>
        rc.id === "Warlock__Book of Ancient Secrets__Starting Rituals" ||
        (rc.id.includes("Book of Ancient Secrets") && rc.id.includes("Rituals"))
    );
    const hasRituals = Boolean(character.ritualBook && character.ritualBook.length > 0);

    if (!hasRitualChoice && !hasRituals) {
      return character;
    }

    const needsReviewSet = new Set(character.needsReview || []);
    needsReviewSet.add(
      "Book of Ancient Secrets rituals removed: character no longer possesses Book of Ancient Secrets"
    );

    return {
      ...character,
      ruleChoices: (character.ruleChoices || []).filter(
        (rc) =>
          rc.id !== "Warlock__Book of Ancient Secrets__Starting Rituals" &&
          !(rc.id.includes("Book of Ancient Secrets") && rc.id.includes("Rituals"))
      ),
      ritualBook: undefined,
      needsReview: Array.from(needsReviewSet),
    };
  }

  const ritualChoice = (character.ruleChoices || []).find(
    (rc) =>
      rc.id === "Warlock__Book of Ancient Secrets__Starting Rituals" ||
      (rc.id.includes("Book of Ancient Secrets") && rc.id.includes("Rituals"))
  );
  const pickedRituals = ritualChoice?.picked || [];

  const spellMap = getSpellLookupMap(undefined, compendium);

  const syncedStartingRituals: RitualBookEntry[] = pickedRituals.map((name) => {
    const s = spellMap.get(name.toLowerCase().trim());
    return {
      name,
      source: s?.source || "PHB",
      level: 1,
      isStarting: true,
    };
  });

  const pickedNamesLower = new Set(pickedRituals.map((p) => p.toLowerCase().trim()));
  const existingInscribed = (character.ritualBook || []).filter(
    (r) => !r.isStarting && !pickedNamesLower.has(r.name.toLowerCase().trim())
  );

  const combined = [...syncedStartingRituals, ...existingInscribed];

  return {
    ...character,
    ritualBook: combined.length > 0 ? combined : undefined,
  };
}

export const MYSTIC_ARCANUM_MILESTONES = [
  { level: 11, spellLevel: 6, traitName: "Mystic Arcanum (6th Level)" },
  { level: 13, spellLevel: 7, traitName: "Mystic Arcanum (7th Level)" },
  { level: 15, spellLevel: 8, traitName: "Mystic Arcanum (8th Level)" },
  { level: 17, spellLevel: 9, traitName: "Mystic Arcanum (9th Level)" },
] as const;

export function isMysticArcanumChoiceId(id: string): boolean {
  return id.startsWith("Warlock__Mystic Arcanum") || id.includes("Mystic Arcanum");
}

/**
 * Returns available Mystic Arcanum choices for a Warlock at milestones 11, 13, 15, and 17.
 * Options include all Warlock spells of that exact level from active sourcebooks.
 */
export function warlockMysticArcanumChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  if (!warlock || warlock.level < 11) return [];

  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allSpells = compendium.for(upperBooks).spells();
  const subclassName = warlock.subclassName || warlock.subclass;

  const out: AvailableRuleChoice[] = [];

  for (const m of MYSTIC_ARCANUM_MILESTONES) {
    if (warlock.level >= m.level) {
      const eligible = allSpells
        .filter((s) => s.level === m.spellLevel)
        .filter((s) =>
          isSpellAvailableForClass(s, "Warlock", upperBooks, {
            subclassName,
            classLevel: warlock.level,
            ruleChoices: character.ruleChoices,
          })
        )
        .map((s) => ({
          name: s.name,
          description: `${s.level}th-level ${s.school || ""} (${s.source}) - ${s.castingTime || "1 action"}, ${s.range || "Self"}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      out.push({
        id: `Warlock__Mystic Arcanum ${m.level}`,
        traitName: m.traitName,
        origin: "class",
        choose: 1,
        level: m.level,
        effectLevel: m.level,
        options: eligible,
      });
    }
  }

  return out;
}

export interface MysticArcanumTierInfo {
  level: number;
  spellLevel: number;
  choiceId: string;
  traitName: string;
  chosenSpellName?: string;
  spellData?: SpellData;
  isSpent: boolean;
}

/**
 * Returns information about all unlocked Mystic Arcanum tiers on the character.
 */
export function getMysticArcanumTiers(
  character: Character,
  compendium: Compendium = currentCompendium()
): MysticArcanumTierInfo[] {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const warlockLevel = warlock ? warlock.level : 0;
  if (warlockLevel < 11) return [];

  const ruleChoices = character.ruleChoices || [];
  const spentMap = character.mysticArcanumSpent || {};

  return MYSTIC_ARCANUM_MILESTONES
    .filter((m) => warlockLevel >= m.level)
    .map((m) => {
      const choiceId = `Warlock__Mystic Arcanum ${m.level}`;
      const rc = ruleChoices.find((r) => r.id === choiceId);
      const chosenSpellName = rc?.picked?.[0];
      const spellData = chosenSpellName ? compendium.findSpell(chosenSpellName) : undefined;
      const isSpent = Boolean(spentMap[m.spellLevel]);

      return {
        level: m.level,
        spellLevel: m.spellLevel,
        choiceId,
        traitName: m.traitName,
        chosenSpellName,
        spellData,
        isSpent,
      };
    });
}

/**
 * Prunes invalid Mystic Arcanum choices and expenditures when Warlock de-levels.
 */
export function pruneInvalidMysticArcanum(character: Character): Character {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const warlockLevel = warlock ? warlock.level : 0;

  const validMilestoneIds = new Set(
    MYSTIC_ARCANUM_MILESTONES
      .filter((m) => warlockLevel >= m.level)
      .map((m) => `Warlock__Mystic Arcanum ${m.level}`)
  );

  const nextRuleChoices: RuleChoiceEntry[] = [];
  const removedArcanums: string[] = [];

  for (const rc of character.ruleChoices || []) {
    if (isMysticArcanumChoiceId(rc.id)) {
      if (validMilestoneIds.has(rc.id)) {
        nextRuleChoices.push(rc);
      } else {
        for (const p of rc.picked || []) {
          removedArcanums.push(p);
        }
      }
    } else {
      nextRuleChoices.push(rc);
    }
  }

  const validSpellLevels = new Set<number>(
    MYSTIC_ARCANUM_MILESTONES
      .filter((m) => warlockLevel >= m.level)
      .map((m) => m.spellLevel)
  );

  let nextSpent: Record<number, boolean> | undefined = undefined;
  if (character.mysticArcanumSpent) {
    nextSpent = {};
    for (const [lvlStr, spent] of Object.entries(character.mysticArcanumSpent)) {
      const lvl = parseInt(lvlStr, 10);
      if (validSpellLevels.has(lvl)) {
        nextSpent[lvl] = spent;
      }
    }
    if (Object.keys(nextSpent).length === 0) {
      nextSpent = undefined;
    }
  }

  const needsReviewSet = new Set(character.needsReview || []);
  for (const removed of removedArcanums) {
    needsReviewSet.add(`${removed} removed: Warlock level no longer satisfies Mystic Arcanum prerequisite`);
  }

  return {
    ...character,
    ruleChoices: nextRuleChoices,
    mysticArcanumSpent: nextSpent,
    needsReview: needsReviewSet.size > 0 ? Array.from(needsReviewSet) : undefined,
  };
}

/**
 * Checks if a rule choice ID belongs to an invocation choice.
 */
export function isInvocationChoiceId(id: string): boolean {
  return (
    id.includes("Warlock__Invocations") ||
    id.includes("Eldritch Adept__Invocation") ||
    id.toLowerCase().includes("invocation")
  );
}

/**
 * Returns all chosen invocations across any invocation rule choices on the character.
 */
export function getChosenInvocations(character: Character): string[] {
  const invocations: string[] = [];
  const seen = new Set<string>();
  for (const rc of character.ruleChoices || []) {
    if (isInvocationChoiceId(rc.id)) {
      for (const p of rc.picked || []) {
        const norm = p.trim();
        if (norm && !seen.has(norm.toLowerCase())) {
          seen.add(norm.toLowerCase());
          invocations.push(norm);
        }
      }
    }
  }
  return invocations;
}

/**
 * Checks if a character has a specific invocation chosen.
 */
export function hasInvocation(character: Character, invocationName: string): boolean {
  const norm = invocationName.toLowerCase().trim();
  return getChosenInvocations(character).some((inv) => inv.toLowerCase().trim() === norm);
}

/**
 * Validates whether a character meets prerequisites for a given Eldritch Invocation.
 */
export function isInvocationEligible(
  invocation: { name: string; prerequisite?: string | null; [key: string]: any },
  character: Character,
  isEldritchAdept?: boolean
): boolean {
  const prereq = invocation.prerequisite?.trim();
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const warlockLevel = warlock ? warlock.level : 0;

  const hasEldritchAdeptFeat =
    isEldritchAdept ||
    [...(character.asiSelections || []), ...(character.originFeats || [])].some(
      (s) => s.type === "feat" && s.featName?.toLowerCase().trim() === "eldritch adept"
    );

  // If non-warlock: only eligible if they have Eldritch Adept AND invocation has no prerequisites.
  if (warlockLevel === 0) {
    if (!hasEldritchAdeptFeat) return false;
    return !prereq;
  }

  // Warlocks: if no prerequisite, always eligible
  if (!prereq) {
    return true;
  }

  const prereqLower = prereq.toLowerCase();

  // 1. Level Gate
  const levelMatch = prereqLower.match(/(\d+)(?:st|nd|rd|th)-level/);
  if (levelMatch) {
    const reqLevel = parseInt(levelMatch[1], 10);
    if (warlockLevel < reqLevel) {
      return false;
    }
  }

  // 2. Pact Boon Gate
  const chosenBoon = getChosenPactBoon(character)?.toLowerCase().trim();
  if (prereqLower.includes("pact of the blade") && chosenBoon !== "pact of the blade") {
    return false;
  }
  if (prereqLower.includes("pact of the tome") && chosenBoon !== "pact of the tome") {
    return false;
  }
  if (prereqLower.includes("pact of the chain") && chosenBoon !== "pact of the chain") {
    return false;
  }
  if (prereqLower.includes("pact of the talisman") && chosenBoon !== "pact of the talisman") {
    return false;
  }

  // 3. Spell Gate
  if (prereqLower.includes("eldritch blast")) {
    const hasEb = (character.knownSpells || []).some(
      (s) => s.name.toLowerCase().trim() === "eldritch blast"
    );
    if (!hasEb) return false;
  }

  if (prereqLower.includes("hex/curse")) {
    const hasHexOrCurse =
      (character.knownSpells || []).some((s) => {
        const n = s.name.toLowerCase().trim();
        return n === "hex" || n === "bestow curse";
      }) ||
      classes.some(
        (c) =>
          c.className.toLowerCase() === "warlock" &&
          (c.subclassName || c.subclass || "").toLowerCase().includes("hexblade")
      );
    if (!hasHexOrCurse) return false;
  }

  return true;
}

function formatInvocationPrerequisite(rawPrereq: string): string {
  return rawPrereq
    .replace(/(\d+)(?:st|nd|rd|th)-level\s+Warlock/gi, "$1th level")
    .replace(/1th level/g, "1st level")
    .replace(/2th level/g, "2nd level")
    .replace(/3th level/g, "3rd level")
    .replace(/;\s*/g, ", ")
    .replace(/cantrip\/spell/g, "cantrip");
}

function formatInvocationDescription(opt: OptionFeatureData): string {
  const desc = opt.description || "";
  if (!opt.prerequisite) return desc;
  const prereqStr = formatInvocationPrerequisite(opt.prerequisite);
  return `Prerequisite: ${prereqStr}. ${desc}`;
}

/**
 * Returns available Eldritch Invocation choices for character with prerequisite gating and deduplication.
 */
export function warlockInvocationChoices(
  character: Character,
  activeBooks?: string[],
  compendium: Compendium = currentCompendium()
): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  const upperBooks = activeBooks ? activeBooks.map((b) => b.toUpperCase()) : undefined;
  const allOptions = compendium.for(upperBooks).optionsAndFeatures();

  const invocationOptions: OptionFeatureData[] = [];
  const seenInvocationNames = new Set<string>();
  for (const o of allOptions) {
    if (
      (o.category && o.category.includes("Invocation")) ||
      (o.featureType && o.featureType.includes("EI"))
    ) {
      if (!seenInvocationNames.has(o.name)) {
        seenInvocationNames.add(o.name);
        invocationOptions.push(o);
      }
    }
  }
  invocationOptions.sort((a, b) => a.name.localeCompare(b.name));

  const getPickedInOtherInvocationChoices = (currentChoiceId: string): Set<string> => {
    const picked = new Set<string>();
    for (const rc of character.ruleChoices || []) {
      if (rc.id !== currentChoiceId && isInvocationChoiceId(rc.id)) {
        for (const p of rc.picked || []) {
          picked.add(p.toLowerCase().trim());
        }
      }
    }
    return picked;
  };

  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const warlockLevel = warlock ? warlock.level : 0;

  const milestones: { level: number; choose: number; traitName: string }[] = [
    { level: 2, choose: 2, traitName: "Eldritch Invocations (2nd Level)" },
    { level: 5, choose: 1, traitName: "Eldritch Invocations (5th Level)" },
    { level: 7, choose: 1, traitName: "Eldritch Invocations (7th Level)" },
    { level: 9, choose: 1, traitName: "Eldritch Invocations (9th Level)" },
    { level: 12, choose: 1, traitName: "Eldritch Invocations (12th Level)" },
    { level: 15, choose: 1, traitName: "Eldritch Invocations (15th Level)" },
    { level: 18, choose: 1, traitName: "Eldritch Invocations (18th Level)" },
  ];

  if (warlockLevel >= 2) {
    for (const m of milestones) {
      if (warlockLevel >= m.level) {
        const id = `PHB__Warlock__Invocations ${m.level}`;
        const otherPicked = getPickedInOtherInvocationChoices(id);
        const eligible = invocationOptions
          .filter((opt) => !otherPicked.has(opt.name.toLowerCase().trim()))
          .filter((opt) => isInvocationEligible(opt, character, false))
          .map((opt) => ({
            name: opt.name,
            description: formatInvocationDescription(opt),
          }));

        out.push({
          id,
          traitName: m.traitName,
          origin: "class",
          choose: m.choose,
          level: m.level,
          effectLevel: m.level,
          options: eligible,
        });
      }
    }
  }

  const hasEldritchAdept = [
    ...(character.asiSelections || []),
    ...(character.originFeats || []),
  ].some((s) => s.type === "feat" && s.featName?.toLowerCase().trim() === "eldritch adept");

  if (hasEldritchAdept) {
    const id = "TCE__Feat__Eldritch Adept__Invocation";
    const otherPicked = getPickedInOtherInvocationChoices(id);
    const eligible = invocationOptions
      .filter((opt) => !otherPicked.has(opt.name.toLowerCase().trim()))
      .filter((opt) => isInvocationEligible(opt, character, true))
      .map((opt) => ({
        name: opt.name,
        description: formatInvocationDescription(opt),
      }));

    out.push({
      id,
      traitName: "Eldritch Adept Invocation",
      origin: "class",
      choose: 1,
      level: 1,
      effectLevel: 1,
      options: eligible,
    });
  }

  return out;
}

/**
 * Prunes invalid invocations and Pact Boon when levels, pact boons, spells, or feats change.
 * Adds notices to character.needsReview for every choice pruned.
 */
export function pruneInvalidInvocations(
  character: Character,
  compendium: Compendium = currentCompendium()
): Character {
  const classes = character.classes || [];
  const warlock = classes.find((c) => c.className.toLowerCase() === "warlock");
  const warlockLevel = warlock ? warlock.level : 0;

  const validChoices = warlockInvocationChoices(character, undefined, compendium);
  const validChoiceMap = new Map<string, AvailableRuleChoice>();
  for (const c of validChoices) {
    validChoiceMap.set(c.id, c);
  }

  const allOptions = compendium.for().optionsAndFeatures();
  const optionMap = new Map<string, OptionFeatureData>();
  for (const o of allOptions) {
    if (
      (o.category && o.category.includes("Invocation")) ||
      (o.featureType && o.featureType.includes("EI"))
    ) {
      optionMap.set(o.name.toLowerCase().trim(), o);
    }
  }

  const seenPicks = new Set<string>();
  const nextRuleChoices: RuleChoiceEntry[] = [];
  const removedChoices: string[] = [];

  for (const rc of character.ruleChoices || []) {
    // If Pact Boon choice but Warlock level < 3, remove it
    if (rc.id.includes("Pact Boon") || rc.trait.toLowerCase().includes("pact boon")) {
      if (warlockLevel >= 3) {
        nextRuleChoices.push(rc);
      } else {
        removedChoices.push("Pact Boon");
      }
      continue;
    }

    if (isInvocationChoiceId(rc.id)) {
      const validChoice = validChoiceMap.get(rc.id);
      if (!validChoice) {
        // Milestone or feat choice is no longer valid
        for (const p of rc.picked || []) {
          removedChoices.push(p);
        }
        continue;
      }

      const isFeat = rc.id.includes("Eldritch Adept");
      const keptPicks: string[] = [];

      for (const p of rc.picked || []) {
        const norm = p.toLowerCase().trim();
        const optData = optionMap.get(norm);
        const isEligible = optData
          ? isInvocationEligible(optData, character, isFeat)
          : false;

        if (!isEligible) {
          removedChoices.push(p);
        } else if (!seenPicks.has(norm)) {
          seenPicks.add(norm);
          keptPicks.push(p);
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

  const needsReviewSet = new Set(character.needsReview || []);
  for (const removed of removedChoices) {
    needsReviewSet.add(`${removed} removed: prerequisite no longer satisfied`);
  }

  return {
    ...character,
    ruleChoices: nextRuleChoices,
    needsReview: needsReviewSet.size > 0 ? Array.from(needsReviewSet) : undefined,
  };
}
