import type { BackgroundData, ClassData, FeatData, ProficiencyGrant, RaceData } from "../src/types/dnd5e.ts";

/**
 * Invented catalog records for the Proficiency Sheet tests. Names, languages, tools and text are
 * made up on purpose: no real 5e prose and no real rule text in fixtures.
 */

/**
 * The fixed grant a record's own list gives, as the scraper writes it: one fixed grant of the category,
 * with the record's own owner and level 0. Absent when the list is empty.
 */
const fixedGrantOf = (source: string, owner: string, feature: string, category: "tools" | "languages", names: string[]): ProficiencyGrant[] =>
  names.length > 0 ? [{ id: `${source}/${owner}/${feature}@0#0`, kind: "fixed", category, names }] : [];

export const vellariRace = (overrides: Partial<RaceData> = {}): RaceData => {
  const record: RaceData = {
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
  };
  return {
    ...record,
    grants: overrides.grants ?? fixedGrantOf(record.source, "Race", record.name, "languages", record.languages),
  };
};

export const lamplighterBackground = (overrides: Partial<BackgroundData> = {}): BackgroundData => {
  const record: BackgroundData = {
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
  };
  return {
    ...record,
    grants: overrides.grants ?? [
      ...fixedGrantOf(record.source, "Background", record.name, "tools", record.toolProficiencies),
      ...fixedGrantOf(record.source, "Background", record.name, "languages", record.languages),
    ],
  };
};

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

/** A Proficiency Choice. The sheet counts it only through the player's picks. */
export const anyLanguageChoice = (id: string, count: number): ProficiencyGrant => ({
  id,
  kind: "choice",
  category: "languages",
  count,
  pool: { kind: "any" },
});
