import type { AbilityKey, Character } from "../types/character.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";

export interface InnateSpellEntry {
  name: string;
  level: number;
  minCharacterLevel: number;
  castingTime: string;
  source: string;
  isCantrip: boolean;
  resourceCounterId?: string;
  maxUses?: number;
}

export interface InnateSpellProfile {
  title: string;
  ability: AbilityKey;
  spellSaveDc: number;
  spellAttackBonus: number;
  spells: InnateSpellEntry[];
}

interface RaceInnateSpec {
  matches: (race: string, subrace: string) => boolean;
  ability: AbilityKey;
  title: string;
  spells: InnateSpellEntry[];
}

const INNATE_SPECS: RaceInnateSpec[] = [
  // Drow (Dark Elf)
  {
    matches: (race, subrace) => subrace.includes("drow") || subrace.includes("dark elf") || race.includes("drow"),
    ability: "cha",
    title: "Drow Magic",
    spells: [
      { name: "Dancing Lights", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
      { name: "Faerie Fire", level: 1, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_faerie_fire", maxUses: 1 },
      { name: "Darkness", level: 2, minCharacterLevel: 5, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_darkness", maxUses: 1 },
    ],
  },
  // Tiefling
  {
    matches: (race) => race.includes("tiefling"),
    ability: "cha",
    title: "Infernal Legacy",
    spells: [
      { name: "Thaumaturgy", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
      { name: "Hellish Rebuke", level: 2, minCharacterLevel: 3, castingTime: "1 reaction", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_hellish_rebuke", maxUses: 1 },
      { name: "Darkness", level: 2, minCharacterLevel: 5, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_darkness", maxUses: 1 },
    ],
  },
  // Githyanki
  {
    matches: (race, subrace) => race.includes("githyanki") || subrace.includes("githyanki"),
    ability: "int",
    title: "Githyanki Psionics",
    spells: [
      { name: "Mage Hand", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
      { name: "Jump", level: 1, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_jump", maxUses: 1 },
      { name: "Misty Step", level: 2, minCharacterLevel: 5, castingTime: "1 bonus action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_misty_step", maxUses: 1 },
    ],
  },
  // Githzerai
  {
    matches: (race, subrace) => race.includes("githzerai") || subrace.includes("githzerai"),
    ability: "wis",
    title: "Githzerai Psionics",
    spells: [
      { name: "Mage Hand", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
      { name: "Shield", level: 1, minCharacterLevel: 3, castingTime: "1 reaction", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_shield", maxUses: 1 },
      { name: "Detect Thoughts", level: 2, minCharacterLevel: 5, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_detect_thoughts", maxUses: 1 },
    ],
  },
  // Deep Gnome (Svirfneblin)
  {
    matches: (race, subrace) => race.includes("deep gnome") || subrace.includes("deep gnome") || subrace.includes("svirfneblin"),
    ability: "int",
    title: "Svirfneblin Magic",
    spells: [
      { name: "Nondetection", level: 3, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_nondetection", maxUses: 1 },
      { name: "Disguise Self", level: 1, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_disguise_self", maxUses: 1 },
    ],
  },
  // Forest Gnome
  {
    matches: (race, subrace) => subrace.includes("forest gnome"),
    ability: "int",
    title: "Natural Illusionist",
    spells: [
      { name: "Minor Illusion", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
    ],
  },
  // Firbolg
  {
    matches: (race) => race.includes("firbolg"),
    ability: "wis",
    title: "Firbolg Magic",
    spells: [
      { name: "Detect Magic", level: 1, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_detect_magic", maxUses: 1 },
      { name: "Disguise Self", level: 1, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_disguise_self", maxUses: 1 },
    ],
  },
  // Triton
  {
    matches: (race) => race.includes("triton"),
    ability: "cha",
    title: "Control Air and Water",
    spells: [
      { name: "Fog Cloud", level: 1, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_fog_cloud", maxUses: 1 },
      { name: "Gust of Wind", level: 2, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_gust_of_wind", maxUses: 1 },
      { name: "Wall of Water", level: 3, minCharacterLevel: 5, castingTime: "1 action", source: "XGE", isCantrip: false, resourceCounterId: "innate_spell_wall_of_water", maxUses: 1 },
    ],
  },
  // Aasimar
  {
    matches: (race) => race.includes("aasimar"),
    ability: "cha",
    title: "Celestial Legacy",
    spells: [
      { name: "Light", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
    ],
  },
  // Fire Genasi
  {
    matches: (race, subrace) => race.includes("fire genasi") || subrace.includes("fire genasi") || (race.includes("genasi") && subrace.includes("fire")),
    ability: "con",
    title: "Fire Genasi Magic",
    spells: [
      { name: "Produce Flame", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "PHB", isCantrip: true },
      { name: "Burning Hands", level: 1, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_burning_hands", maxUses: 1 },
    ],
  },
  // Water Genasi
  {
    matches: (race, subrace) => race.includes("water genasi") || subrace.includes("water genasi") || (race.includes("genasi") && subrace.includes("water")),
    ability: "con",
    title: "Water Genasi Magic",
    spells: [
      { name: "Shape Water", level: 0, minCharacterLevel: 1, castingTime: "1 action", source: "XGE", isCantrip: true },
      { name: "Create or Destroy Water", level: 1, minCharacterLevel: 3, castingTime: "1 action", source: "PHB", isCantrip: false, resourceCounterId: "innate_spell_create_water", maxUses: 1 },
    ],
  },
];

/**
 * Resolves the innate spell profile for a character based on ancestry traits and level.
 * Returns null if the character does not possess innate racial spellcasting.
 */
export function getInnateSpellProfile(character: Character): InnateSpellProfile | null {
  const race = (character.race?.name || "").toLowerCase();
  const subrace = (character.race?.subraceName || "").toLowerCase();
  const lvl = totalLevel(character);
  const pb = proficiencyBonus(lvl);
  const { modifiers } = effectiveScores(character);

  const matchedSpec = INNATE_SPECS.find(s => s.matches(race, subrace));

  const spells: InnateSpellEntry[] = [];
  let ability: AbilityKey = matchedSpec?.ability || "int";
  let title = matchedSpec?.title || "Innate Magic";

  if (matchedSpec) {
    for (const s of matchedSpec.spells) {
      if (lvl >= s.minCharacterLevel) {
        spells.push(s);
      }
    }
  }

  // Check for High Elf or High Elf descent Wizard cantrip
  const isElfHigh =
    race === "elf" &&
    (subrace === "high" ||
      subrace.includes("high") ||
      subrace.includes("sun") ||
      subrace.includes("moon"));

  const isHalfElfHigh =
    race.includes("half-elf") &&
    (subrace.includes("high") || subrace.includes("sun") || subrace.includes("moon")) &&
    Boolean(
      character.ruleChoices?.some(
        (r) => r.from?.includes("Cantrip") && r.picked?.includes("Cantrip")
      )
    );

  const isHighElf = isElfHigh || isHalfElfHigh;
  if (isHighElf) {
    ability = "int";
    title = matchedSpec
      ? `${matchedSpec.title} & Cantrip`
      : isElfHigh
        ? "High Elf Cantrip"
        : "Half-Elf Cantrip";
    // Check ruleChoices or knownSpells
    const highElfPick = character.ruleChoices?.find(
      (r) => r.id === "PHB__Elf__PHB__High Elf__Cantrip" || r.id.includes("High Elf")
    )?.picked?.[0];

    const cantripName = highElfPick || (character.knownSpells?.find(k => k.ownerKey === "racial__innate")?.name);
    if (cantripName && !spells.some(s => s.name.toLowerCase() === cantripName.toLowerCase())) {
      spells.push({
        name: cantripName,
        level: 0,
        minCharacterLevel: 1,
        castingTime: "1 action",
        source: "PHB",
        isCantrip: true,
      });
    }
  }

  if (spells.length === 0) return null;

  const abilityMod = modifiers[ability] ?? 0;
  const spellSaveDc = 8 + pb + abilityMod;
  const spellAttackBonus = pb + abilityMod;

  return {
    title,
    ability,
    spellSaveDc,
    spellAttackBonus,
    spells,
  };
}
