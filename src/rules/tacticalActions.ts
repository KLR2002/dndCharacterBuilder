import type { ActiveBooks } from "../constants/books.ts";
import { UNKNOWN_OWNER_KEY } from "../constants/rules.ts";
import type { Character } from "../types/character.ts";
import type { EvaluatedCharacter } from "./characterEvaluation.ts";
import {
  checkDualWielding,
  getEldritchBlastDamage,
  type WeaponAttackOption,
} from "./attacks.ts";
import {
  getBardicInspirationDie,
  getMartialArtsDie,
  getSneakAttackDice,
  superiorityDieLabel,
} from "./combatDice.ts";
import { getChosenManeuvers } from "./ruleChoices.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

export interface TacticalCardItem {
  name: string;
  source: string;
  desc: string;
  badge?: string;
  dc?: number;
  die?: string;
}

export interface TacticalSpellAttack {
  name: string;
  level: number;
  damage: string;
  /** The casting profile's spell attack bonus, so the row's "to hit" badge can roll it. */
  attackBonus?: number;
  time: string;
  range: string;
  desc: string;
  kiCost?: number;
}

export interface TacticalManeuverItem {
  name: string;
  category: "Reaction" | "Bonus Action" | "Attack Rider";
  categoryLabel: string;
  description: string;
  dc?: number;
  die?: string;
}

export interface TacticalActionLedger {
  extraAttackCount: number;
  weaponAttacks: WeaponAttackOption[];
  dualWield: {
    isDualWielding: boolean;
    mainHand?: WeaponAttackOption;
    offHand?: WeaponAttackOption;
  };
  sneakAttackDice: string | null;
  spellAttacks: TacticalSpellAttack[];
  bonusActions: TacticalCardItem[];
  reactions: TacticalCardItem[];
  maneuvers: TacticalManeuverItem[];
  standardActions: { name: string; type: string; desc: string }[];
}

export const STANDARD_ACTIONS = [
  {
    name: "Attack",
    type: "Action",
    desc: "Make one melee or ranged attack. Certain features, such as the Extra Attack feature of the fighter, allow you to make more than one attack with this action.",
  },
  {
    name: "Cast a Spell",
    type: "Action / Bonus / Reaction",
    desc: "Cast a spell with a casting time of 1 action. If you cast a bonus action spell, you can only cast a cantrip with casting time of 1 action on the same turn.",
  },
  {
    name: "Dash",
    type: "Action",
    desc: "Gain extra movement for the current turn. The increase equals your speed, after applying any modifiers.",
  },
  {
    name: "Disengage",
    type: "Action",
    desc: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
  },
  {
    name: "Dodge",
    type: "Action",
    desc: "Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker, and you make Dexterity saving throws with advantage.",
  },
  {
    name: "Help",
    type: "Action",
    desc: "Lend aid to an ally. The target gains advantage on the next ability check it makes to perform the task, or advantage on its next attack roll against a target within 5 feet of you.",
  },
  {
    name: "Hide",
    type: "Action",
    desc: "Make a Dexterity (Stealth) check in an attempt to hide, concealed from enemies that cannot clearly see you.",
  },
  {
    name: "Ready",
    type: "Action",
    desc: "Wait for a particular circumstance before you act. Choose the perceptible trigger and the action you will take in response, which uses your Reaction when triggered.",
  },
  {
    name: "Search",
    type: "Action",
    desc: "Devote your attention to finding something. The DM might call for a Wisdom (Perception) check or an Intelligence (Investigation) check.",
  },
  {
    name: "Use an Object",
    type: "Action",
    desc: "Interact with a second object on your turn, drink or administer a potion, or use a complex item or mechanical device.",
  },
];

export const SAVING_THROW_MANEUVERS = new Set([
  "disarming attack",
  "goading attack",
  "menacing attack",
  "pushing attack",
  "sweeping attack",
  "trip attack",
]);

export const REACTION_MANEUVERS = new Set(["brace", "parry", "riposte"]);
export const BONUS_ACTION_MANEUVERS = new Set(["commander's strike", "feinting attack", "quick toss", "rally"]);
/** Maneuvers that are none of the three sets above. They keep the default Attack Rider category. */
export const OTHER_MANEUVERS = new Set([
  "ambush",
  "bait and switch",
  "commanding presence",
  "distracting strike",
  "evasive footwork",
  "grappling strike",
  "lunging attack",
  "maneuvering attack",
  "precision attack",
  "tactical assessment",
]);

