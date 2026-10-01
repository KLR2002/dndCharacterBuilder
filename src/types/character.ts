export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterClass {
  className: string;
  source: string;
  level: number;
  subclassName?: string;
  subclassSource?: string;
}

export interface SkillChoiceEntry {
  id: string;
  origin: "race" | "class" | "background";
  choose: number;
  from: string[];
  picked: string[];
}

export interface RuleChoiceEntry {
  /** Stable identity of the choice: source__race__subrace__trait. */
  id: string;
  origin: "race";
  choose: number;
  from: string[];
  picked: string[];
}

export interface ClassChoice {
  id: string;
  classId: string;
  classLevel: number;
  kind: "subclass" | "feat" | "expertise" | "asi" | "fightingStyle" | "invocation" | "metamagic";
  value?: string;
  featName?: string;
  featSource?: string;
  asi?: Record<string, number>;
}

export interface KnownSpell {
  name: string;
  source: string;
  ownerKey: string; // `${className}__${source}`
  className?: string; // Legacy display/ownership hint, retained during migration.
}

export interface LegacyKnownSpell {
  name: string;
  source: string;
  className?: string;
  ownerKey?: string;
}

export interface AsiSelection {
  level: number;
  className?: string;
  classLevel?: number;
  type: "asi" | "feat";
  asi?: Record<string, number>;
  featName?: string;
  featSource?: string;
  featAbility?: AbilityKey;
}

export interface InventoryItem {
  id: string;
  name: string;
  source: string;
  quantity: number;
  isEquipped: boolean;
  section: "equipped" | "carried";
  weight?: number | null;
  cost?: string | null;
  damage?: string | null;
  damageType?: string | null;
  range?: string | null;
  ac?: number | null;
  description?: string;
  isCustom?: boolean;
}

export interface ResourceCounter {
  id: string;
  name: string;
  current: number;
  max: number;
  resetOn: "short" | "long";
}

export interface Character {
  id: string;
  name: string;
  folderId: string | null;
  gender: string;
  alignment: string;
  faction: {
    name: string;
    rank: string;
    renown: string;
    notes: string;
  };
  avatarUri: string | null;
  createdAt: number;
  updatedAt: number;

  // Builder settings
  abilityMethod: "pointBuy" | "standardArray" | "manual";
  baseAbilityScores: AbilityScores;
  standardArrayPicks?: Partial<Record<AbilityKey, number>>;
  skillChoices?: SkillChoiceEntry[];
  ruleChoices?: RuleChoiceEntry[];
  racialChoiceBonus?: { key: AbilityKey; amount: number }[];
  classChoices?: ClassChoice[];
  needsReview?: string[];
  customLineage: boolean;
  lineageReplacement: string | null; // "Dhampir" | "Hexblood" | "Reborn" | null
  race: {
    name: string;
    source: string;
    subraceName?: string;
    subraceSource?: string;
  } | null;
  racialAbilityBonuses: Record<string, number>;
  background: {
    name: string;
    source: string;
    isCustom?: boolean;
    customName?: string;
    customFeatureName?: string;
    customFeatureDesc?: string;
  } | null;
  startingOption: "equipment" | "gold";
  startingGrantsApplied?: boolean;
  startingGrantedGold?: number;
  backgroundGrantsApplied?: boolean;
  languages?: string[];
  chosenLanguages?: {
    race?: string[];
    background?: string[];
  };
  chosenTools?: {
    race?: string[];
    background?: string[];
    class?: string[];
  };
  optionalFeatureReplacements?: Record<string, boolean>;
  multiclassProficiencies?: {
    className: string;
    armor?: string[];
    weapons?: string[];
    tools?: string[];
    skills?: string;
  }[];
  classes: CharacterClass[];
  chosenSkills: string[];
  chosenExpertise: string[];
  asiSelections: AsiSelection[];

  // Combat & Stats
  currentHp: number;
  maxHpOverride: number | null;
  tempHp: number;
  conditions: string[];
  usedHitDice: Record<string, number>;
  deathSaves: {
    successes: number;
    failures: number;
  };

  // Spells
  knownSpells?: (KnownSpell | LegacyKnownSpell)[];
  preparedSpells?: string[]; // `${name}__${source}__${ownerKey}` (legacy keys migrated on load)
  usedSpellSlots: Record<number, number>;
  pactSlotsUsed?: number;
  usedPactSlots?: number; // Legacy alias, preserved for old tabs until their migration.
  sorceryPointsUsed: number;
  chosenMetamagic: string[];
  metamagicOptions?: string[];

  // Inventory
  items: InventoryItem[];
  pouch: {
    cp: number;
    sp: number;
    ep: number;
    gp: number;
    pp: number;
  };
  useWeightLimit: boolean;

  // Feature resources
  resourceCounters: Record<string, ResourceCounter>;

  // Journal
  description: string;
  backstory: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
  notes: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}
