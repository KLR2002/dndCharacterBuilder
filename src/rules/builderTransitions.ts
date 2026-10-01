import type {
  AbilityKey,
  Character,
  CharacterClass,
  InventoryItem,
  SkillChoiceEntry,
} from "../types/character.ts";
import type { BackgroundData } from "../types/dnd5e.ts";
import {
  STANDARD_ARRAY,
  MULTICLASS_PREREQUISITES,
  MULTICLASS_PROFICIENCIES,
  DND_SKILLS,
} from "../constants/rules.ts";

export function setStandardArrayPick(
  character: Character,
  ability: AbilityKey,
  value: number | null
): Character {
  if (
    value !== null &&
    (!STANDARD_ARRAY.includes(value) ||
      Object.entries(character.standardArrayPicks ?? {}).some(
        ([key, pick]) => key !== ability && pick === value
      ))
  ) {
    return character;
  }
  const picks = { ...character.standardArrayPicks };
  if (value === null) delete picks[ability];
  else picks[ability] = value;
  return {
    ...character,
    standardArrayPicks: picks,
    baseAbilityScores: { ...character.baseAbilityScores, [ability]: value ?? 10 },
  };
}

export function setChoiceRacialBonus(
  character: Character,
  picks: { key: AbilityKey; amount: number }[]
): Character {
  const fixed: Record<string, number> = { ...(character.racialAbilityBonuses ?? {}) };
  for (const oldPick of character.racialChoiceBonus ?? []) {
    if (fixed[oldPick.key] !== undefined) {
      fixed[oldPick.key] -= oldPick.amount;
      if (fixed[oldPick.key] <= 0) {
        delete fixed[oldPick.key];
      }
    }
  }

  const updatedBonuses: Record<string, number> = { ...fixed };
  for (const pick of picks) {
    updatedBonuses[pick.key] = (updatedBonuses[pick.key] || 0) + pick.amount;
  }

  return {
    ...character,
    racialChoiceBonus: [...picks],
    racialAbilityBonuses: updatedBonuses,
  };
}

const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function getPrereqForClass(className: string) {
  const match = Object.keys(MULTICLASS_PREREQUISITES).find(
    (k) => k.toLowerCase() === className.toLowerCase()
  );
  return match ? MULTICLASS_PREREQUISITES[match] : undefined;
}

function checkClassPrereq(
  className: string,
  scores: Record<AbilityKey, number>
): { met: boolean; reason?: string } {
  const req = getPrereqForClass(className);
  if (!req) return { met: true };

  if ("or" in req) {
    const met = req.or.some((r) => (scores[r.ability] ?? 0) >= r.minScore);
    if (!met) {
      const needed = req.or.map((r) => `${ABILITY_NAMES[r.ability]} ${r.minScore}`).join(" or ");
      return { met: false, reason: `${className} requires ${needed}` };
    }
    return { met: true };
  }

  const missing = req.filter((r) => (scores[r.ability] ?? 0) < r.minScore);
  if (missing.length > 0) {
    const needed = req.map((r) => `${ABILITY_NAMES[r.ability]} ${r.minScore}`).join(" and ");
    return { met: false, reason: `${className} requires ${needed}` };
  }

  return { met: true };
}

export function validateMulticlass(
  character: Character,
  targetClassName: string,
  effectiveScores: Record<AbilityKey, number>
): { ok: boolean; reason?: string } {
  // If character already has this class, leveling up within it is not multiclassing into it
  if (character.classes.some((c) => c.className.toLowerCase() === targetClassName.toLowerCase())) {
    return { ok: true };
  }

  // 1. Check prerequisites for all current/existing classes (multiclassing OUT)
  for (const existing of character.classes) {
    const res = checkClassPrereq(existing.className, effectiveScores);
    if (!res.met) {
      return { ok: false, reason: res.reason };
    }
  }

  // 2. Check prerequisite for target class (multiclassing IN)
  const targetRes = checkClassPrereq(targetClassName, effectiveScores);
  if (!targetRes.met) {
    return { ok: false, reason: targetRes.reason };
  }

  return { ok: true };
}

