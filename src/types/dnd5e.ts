import type { InitiativeBonus, ProficiencyGrant } from "../../dnd5eToolsScrap/src/types/proficiency.ts";
import type { StartingEquipmentSlot } from "../../dnd5eToolsScrap/src/types/startingEquipment.ts";

export type {
  GrantRequirement,
  InitiativeBonus,
  ProficiencyCategory,
  ProficiencyGrant,
  ProficiencyGrantSpec,
  ProficiencyPool,
} from "../../dnd5eToolsScrap/src/types/proficiency.ts";

export type {
  StartingEquipmentEntry,
  StartingEquipmentItem,
  StartingEquipmentOption,
  StartingEquipmentSlot,
  StartingEquipmentType,
  StartingEquipmentUnrecognised,
} from "../../dnd5eToolsScrap/src/types/startingEquipment.ts";

export interface TraitChoiceData {
  /** How many options the player must pick. */
  pick: number;
  /** Character level at which the choice becomes available. */
  level: number;
  /** Set when the chosen option's effect only applies from a later level. */
  effectLevel?: number;
  /** The feature this choice replaces, when the catalog marks one. */
  replaces?: string;
  options: { name: string; description: string }[];
}

export interface TraitData {
  name: string;
  description: string;
  /** Present when this trait grants a pick from a fixed set of options. */
  choice?: TraitChoiceData;
  /** The Initiative Bonus the trait gives (ADR 0016). Absent when it gives none. */
  initiativeBonus?: InitiativeBonus;
}

export interface RaceData {
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
  abilityScoreIncrease: Record<string, number>[];
  darkvision: number | null;
  traits: TraitData[];
  languages: string[];
  /** Proficiency Grants from the race's structured proficiency fields. */
  grants?: ProficiencyGrant[];
  subraces: SubraceData[];
  description: string;
  rawEntries?: any[];
  /** The spells the race grants, as the source gives them (ADR 0017). Absent when it grants none. */
  additionalSpells?: AdditionalSpells[];
}

export interface SubraceData {
  name: string;
  /** True when this subrace is a rules variant of its ancestry. */
  isVariant?: boolean;
  source: string;
  raceName: string;
  raceSource: string;
  abilityScoreIncrease: Record<string, number>[];
  darkvision: number | null;
  speed?: { walk?: number; swim?: number; climb?: number; fly?: number };
  traits: TraitData[];
  /** Proficiency Grants from the subrace's structured proficiency fields. */
  grants?: ProficiencyGrant[];
  /** The spells the subrace grants, as the source gives them (ADR 0017). Absent when it grants none. */
  additionalSpells?: AdditionalSpells[];
  description: string;
  rawEntries?: any[];
}

/** One option a feature lets the player pick. `source` is the book it is printed in. */
export interface ChoiceOption {
  name: string;
  description: string;
  source?: string;
  /** The level the option feature is gained at. */
  level?: number;
  /** The option's own Proficiency Grants, applying while the parent's pick names this option. */
  grants?: ProficiencyGrant[];
}

/** A pick from a fixed set of options a feature grants. `from` is the raw filter for cantrip-style lists. */
export interface FeatureChoice {
  pick: number;
  options?: ChoiceOption[];
  from?: { filter: string; count?: number };
}

export interface ClassFeatureData {
  name: string;
  level: number;
  description: string;
  isOptional?: boolean;
  /** Present when the scraped feature grants a pick from its option features. */
  choices?: FeatureChoice;
  /** Proficiency Grants extracted from the feature's prose, or from its override. */
  grants?: ProficiencyGrant[];
  /** The Initiative Bonus the feature gives (ADR 0016). Absent when it gives none. */
  initiativeBonus?: InitiativeBonus;
}

/**
 * One spell grant of a subclass, feat, race or background, as the source gives it. `ability` is the casting ability: a fixed
 * key, `inherit` (the ability the feat's increase raised) or a `choose` list. A `choose` object inside a spell list is a pick.
 */
