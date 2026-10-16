import type { Character, RuleChoiceEntry } from "../../types/character.ts";
import { type AvailableRuleChoice, type ChoiceOwner, setRuleChoicePick } from "./types.ts";

export interface ArtificerInfusionDef {
  name: string;
  level: number;
  description: string;
}

export const ALL_ARTIFICER_INFUSIONS: ArtificerInfusionDef[] = [
  // 2nd level standard
  {
    name: "Armor of Magical Strength",
    level: 2,
    description: "A suit of armor gives bonus to Strength checks equal to Intelligence modifier, and can prevent being knocked prone.",
  },
  {
    name: "Enhanced Arcane Focus",
    level: 2,
    description: "A rod, staff, or wand grants a +1 bonus to spell attack rolls (+2 at 10th level) and ignores half cover.",
  },
  {
    name: "Enhanced Defense",
    level: 2,
    description: "A suit of armor or a shield gains a +1 bonus to AC (+2 at 10th level).",
  },
  {
    name: "Enhanced Weapon",
    level: 2,
    description: "A simple or martial weapon gains a +1 bonus to attack and damage rolls (+2 at 10th level).",
  },
  {
    name: "Homunculus Servant",
    level: 2,
    description: "A special mechanical servant that acts on your turn and can deliver touch spells.",
  },
  {
    name: "Mind Sharpener",
    level: 2,
    description: "A suit of armor or robes lets the wearer succeed on a failed Constitution saving throw to maintain concentration.",
  },
  {
    name: "Repeating Shot",
    level: 2,
    description: "A simple or martial weapon with ammunition property gains a +1 bonus to attack and damage rolls, produces its own ammo, and ignores loading property.",
  },
  {
    name: "Returning Weapon",
    level: 2,
    description: "A simple or martial weapon with the thrown property gains a +1 bonus to attack and damage rolls, and returns immediately after thrown.",
  },

  // 6th level standard
  {
    name: "Boots of the Winding Path",
    level: 6,
    description: "The wearer can teleport up to 15 feet as a bonus action to an unoccupied space previously occupied this turn.",
  },
  {
    name: "Radiant Weapon",
    level: 6,
    description: "A weapon gains a +1 bonus to attack and damage rolls, sheds light, and can blind an attacker as a reaction.",
  },
  {
    name: "Repulsion Shield",
    level: 6,
    description: "A shield gains a +1 bonus to AC and can push an attacker up to 15 ft away as a reaction.",
  },
  {
    name: "Resistant Armor",
    level: 6,
    description: "A suit of armor grants resistance to one damage type (chosen when infused).",
  },
  {
    name: "Spell-Refueling Ring",
    level: 6,
    description: "The wearer can recover one expended spell slot of 3rd level or lower as an action once per long rest.",
  },

  // 10th level standard
  {
    name: "Helm of Awareness",
    level: 10,
    description: "A helmet grants advantage on initiative rolls, and the wearer can't be surprised while conscious.",
  },

  // 14th level standard
  {
    name: "Arcane Propulsion Armor",
    level: 14,
    description: "Armor gives +5 ft walking speed, gauntlet strikes dealing 1d8 force damage (can be thrown 20/60 ft), and wearer cannot have armor removed against will.",
  },

  // 2nd level replicate magic item
  {
    name: "Replicate Magic Item: Alchemy Jug",
    level: 2,
    description: "Replicates an Alchemy Jug magic item.",
  },
  {
    name: "Replicate Magic Item: Bag of Holding",
    level: 2,
    description: "Replicates a Bag of Holding magic item.",
  },
  {
    name: "Replicate Magic Item: Cap of Water Breathing",
    level: 2,
    description: "Replicates a Cap of Water Breathing magic item.",
  },
  {
    name: "Replicate Magic Item: Goggles of Night",
    level: 2,
    description: "Replicates a Goggles of Night magic item.",
  },
  {
    name: "Replicate Magic Item: Rope of Climbing",
    level: 2,
    description: "Replicates a Rope of Climbing magic item.",
  },
  {
    name: "Replicate Magic Item: Sending Stones",
    level: 2,
    description: "Replicates a pair of Sending Stones magic item.",
  },
  {
    name: "Replicate Magic Item: Wand of Magic Detection",
    level: 2,
    description: "Replicates a Wand of Magic Detection magic item.",
  },
  {
    name: "Replicate Magic Item: Wand of Secrets",
    level: 2,
    description: "Replicates a Wand of Secrets magic item.",
  },

  // 6th level replicate magic item
  {
    name: "Replicate Magic Item: Boots of Elvenkind",
    level: 6,
    description: "Replicates Boots of Elvenkind magic item.",
  },
  {
    name: "Replicate Magic Item: Cloak of Elvenkind",
    level: 6,
    description: "Replicates a Cloak of Elvenkind magic item.",
  },
  {
    name: "Replicate Magic Item: Cloak of the Manta Ray",
    level: 6,
    description: "Replicates a Cloak of the Manta Ray magic item.",
  },
  {
    name: "Replicate Magic Item: Eyes of Charming",
    level: 6,
    description: "Replicates Eyes of Charming magic item.",
  },
  {
    name: "Replicate Magic Item: Gloves of Thievery",
    level: 6,
    description: "Replicates Gloves of Thievery magic item.",
  },
  {
    name: "Replicate Magic Item: Lantern of Revealing",
    level: 6,
    description: "Replicates a Lantern of Revealing magic item.",
  },
  {
    name: "Replicate Magic Item: Pipes of Haunting",
    level: 6,
    description: "Replicates Pipes of Haunting magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of Water Walking",
    level: 6,
    description: "Replicates a Ring of Water Walking magic item.",
  },

  // 10th level replicate magic item
  {
    name: "Replicate Magic Item: Boots of Striding and Springing",
    level: 10,
    description: "Replicates Boots of Striding and Springing magic item.",
  },
  {
    name: "Replicate Magic Item: Boots of the Winterlands",
    level: 10,
    description: "Replicates Boots of the Winterlands magic item.",
  },
  {
    name: "Replicate Magic Item: Bracers of Archery",
    level: 10,
    description: "Replicates Bracers of Archery magic item.",
  },
  {
    name: "Replicate Magic Item: Brooch of Shielding",
    level: 10,
    description: "Replicates a Brooch of Shielding magic item.",
  },
  {
    name: "Replicate Magic Item: Cloak of Protection",
    level: 10,
    description: "Replicates a Cloak of Protection magic item.",
  },
  {
    name: "Replicate Magic Item: Eyes of the Eagle",
    level: 10,
    description: "Replicates Eyes of the Eagle magic item.",
  },
  {
    name: "Replicate Magic Item: Gauntlets of Ogre Power",
    level: 10,
    description: "Replicates Gauntlets of Ogre Power magic item.",
  },
  {
    name: "Replicate Magic Item: Gloves of Missile Snaring",
    level: 10,
    description: "Replicates Gloves of Missile Snaring magic item.",
  },
  {
    name: "Replicate Magic Item: Gloves of Swimming and Climbing",
    level: 10,
    description: "Replicates Gloves of Swimming and Climbing magic item.",
  },
  {
    name: "Replicate Magic Item: Hat of Disguise",
    level: 10,
    description: "Replicates a Hat of Disguise magic item.",
  },
  {
    name: "Replicate Magic Item: Headband of Intellect",
    level: 10,
    description: "Replicates a Headband of Intellect magic item.",
  },
  {
    name: "Replicate Magic Item: Helm of Telepathy",
    level: 10,
    description: "Replicates a Helm of Telepathy magic item.",
  },
  {
    name: "Replicate Magic Item: Medallion of Thoughts",
    level: 10,
    description: "Replicates a Medallion of Thoughts magic item.",
  },
  {
    name: "Replicate Magic Item: Necklace of Adaptation",
    level: 10,
    description: "Replicates a Necklace of Adaptation magic item.",
  },
  {
    name: "Replicate Magic Item: Periapt of Wound Closure",
    level: 10,
    description: "Replicates a Periapt of Wound Closure magic item.",
  },
  {
    name: "Replicate Magic Item: Pipes of the Sewers",
    level: 10,
    description: "Replicates Pipes of the Sewers magic item.",
  },
  {
    name: "Replicate Magic Item: Quiver of Ehlonna",
    level: 10,
    description: "Replicates a Quiver of Ehlonna magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of Jumping",
    level: 10,
    description: "Replicates a Ring of Jumping magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of Mind Shielding",
    level: 10,
    description: "Replicates a Ring of Mind Shielding magic item.",
  },
  {
    name: "Replicate Magic Item: Slippers of Spider Climbing",
    level: 10,
    description: "Replicates Slippers of Spider Climbing magic item.",
  },
  {
    name: "Replicate Magic Item: Ventilating Lungs",
    level: 10,
    description: "Replicates Ventilating Lungs magic item.",
  },
  {
    name: "Replicate Magic Item: Winged Boots",
    level: 10,
    description: "Replicates Winged Boots magic item.",
  },

  // 14th level replicate magic item
  {
    name: "Replicate Magic Item: Amulet of Health",
    level: 14,
    description: "Replicates an Amulet of Health magic item.",
  },
  {
    name: "Replicate Magic Item: Arcane Propulsion Arm",
    level: 14,
    description: "Replicates an Arcane Propulsion Arm magic item.",
  },
  {
    name: "Replicate Magic Item: Belt of Hill Giant Strength",
    level: 14,
    description: "Replicates a Belt of Hill Giant Strength magic item.",
  },
  {
    name: "Replicate Magic Item: Boots of Levitation",
    level: 14,
    description: "Replicates Boots of Levitation magic item.",
  },
  {
    name: "Replicate Magic Item: Boots of Speed",
    level: 14,
    description: "Replicates Boots of Speed magic item.",
  },
  {
    name: "Replicate Magic Item: Bracers of Defense",
    level: 14,
    description: "Replicates Bracers of Defense magic item.",
  },
  {
    name: "Replicate Magic Item: Cloak of the Bat",
    level: 14,
    description: "Replicates a Cloak of the Bat magic item.",
  },
  {
    name: "Replicate Magic Item: Dimensional Shackles",
    level: 14,
    description: "Replicates Dimensional Shackles magic item.",
  },
  {
    name: "Replicate Magic Item: Gem of Seeing",
    level: 14,
    description: "Replicates a Gem of Seeing magic item.",
  },
  {
    name: "Replicate Magic Item: Horn of Blasting",
    level: 14,
    description: "Replicates a Horn of Blasting magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of Free Action",
    level: 14,
    description: "Replicates a Ring of Free Action magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of Protection",
    level: 14,
    description: "Replicates a Ring of Protection magic item.",
  },
  {
    name: "Replicate Magic Item: Ring of the Ram",
    level: 14,
    description: "Replicates a Ring of the Ram magic item.",
  },
];

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
 * Returns available Artificer Infusions Known rule choices for the character.
 * Supports both milestone-based IDs (e.g. TCE__Artificer__Infusions 2) and canonical unified ID (TCE__Artificer__Infusions Known).
 */