const ROGUE_SKILL_LIST = [
  "Acrobatics",
  "Athletics",
  "Deception",
  "Insight",
  "Intimidation",
  "Investigation",
  "Perception",
  "Performance",
  "Persuasion",
  "Sleight of Hand",
  "Stealth",
];

function getMulticlassProficiencyGrant(className: string) {
  const match = Object.keys(MULTICLASS_PROFICIENCIES).find(
    (k) => k.toLowerCase() === className.toLowerCase()
  );
  return match ? MULTICLASS_PROFICIENCIES[match] : undefined;
}

export function addMulticlassLevel(
  character: Character,
  className: string,
  source: string
): Character {
  const existingIdx = character.classes.findIndex(
    (c) => c.className.toLowerCase() === className.toLowerCase()
  );

  if (existingIdx !== -1) {
    const updatedClasses = character.classes.map((c, idx) =>
      idx === existingIdx ? { ...c, level: c.level + 1 } : c
    );
    return {
      ...character,
      classes: updatedClasses,
    };
  }

  // New class entry
  const newClass: CharacterClass = { className, source, level: 1 };
  const updatedClasses = [...character.classes, newClass];

  const grants = getMulticlassProficiencyGrant(className);
  const updatedSkillChoices = character.skillChoices ? [...character.skillChoices] : [];
  const updatedMulticlassProfs = character.multiclassProficiencies
    ? [...character.multiclassProficiencies]
    : [];

  if (grants && character.classes.length > 0) {
    const choiceId = `multiclass_skill_${className.toLowerCase()}`;
    if (grants.skills && !updatedSkillChoices.some((sc) => sc.id === choiceId)) {
      updatedSkillChoices.push({
        id: choiceId,
        origin: "class",
        choose: 1,
        from: className.toLowerCase() === "rogue" ? ROGUE_SKILL_LIST : DND_SKILLS.map((s) => s.name),
        picked: [],
      });
    }

    updatedMulticlassProfs.push({
      className,
      ...(grants.armor ? { armor: [...grants.armor] } : {}),
      ...(grants.weapons ? { weapons: [...grants.weapons] } : {}),
      ...(grants.tools ? { tools: [...grants.tools] } : {}),
      ...(grants.skills ? { skills: grants.skills } : {}),
    });
  }

  return {
    ...character,
    classes: updatedClasses,
    ...(updatedSkillChoices.length > 0 ? { skillChoices: updatedSkillChoices } : {}),
    ...(updatedMulticlassProfs.length > 0 ? { multiclassProficiencies: updatedMulticlassProfs } : {}),
  };
}

export const STARTING_GOLD_BY_CLASS: Record<string, number> = {
  Barbarian: 50,
  Bard: 125,
  Cleric: 125,
  Druid: 50,
  Fighter: 125,
  Monk: 12,
  Paladin: 125,
  Ranger: 125,
  Rogue: 100,
  Sorcerer: 75,
  Warlock: 100,
  Wizard: 100,
  Artificer: 125,
};

export const CLASS_STARTING_EQUIPMENT: Record<
  string,
  { name: string; quantity: number; isEquipped: boolean; section: "equipped" | "carried" }[]