export interface AdditionalSpells {
  name?: string;
  ability?: string | { choose: string[] };
  /** Always-prepared spells, keyed by character level, `_`, or `sN` (a spell slot level). Each key holds names, `daily` or `will` groups, or picks. */
  prepared?: Record<string, any>;
  /** Per spell level: a list of spell names, or a `_` list of `choose` filters (cantrip lists). */
  known?: Record<string, any>;
  expanded?: Record<string, any>;
  innate?: Record<string, any>;
  /** The Rule Choice option this grant waits on: the grant is read only while the player picked it (ADR 0014). Set by a reviewed gate. */
  gatedBy?: { choiceId: string; option: string };
  /** The level each named spell is cast at where the source's `#N` suffix gives one, keyed by the lower-case spell name. */
  castLevels?: Record<string, number>;
}

export interface SubclassData {
  name: string;
  shortName: string;
  source: string;
  className: string;
  classSource: string;
  spellcastingAbility?: string;
  features: ClassFeatureData[];
  additionalSpells?: AdditionalSpells[];
  /** Present when the additional spells grant a pick between named options, lifted from them. */
  spellChoice?: FeatureChoice;
  description: string;
}

export type Subclass = SubclassData;

export interface ClassData {
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
  features: ClassFeatureData[];
  subclasses: SubclassData[];
  /** Proficiency Grants from the class's starting proficiencies. */
  grants?: ProficiencyGrant[];
  multiclassing?: {
    requirements?: Record<string, number>;
    proficienciesGained?: {
      /** A plain token ("light", "shield") or an object whose `proficiency` is the token, with the full text in `full`. */
      armor?: (string | { proficiency: string; full?: string })[];
      weapons?: string[];
      tools?: string[];
      skills?: any;
    };
  };
  description: string;
}

export interface FeatData {
  name: string;
  source: string;
  prerequisite: string | null;
  abilityScoreIncrease: Record<string, number>[] | null;
  description: string;
  rawEntries?: any[];
  /** Proficiency Grants extracted from the feat's prose, or from its override. */
  grants?: ProficiencyGrant[];
  /** The Initiative Bonus the feat gives (ADR 0016). Absent when it gives none. */
  initiativeBonus?: InitiativeBonus;
  /** The spells the feat grants (ADR 0017). Absent when it grants none. */
  additionalSpells?: AdditionalSpells[];
}

export interface BackgroundData {
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
    personalityTraits?: { roll: string; text: string }[];
    ideals?: { roll: string; text: string }[];
    bonds?: { roll: string; text: string }[];
    flaws?: { roll: string; text: string }[];
  };
  description: string;
  rawEntries?: any[];
  /** The expanded spell lists the background adds to a spellcasting class's list (ADR 0017). Absent when none. */
  additionalSpells?: AdditionalSpells[];
}

export interface ItemData {
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

export interface SpellClassVariant {
  name: string;
  source: string;
  definedInSource: string;
}

export interface SpellData {
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
  classVariants?: SpellClassVariant[];
  subclasses: string[];
  damageTypes: string[];
  savingThrows: string[];
  description: string;
  higherLevels: string | null;
  /** The kinds of attack roll the spell needs: "M" melee, "R" ranged, "O" other. Absent when it needs none. */
  spellAttack?: string[];
  rawEntries?: any[];
  isReplaced?: boolean;
  originalName?: string;
  kiCost?: number;
}

export interface ConditionData {
  name: string;
  source: string;
  description: string;
  rawEntries?: any[];
}

export interface OptionFeatureData {
  name: string;
  source: string;
  category: string;
  featureType: string[];
  prerequisite: string | null;
  description: string;
  rawEntries?: any[];
  /** Set on a record that carries replicable-item tables; it is not a selectable option. */
  isUmbrella?: boolean;
}

export interface BeastAction {
  name: string;
  description: string;
  attackBonus?: number;
  damageDice?: string;
  damageType?: string;
}

export interface BeastTrait {
  name: string;
  description: string;
}

export interface BeastData {
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
  traits?: BeastTrait[];
  actions?: BeastAction[];
  isElementalWildShape?: boolean;
}
