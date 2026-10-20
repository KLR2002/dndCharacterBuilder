import type { BackgroundData, ClassData, FeatData, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";

/**
 * Invented catalog records for the Proficiency Sheet tests. Names, languages, tools and text are
 * made up on purpose: no real 5e prose and no real rule text in fixtures.
 */

export const vellariRace = (overrides: Partial<RaceData> = {}): RaceData => ({
  name: "Vellari",
  source: "PHB",
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease: [],
  darkvision: null,
  traits: [],
  languages: ["Common", "Quoral"],
  subraces: [],
  description: "Placeholder description for the Vellari.",
  ...overrides,
});

export const lamplighterBackground = (overrides: Partial<BackgroundData> = {}): BackgroundData => ({
  name: "Lamplighter",
  source: "PHB",
  skillProficiencies: [],
  toolProficiencies: ["lantern kit"],
  languages: [],
  startingEquipment: [],
  feature: null,
  characteristics: {},
  description: "Placeholder description for the Lamplighter.",
  ...overrides,
});

export const wardenClass = (overrides: Partial<ClassData> = {}): ClassData => ({
  name: "Warden",
  source: "PHB",
  hitDie: "1d8",
  primaryAbility: [],
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillProficiencies: { choose: 2, from: [] },
  features: [],
  subclasses: [],
  description: "Placeholder description for the Warden.",
  ...overrides,
});

export const placeholderFeat = (overrides: Partial<FeatData> = {}): FeatData => ({
  name: "Placeholder Feat",
  source: "PHB",
  prerequisite: null,
  abilityScoreIncrease: null,
  description: "Placeholder description for the feat.",
  ...overrides,
});

/** A fixed Proficiency Grant as the scraper writes it, with an id in the scraper's shape. */
export const fixedGrant = (
  id: string,
  category: "tools" | "languages" | "skills" | "armor" | "weapons" | "savingThrows",
  names: string[],
): ProficiencyGrant => ({ id, kind: "fixed", category, names });

/** A Proficiency Choice, which the sheet ignores until the choice slice. */
export const anyLanguageChoice = (id: string, count: number): ProficiencyGrant => ({
  id,
  kind: "choice",
  category: "languages",
  count,
  pool: { kind: "any" },
});