> = {
  Barbarian: [
    { name: "Greataxe", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Handaxe", quantity: 2, isEquipped: false, section: "carried" },
    { name: "Explorer's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Javelin", quantity: 4, isEquipped: false, section: "carried" },
  ],
  Bard: [
    { name: "Rapier", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Diplomat's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Lute", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Leather Armor", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Dagger", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Cleric: [
    { name: "Mace", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Scale Mail", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Light Crossbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Crossbow Bolt", quantity: 20, isEquipped: false, section: "carried" },
    { name: "Priest's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Shield", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Holy Symbol", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Druid: [
    { name: "Wooden Shield", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Scimitar", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Leather Armor", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Explorer's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Druidic Focus", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Fighter: [
    { name: "Chain Mail", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Longsword", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Shield", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Light Crossbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Crossbow Bolt", quantity: 20, isEquipped: false, section: "carried" },
    { name: "Dungeoneer's Pack", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Monk: [
    { name: "Shortsword", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Dungeoneer's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Dart", quantity: 10, isEquipped: false, section: "carried" },
  ],
  Paladin: [
    { name: "Longsword", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Shield", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Javelin", quantity: 5, isEquipped: false, section: "carried" },
    { name: "Priest's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Chain Mail", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Holy Symbol", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Ranger: [
    { name: "Scale Mail", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Shortsword", quantity: 2, isEquipped: true, section: "equipped" },
    { name: "Dungeoneer's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Longbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Arrow", quantity: 20, isEquipped: false, section: "carried" },
  ],
  Rogue: [
    { name: "Rapier", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Shortbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Arrow", quantity: 20, isEquipped: false, section: "carried" },
    { name: "Burglar's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Leather Armor", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Dagger", quantity: 2, isEquipped: false, section: "carried" },
    { name: "Thieves' Tools", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Sorcerer: [
    { name: "Light Crossbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Crossbow Bolt", quantity: 20, isEquipped: false, section: "carried" },
    { name: "Component Pouch", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Dungeoneer's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Dagger", quantity: 2, isEquipped: false, section: "carried" },
  ],
  Warlock: [
    { name: "Light Crossbow", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Crossbow Bolt", quantity: 20, isEquipped: false, section: "carried" },
    { name: "Component Pouch", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Scholar's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Leather Armor", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Dagger", quantity: 2, isEquipped: false, section: "carried" },
  ],
  Wizard: [
    { name: "Quarterstaff", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Component Pouch", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Scholar's Pack", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Spellbook", quantity: 1, isEquipped: false, section: "carried" },
  ],
  Artificer: [
    { name: "Dagger", quantity: 2, isEquipped: false, section: "carried" },
    { name: "Studded Leather Armor", quantity: 1, isEquipped: true, section: "equipped" },
    { name: "Thieves' Tools", quantity: 1, isEquipped: false, section: "carried" },
    { name: "Dungeoneer's Pack", quantity: 1, isEquipped: false, section: "carried" },
  ],
};

export function applyStartingGrants(
  character: Character,
  mode: "gold" | "equipment",
  options?: {
    goldAmount?: number;
    equipmentItems?: InventoryItem[];
  }
): Character {
  if (character.startingGrantsApplied) {
    return character;
  }

  if (mode === "gold") {
    let gold = options?.goldAmount;
    if (gold === undefined) {
      const primary = character.classes[0]?.className;
      const match = primary
        ? Object.keys(STARTING_GOLD_BY_CLASS).find((k) => k.toLowerCase() === primary.toLowerCase())
        : undefined;
      gold = match ? STARTING_GOLD_BY_CLASS[match] : 100;
    }

    return {
      ...character,
      startingOption: "gold",
      startingGrantsApplied: true,
      pouch: {
        ...character.pouch,
        gp: (character.pouch?.gp ?? 0) + gold,
      },
    };
  }

  // mode === "equipment"
  let newItems = options?.equipmentItems;
  if (!newItems) {
    const primary = character.classes[0]?.className;
    const match = primary
      ? Object.keys(CLASS_STARTING_EQUIPMENT).find((k) => k.toLowerCase() === primary.toLowerCase())
      : undefined;
    const defs = match ? CLASS_STARTING_EQUIPMENT[match] : [];
    newItems = defs.map((d, idx) => ({
      id: `start_${(primary || "item").toLowerCase()}_${idx}`,
      name: d.name,
      source: "PHB",
      quantity: d.quantity,
      isEquipped: d.isEquipped,
      section: d.section,
    }));
  }

  return {
    ...character,
    startingOption: "equipment",
    startingGrantsApplied: true,
    items: [...(character.items ?? []), ...newItems],
  };
}

export function setCustomBackground(
  character: Character,
  name: string,
  skills: string[]
): Character {
  const oldBgChoice = character.skillChoices?.find((sc) => sc.origin === "background");
  const oldPicked = new Set(oldBgChoice?.picked ?? []);

  const retainedSkills = (character.chosenSkills ?? []).filter((s) => !oldPicked.has(s));
  const newChosenSkills = Array.from(new Set([...retainedSkills, ...skills]));

  const newBgChoice: SkillChoiceEntry = {
    id: "background_skills",
    origin: "background",
    choose: skills.length,
    from: [...skills],
    picked: [...skills],
  };

  const otherChoices = (character.skillChoices ?? []).filter((sc) => sc.origin !== "background");

  return {
    ...character,
    background: {
      name,
      source: "Custom",
    },
    chosenSkills: newChosenSkills,
    skillChoices: [...otherChoices, newBgChoice],
  };
}

export function parseBackgroundEquipment(startingEquipment: string[] = []): {
  coins: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number };
  items: Array<{ name: string; quantity: number; section: "carried" | "equipped" }>;
} {
  const coins: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number } = {};
  const items: Array<{ name: string; quantity: number; section: "carried" | "equipped" }> = [];

  for (const raw of startingEquipment) {
    const text = raw.trim();
    if (!text) continue;

    // Check for pouch containing XX gp, or XX gp
    const moneyMatch = text.match(/(?:containing\s+)?(\d+)\s*(cp|sp|ep|gp|pp)\b/i);
    if (moneyMatch) {
      const amt = parseInt(moneyMatch[1], 10);
      const cur = moneyMatch[2].toLowerCase() as "cp" | "sp" | "ep" | "gp" | "pp";
      coins[cur] = (coins[cur] || 0) + amt;
    }

    // If the entry is just pure coins like "15 gp", do not add it as a separate inventory item
    if (/^\d+\s*(cp|sp|ep|gp|pp)$/i.test(text)) {
      continue;
    }

    // Parse quantity if starts with number, e.g. "5 sticks of incense"
    const qtyMatch = text.match(/^(\d+)\s+(.+)$/);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1], 10);
      let name = qtyMatch[2].trim();
      name = name.charAt(0).toUpperCase() + name.slice(1);
      items.push({ name, quantity: q, section: "carried" });
    } else {
      let name = text.replace(/^a\s+pouch\s+containing.*$/i, "Pouch");
      name = name.charAt(0).toUpperCase() + name.slice(1);
      items.push({ name, quantity: 1, section: "carried" });
    }
  }

  return { coins, items };
}

export function applyBackgroundGrants(
  character: Character,
  backgroundData?: BackgroundData
): Character {
  if (character.backgroundGrantsApplied) {
    return character;
  }

  const bgData = backgroundData;
  const startingEquipment = bgData?.startingEquipment || [];
  const { coins, items } = parseBackgroundEquipment(startingEquipment);

  const updatedPouch = {
    cp: (character.pouch?.cp ?? 0) + (coins.cp || 0),
    sp: (character.pouch?.sp ?? 0) + (coins.sp || 0),
    ep: (character.pouch?.ep ?? 0) + (coins.ep || 0),
    gp: (character.pouch?.gp ?? 0) + (coins.gp || 0),
    pp: (character.pouch?.pp ?? 0) + (coins.pp || 0),
  };

  const bgItems: InventoryItem[] = items.map((it, idx) => ({
    id: `bg_item_${idx}`,
    name: it.name,
    source: bgData?.source || "PHB",
    quantity: it.quantity,
    isEquipped: false,
    section: it.section,
  }));

  const existingSkills = new Set((character.chosenSkills || []).map((s) => s.toLowerCase()));
  const newSkills = [...(character.chosenSkills || [])];
  for (const s of bgData?.skillProficiencies || []) {
    if (!existingSkills.has(s.toLowerCase())) {
      newSkills.push(s);
      existingSkills.add(s.toLowerCase());
    }
  }

  return {
    ...character,
    backgroundGrantsApplied: true,
    pouch: updatedPouch,
    items: [...(character.items || []), ...bgItems],
    chosenSkills: newSkills,
  };
}

export function setLanguages(character: Character, languages: string[]): Character {
  return {
    ...character,
    languages: [...languages],
  };
}

