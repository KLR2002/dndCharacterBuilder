export interface RuleChoiceModel {
  /** How many options the player must pick. */
  pick: number;
  /** Character level at which the choice becomes available. */
  level: number;
  /** Set when the chosen option's effect only applies from a later level. */
  effectLevel?: number;
  /** The feature this choice replaces, when the source data marks one. */
  replaces?: string;
  options: Array<{ name: string; description: string }>;
}

import type { InitiativeBonus, ProficiencyGrant } from "./proficiency.ts";
import type { StartingEquipmentSlot } from "./startingEquipment.ts";

export interface TraitModel {
  name: string;
  description: string;
  /** Present when this trait grants a pick from a fixed set of options. */
  choice?: RuleChoiceModel;
}

export interface RaceModel {
  name: string;
  source: string;
  size: string[];
  speed: {
    walk: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
  };
  abilityScoreIncrease: Array<Record<string, number>>;
  darkvision: number | null;
  traits: TraitModel[];
  languages: string[];
  subraces: SubraceModel[];
  description: string;
  rawEntries?: any[];
  /** Proficiency Grants from the race's structured proficiency fields. */
  grants?: ProficiencyGrant[];
}

export interface SubraceModel {
  /** Proficiency Grants the subrace's structured proficiency entries give. Absent when it gives none. */
  grants?: ProficiencyGrant[];
  name: string;
  /** True when this subrace is a rules variant of its ancestry. */
  isVariant: boolean;
  source: string;
  raceName: string;
  raceSource: string;
  abilityScoreIncrease: Array<Record<string, number>>;
  darkvision: number | null;
  traits: TraitModel[];
  description: string;
  rawEntries?: any[];
}

/**
 * One option a feature lets the player pick. `source` is the book it is printed in, and `level` the level
 * its option feature is gained at. `grants` are the Proficiency Grants of the option's own text: they
 * apply only while the parent's pick names this option.
 */
export interface ChoiceOption {
  name: string;
  description: string;
  source?: string;
  level?: number;
  grants?: ProficiencyGrant[];
}

/** A pick from a fixed set of options a feature grants. `from` is the raw filter for cantrip-style lists. */
export interface FeatureChoice {
  pick: number;
  options?: ChoiceOption[];
  from?: { filter: string; count?: number };
}

export interface ClassFeatureModel {
  name: string;
  level: number;
  description: string;
  isOptional?: boolean;
  /** Present when the feature's raw `options` entry resolves to its option features. */
  choices?: FeatureChoice;
  /** Proficiency Grants extracted from the feature's prose, or from its override. */
  grants?: ProficiencyGrant[];
  /** The Initiative Bonus the feature's prose gives, or from its override (ADR 0016). */
  initiativeBonus?: InitiativeBonus;
}

export interface SubclassAdditionalSpells {
  prepared?: Record<string, string[]>;
  /** Per spell level: a list of spell names, or a `_` list of `choose` filters (cantrip lists). */
  known?: Record<string, any>;
  expanded?: Record<string, any>;
  innate?: Record<string, any>;
  name?: string;
}

export interface SubclassModel {
  name: string;
  shortName: string;
  source: string;
  className: string;
  classSource: string;
  spellcastingAbility?: string;
  features: ClassFeatureModel[];
  additionalSpells?: SubclassAdditionalSpells[];
  /** Present when the additional spells grant a pick between named options, lifted from them. */
  spellChoice?: FeatureChoice;
  description: string;
}

export interface ClassModel {
  name: string;
  source: string;
  hitDie: string;
  primaryAbility: string[];
  savingThrows: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillProficiencies: {
    choose: number;
    from: string[];
  };
  spellcasting?: {
    ability: string;
    progression: string;
    preparedSpells?: string;
  } | null;
  /** The starting equipment slots, in printed order. Absent for a class whose record carries none. */
  startingEquipment?: StartingEquipmentSlot[];
  features: ClassFeatureModel[];
  subclasses: SubclassModel[];
  /** Proficiency Grants from the class's starting proficiencies (the "Starting Proficiencies" grant owner). */
  grants?: ProficiencyGrant[];
  multiclassing?: {
    requirements?: Record<string, number>;
    proficienciesGained?: {
      armor?: string[];
      weapons?: string[];
      tools?: string[];
      skills?: any;
    };
  };
  description: string;
}