function formatMod(val: number): string {
  return val >= 0 ? `+${val}` : `${val}`;
}

/**
 * Whether a spell calls for a spell attack roll: its Catalog record's structured attack-type field
 * ("M" melee, "R" ranged, "O" other) when present, else its text naming a melee or ranged spell attack.
 * Save-based and utility spells make no attack, so their rows carry no attack bonus.
 */
function makesSpellAttack(sp: { spellAttack?: string[]; description?: string }): boolean {
  if (sp.spellAttack && sp.spellAttack.length > 0) return true;
  const text = (sp.description || "").toLowerCase();
  return text.includes("melee spell attack") || text.includes("ranged spell attack");
}

/**
 * Derives the tactical combat action economy ledger for a character,
 * aggregating attacks, bonus actions, reactions, and maneuvers.
 */
export function getTacticalActionLedger(
  character: Character,
  evaluated: EvaluatedCharacter,
  catalogs?: {
    activeBooks: ActiveBooks;
    /** Defaults to the process-wide current Compendium. */
    compendium?: Compendium;
  }
): TacticalActionLedger {
  const compendium = catalogs?.compendium ?? currentCompendium();
  const weaponAttacks = evaluated.weaponAttacks ?? [];
  const dualWield = checkDualWielding(character, weaponAttacks);
  const extraAttackCount = evaluated.attacks?.extraAttackCount ?? 1;

  // 1. Rogue Sneak Attack dice
  const rogueClass = (character.classes || []).find((c) => c.className.toLowerCase() === "rogue");
  const sneakAttackDice = rogueClass ? getSneakAttackDice(rogueClass.level) : null;

  // 2. Spell attacks & combat cantrips
  const spellAttacks: TacticalSpellAttack[] = [];
  const seenSpellNames = new Set<string>();
  const spellProfiles = evaluated.spellProfiles || [];
  // The casting profile a known spell belongs to: by the owner key it is stored under (a Warlock's tome
  // key counts as the Warlock), else by its legacy class hint, else the only profile of a single caster.
  // A spell no profile owns gets no attack bonus, so its row shows no roll badge.
  const profileForSpell = (k: { ownerKey?: string; className?: string }) => {
    if (k.ownerKey && k.ownerKey !== UNKNOWN_OWNER_KEY) {
      return (
        spellProfiles.find((p) => p.ownerKey === k.ownerKey) ??
        (k.ownerKey.startsWith("Warlock__") ? spellProfiles.find((p) => p.className === "Warlock") : undefined)
      );
    }
    return (
      spellProfiles.find((p) => p.className === k.className) ?? (spellProfiles.length === 1 ? spellProfiles[0] : undefined)
    );
  };

  const candidateSpells: { name: string; source: string; kiCost?: number; spellObj?: any; attackBonus?: number }[] = [
    ...(character.knownSpells || []).map((k) => {
      const profile = profileForSpell(k);
      return { name: k.name, source: k.source, attackBonus: profile?.spellAttackBonus };
    }),
  ];

  for (const prof of spellProfiles) {
    for (const sp of prof.subclassKnownSpells || []) {
      candidateSpells.push({ name: sp.name, source: sp.source, kiCost: sp.kiCost, spellObj: sp, attackBonus: prof.spellAttackBonus });
    }
    for (const sp of prof.alwaysPreparedSpells || []) {
      candidateSpells.push({ name: sp.name, source: sp.source, kiCost: sp.kiCost, spellObj: sp, attackBonus: prof.spellAttackBonus });
    }
  }

  for (const k of candidateSpells) {
    const norm = k.name.toLowerCase();
    if (seenSpellNames.has(norm)) continue;
    seenSpellNames.add(norm);

    const sp = k.spellObj || compendium.findSpell(k.name, k.source);
    const isDamagingOrCombat =
      sp &&
      (sp.level === 0 ||
        (sp.description || "").toLowerCase().includes("make a ranged spell attack") ||
        (sp.description || "").toLowerCase().includes("make a melee spell attack") ||
        (sp.description || "").toLowerCase().includes("takes ") ||
        k.kiCost !== undefined);

    if (sp && isDamagingOrCombat) {
      let damage = sp.level === 0 ? "Cantrip scaling" : k.kiCost ? `${k.kiCost} Ki` : "Spell attack";
      if (norm === "eldritch blast") {
        damage = getEldritchBlastDamage(character);
      }
      spellAttacks.push({
        name: k.kiCost ? `${sp.name} (${k.kiCost} Ki)` : sp.name,
        level: sp.level,
        damage,
        attackBonus: makesSpellAttack(sp) ? k.attackBonus : undefined,
        time: sp.castingTime || "1 action",
        range: sp.range || "60 ft",
        desc: sp.description || "",
        kiCost: k.kiCost,
      });
    }
  }

  // 3. Maneuvers
  const chosenManeuvers = getChosenManeuvers(character);
  const maneuverDc = evaluated.combatDcs?.maneuverSaveDc ?? 8;
  const superiorityDie = superiorityDieLabel(evaluated.combatDice?.superiorityDice ?? null);
  const allOptions = compendium.for(catalogs?.activeBooks).optionsAndFeatures();
  const maneuverMap = new Map<string, string>();

  for (const o of allOptions) {
    if ((o.category && o.category.includes("Maneuver")) || (o.featureType && o.featureType.includes("MV:B"))) {
      maneuverMap.set(o.name.toLowerCase().trim(), o.description || "");
    }
  }

  const maneuvers: TacticalManeuverItem[] = chosenManeuvers.map((name) => {
    const lower = name.toLowerCase().trim();
    let category: "Reaction" | "Bonus Action" | "Attack Rider";
    let categoryLabel: string;
    if (REACTION_MANEUVERS.has(lower)) {
      category = "Reaction";
      categoryLabel = "Reaction";
    } else if (BONUS_ACTION_MANEUVERS.has(lower)) {
      category = "Bonus Action";
      categoryLabel = "Bonus Action";
    } else {
      category = "Attack Rider";
      categoryLabel = "Attack Rider";
    }
    const description = maneuverMap.get(lower) || "Battle Master Maneuver.";
    const hasSave = SAVING_THROW_MANEUVERS.has(lower);

    return {
      name,
      category,
      categoryLabel,
      description,
      dc: hasSave ? maneuverDc : undefined,
      die: superiorityDie ?? "d8",
    };
  });

  // 4. Bonus Actions
  const bonusActions: TacticalCardItem[] = [];

  if (dualWield.isDualWielding && dualWield.offHand) {
    const badges = dualWield.offHand.calculationBadges?.join(", ");
    bonusActions.push({
      name: `Off-Hand Attack (${dualWield.offHand.name})`,
      source: "Two-Weapon Fighting",
      desc: `When you take the Attack action and attack with a light melee weapon in one hand, you can use a bonus action to attack with a different light melee weapon in the other hand. Attack bonus: ${formatMod(dualWield.offHand.attackBonus)} to hit, Damage: ${dualWield.offHand.damage}${dualWield.offHand.damageType ? ` ${dualWield.offHand.damageType}` : ""}. You don't add your ability modifier to the damage of the bonus attack, unless that modifier is negative.`,
      badge: badges || undefined,
    });
  }

  for (const c of character.classes || []) {
    const clsLower = c.className.toLowerCase();
    if (clsLower === "rogue" && c.level >= 2) {
      bonusActions.push({
        name: "Cunning Action",
        source: "Rogue 2",
        desc: "You can take a bonus action on each of your turns in combat to take the Dash, Disengage, or Hide action.",
      });
    }
    if (clsLower === "barbarian") {
      bonusActions.push({
        name: "Enter Rage",
        source: "Barbarian 1",
        desc: "In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action.",
      });
    }
    if (clsLower === "fighter") {
      bonusActions.push({
        name: "Second Wind",
        source: "Fighter 1",
        desc: `You have a limited well of stamina. On your turn, you can use a bonus action to regain hit points equal to 1d10 + ${c.level}.`,
      });
    }
    if (clsLower === "monk") {
      const monkDie = getMartialArtsDie(c.level) || "1d4";
      bonusActions.push({
        name: "Bonus Action: Martial Arts Strike",
        source: `Monk ${c.level}`,
        desc: `When you use the Attack action with an unarmed strike or a monk weapon on your turn, you can make one unarmed strike as a bonus action (deals ${monkDie} + Dex/Str damage).`,
      });
      if (c.level >= 2) {
        bonusActions.push({
          name: "Bonus Action: Flurry of Blows (1 Ki)",
          source: `Monk ${c.level}`,
          desc: `Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action (each dealing ${monkDie} + Dex/Str damage).`,
        });
        bonusActions.push({
          name: "Bonus Action: Patient Defense (1 Ki)",
          source: `Monk ${c.level}`,
          desc: "You can spend 1 ki point to take the Dodge action as a bonus action on your turn.",
        });
        bonusActions.push({
          name: "Bonus Action: Step of the Wind (1 Ki)",
          source: `Monk ${c.level}`,
          desc: "You can spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.",
        });
      }
      const hasFireSnake = (character.ruleChoices || []).some((rc) =>
        rc.picked?.some((p) => p.toLowerCase().includes("fire snake"))
      );
      if (hasFireSnake) {
        bonusActions.push({
          name: "Bonus Action: Fangs of the Fire Snake (1 Ki)",
          source: `Monk ${c.level}`,
          desc: "Spend 1 ki point to increase your unarmed reach by 10 ft with fire damage until the end of your turn.",
        });
      }
    }
    if (clsLower === "bard") {
      const bardDie = getBardicInspirationDie(c.level) || "1d6";
      bonusActions.push({
        name: `Bardic Inspiration (${bardDie})`,
        source: `Bard ${c.level}`,
        desc: `You can inspire others through stirring words or music. Use a bonus action to give a creature within 60 ft a Bardic Inspiration die (${bardDie}) to add to one ability check, attack roll, or saving throw.`,
      });
    }
  }

  for (const m of maneuvers) {
    if (m.category === "Bonus Action") {
      bonusActions.push({
        name: `${m.name} (Maneuver)`,
        source: "Maneuver",
        desc: `${m.description}\n\nUses 1 Superiority Die (${m.die}).${m.dc ? ` Maneuver Save DC: ${m.dc}.` : ""}`,
        dc: m.dc,
        die: m.die,
      });
    }
  }

  // 5. Reactions
  const reactions: TacticalCardItem[] = [
    {
      name: "Opportunity Attack",
      source: "Standard Combat Rule",
      desc: "You can make an opportunity attack when a hostile creature that you can see moves out of your reach. To make the opportunity attack, you use your reaction to make one melee attack against the provoking creature.",
    },
    {
      name: "Readied Action Trigger",
      source: "Standard Combat Rule",
      desc: "When the trigger condition set by your Ready action occurs, you can take your reaction right after the trigger finishes, or ignore it.",
    },
  ];

  for (const c of character.classes || []) {
    const clsLower = c.className.toLowerCase();
    if (clsLower === "rogue" && c.level >= 5) {
      reactions.push({
        name: "Uncanny Dodge",
        source: "Rogue 5",
        desc: "When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you.",
      });
    }
    if (clsLower === "monk" && c.level >= 3) {
      reactions.push({
        name: "Deflect Missiles",
        source: "Monk 3",
        desc: "You can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. Damage is reduced by 1d10 + Dex mod + Monk level.",
      });
    }
  }

  // Check for Reaction spells
  for (const k of character.knownSpells || []) {
    const sp = compendium.findSpell(k.name, k.source);
    if (sp && (sp.castingTime || "").toLowerCase().includes("reaction")) {
      reactions.push({
        name: sp.name,
        source: `Spell (${sp.castingTime})`,
        desc: sp.description || "",
      });
    }
  }

  for (const m of maneuvers) {
    if (m.category === "Reaction") {
      reactions.push({
        name: `${m.name} (Maneuver)`,
        source: "Maneuver",
        desc: `${m.description}\n\nUses 1 Superiority Die (${m.die}).${m.dc ? ` Maneuver Save DC: ${m.dc}.` : ""}`,
        dc: m.dc,
        die: m.die,
      });
    }
  }

  return {
    extraAttackCount,
    weaponAttacks,
    dualWield,
    sneakAttackDice,
    spellAttacks,
    bonusActions,
    reactions,
    maneuvers,
    standardActions: STANDARD_ACTIONS,
  };
}
