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
}

export interface SubraceModel {
  name: string;
  source: string;
  raceName: string;
  raceSource: string;
  abilityScoreIncrease: Array<Record<string, number>>;
  darkvision: number | null;
  traits: TraitModel[];
  description: string;
  rawEntries?: any[];
}

export interface ClassFeatureModel {
  name: string;
  level: number;
  description: string;
  isOptional?: boolean;
}

export interface SubclassModel {
  name: string;
  shortName: string;
  source: string;
  className: string;
  classSource: string;
  spellcastingAbility?: string;
  features: ClassFeatureModel[];
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
  features: ClassFeatureModel[];
  subclasses: SubclassModel[];
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
}

export interface OptionFeatureModel {
  name: string;
  source: string;
  category: string;
  featureType: string[];
  prerequisite: string | null;
  description: string;
  rawEntries?: any[];
}

export interface BackgroundModel {
  name: string;
  source: string;
  skillProficiencies: string[];
  toolProficiencies: string[];
  languages: string[];
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
  subclasses: string[];
  damageTypes: string[];
  savingThrows: string[];
  description: string;
  higherLevels: string | null;
  rawEntries?: any[];
}