export interface FeatModel {
  name: string;
  source: string;
  prerequisite: string | null;
  abilityScoreIncrease: Array<Record<string, number>> | null;
  description: string;
  rawEntries?: any[];
  /** Proficiency Grants extracted from the feat's prose, or from its override. */
  grants?: ProficiencyGrant[];
  /** The Initiative Bonus the feat's prose gives, or from its override (ADR 0016). */
  initiativeBonus?: InitiativeBonus;
}

export interface OptionFeatureModel {
  name: string;
  source: string;
  category: string;
  featureType: string[];
  prerequisite: string | null;
  description: string;
  rawEntries?: any[];
  /** Set on a record that carries replicable-item tables; the app does not offer it as a selectable option. */
  isUmbrella?: boolean;
}

export interface BackgroundModel {
  name: string;
  source: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
  /** Proficiency Grants from the background's structured proficiency fields. */
  grants?: ProficiencyGrant[];
  startingEquipment: string[];
  feature: {
    name: string;
    description: string;
  } | null;
  characteristics: {
    personalityTraits?: Array<{ roll: string; text: string }>;
    ideals?: Array<{ roll: string; text: string }>;
    bonds?: Array<{ roll: string; text: string }>;
    flaws?: Array<{ roll: string; text: string }>;
  };
  description: string;
  rawEntries?: any[];
}

export interface ItemModel {
  name: string;
  source: string;
  type: string;
  itemCategory: string;
  rarity: string;
  attunement: boolean | string;
  cost: string | null;
  weight: number | null;
  damage: string | null;
  damageType: string | null;
  range: string | null;
  properties: string[];
  ac: number | null;
  strengthRequirement: number | null;
  stealthDisadvantage: boolean;
  description: string;
  rawEntries?: any[];
  bonusWeapon?: number;
  bonusAc?: number;
  /** Set on base weapons only: the simple or martial category the source data gives them. */
  weaponCategory?: "simple" | "martial";
}

export interface SpellClassVariantModel {
  name: string;
  source: string;
  definedInSource: string;
}

export interface SpellModel {
  name: string;
  source: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean | string;
  };
  componentsString: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string[];
  classVariants?: SpellClassVariantModel[];
  subclasses: string[];
  damageTypes: string[];
  savingThrows: string[];
  description: string;
  higherLevels: string | null;
  rawEntries?: any[];
}

export interface BeastActionModel {
  name: string;
  description: string;
  attackBonus?: number;
  damageDice?: string;
  damageType?: string;
}

export interface BeastTraitModel {
  name: string;
  description: string;
}

export interface BeastModel {
  name: string;
  source: string;
  size: string; // "Tiny" | "Small" | "Medium" | "Large" | "Huge" | "Gargantuan"
  type: "beast" | "elemental";
  cr: string;
  crNumeric: number;
  ac: number;
  hp: {
    average: number;
    formula: string;
  };
  speed: {
    walk?: number;
    swim?: number;
    fly?: number;
    climb?: number;
    burrow?: number;
  };
  abilities: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  senses?: string[];
  passivePerception?: number;
  skills?: Record<string, number>;
  traits?: BeastTraitModel[];
  actions?: BeastActionModel[];
  isElementalWildShape?: boolean;
}

export interface BookModel {
  name: string;
  id: string;
  source?: string;
  group?: string;
  published?: string;
  author?: string;
}

export interface ToolsClient {
  fetchJson<T>(endpoint: string, forceNetwork?: boolean): Promise<T>;
}

