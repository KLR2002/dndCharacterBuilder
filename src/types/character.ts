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
  subclass?: string;
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
  /** The trait that grants the choice, so consumers need not parse the id. */
  trait: string;
  /** "feat" is only ever offered for Proficiency Choices, which are stored outside ruleChoices. */
  origin: "race" | "class" | "subclass" | "feat";
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

export interface RitualBookEntry {
  name: string;
  source: string;
  level: number;
  isStarting?: boolean;
}

export interface KnownSpell {
  name: string;
  source: string;
  ownerKey: string; // `${className}__${source}`
  className?: string; // Legacy display/ownership hint, retained during migration.
  ability?: AbilityKey;
}

export interface LegacyKnownSpell {
  name: string;
  source: string;
  className?: string;
  ownerKey?: string;
  ability?: AbilityKey;
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
  infusedWith?: string;
  isInfused?: boolean;
  rarity?: string;
  attunement?: boolean | string;
  isAttuned?: boolean;
  bonusWeapon?: number;
  bonusAc?: number;
  itemCategory?: string;
}

export interface ResourceCounter {
  id: string;
  name: string;
  current: number;
  max: number;
  resetOn: "short" | "long";
}

export interface ActiveWildShape {
  name: string;
  source: string;
  currentHp: number;
  maxHp: number;
  ac: number;
  /** Temporary HP held by the form. Absent on saves from before it existed, which counts as 0. */
  tempHp?: number;
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
  /** Legacy: saved by older builds and no longer written or read. The Proficiency Sheet derives languages. */
  languages?: string[];
  // Added Proficiencies: tools and languages the player records by hand (GLOSSARY).
  addedTools?: string[];
  addedLanguages?: string[];
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
  /**
   * Picks made for Proficiency Choices (ADR 0015), keyed by the choice's Proficiency Grant id. Never
   * rewritten into or out of the race, background and class buckets above; released by the reconciler
   * when the grant no longer applies.
   */
  proficiencyPicks?: Record<string, string[]>;
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
  originFeats?: AsiSelection[];

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
  subclassSpellSwaps?: Record<string, string>;
  ritualBook?: RitualBookEntry[];
  mysticArcanumSpent?: Record<number, boolean>;
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
  favoriteWildShapes?: string[];
  activeWildShape?: ActiveWildShape | null;
  activeInfusions?: { infusionName: string; targetItemId?: string; targetItemName?: string }[];

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