export function artificerInfusionChoices(
  character: Character,
  activeBooks?: string[],
  preferUnified?: boolean
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

  const isUnified = Boolean(
    preferUnified ||
    character.ruleChoices?.some((rc) => rc.id === ARTIFICER_INFUSIONS_KNOWN_ID)
  );

  if (isUnified) {
    const eligible = ALL_ARTIFICER_INFUSIONS
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
      const eligible = ALL_ARTIFICER_INFUSIONS
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
 * Prunes invalid Artificer infusions when levels change or character delevels.
 */
export function pruneInvalidInfusions(character: Character): Character {
  const classes = character.classes || [];
  const artificer = classes.find((c) => c.className.toLowerCase() === "artificer");
  const artificerLevel = artificer ? artificer.level : 0;

  const validChoices = artificerInfusionChoices(character);
  const validChoiceMap = new Map<string, AvailableRuleChoice>();
  for (const c of validChoices) {
    validChoiceMap.set(c.id, c);
  }

  if (artificerLevel >= 2 && !validChoiceMap.has(ARTIFICER_INFUSIONS_KNOWN_ID)) {
    const unifiedChoices = artificerInfusionChoices(character, undefined, true);
    for (const c of unifiedChoices) {
      validChoiceMap.set(c.id, c);
    }
  }

  const seenPicks = new Set<string>();
  const nextRuleChoices: RuleChoiceEntry[] = [];
  const removedInfusions: string[] = [];

  for (const rc of character.ruleChoices || []) {
    if (isInfusionChoiceId(rc.id)) {
      const validChoice = validChoiceMap.get(rc.id);
      if (!validChoice) {
        for (const p of rc.picked || []) {
          removedInfusions.push(p);
        }
        continue;
      }

      const keptPicks: string[] = [];
      for (const p of rc.picked || []) {
        const norm = p.toLowerCase().trim();
        const def = ALL_ARTIFICER_INFUSIONS.find(
          (d) => d.name.toLowerCase().trim() === norm
        );
        const isEligible = def ? def.level <= artificerLevel : false;

        if (!isEligible) {
          removedInfusions.push(p);
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
 * Records or updates an Artificer infusion choice pick for a character.
 */
export function pickInfusionChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string
): Character {
  return setRuleChoicePick(
    character,
    choice.id,
    choice.traitName,
    option,
    choice.options.map((o) => o.name),
    choice.choose,
    "class"
  );
}

