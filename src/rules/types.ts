import type { InventoryItem } from "../types/character.ts";
import type { RaceData, ClassData, BackgroundData, FeatData, InitiativeBonus, ProficiencyGrant, AdditionalSpells } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";

export interface ResolvedAncestry {
  race?: { name?: string; abilityScoreIncrease?: Record<string, number>[]; speed?: { walk?: number; swim?: number; climb?: number; fly?: number }; traits?: { name: string; description?: string; text?: any }[]; additionalSpells?: AdditionalSpells[] };
  subrace?: { name?: string; abilityScoreIncrease?: Record<string, number>[]; speed?: { walk?: number; swim?: number; climb?: number; fly?: number }; traits?: { name: string; description?: string; text?: any }[]; additionalSpells?: AdditionalSpells[] };
}
// Structural extension until Task 3 persists normalized equipment mechanics.
export type ArmorItem = InventoryItem & { armorCategory?: string };
export interface RulesOptions extends ResolvedAncestry {
  items?: ArmorItem[];
  races?: RaceData[];
  /** Resolves races by name when no race is given. Defaults to the process-wide current Compendium. */
  compendium?: Compendium;
}
export interface FeatureCatalog {
  races: RaceData[];
  classes: ClassData[];
  backgrounds: BackgroundData[];
  feats: FeatData[];
}
export interface FeatureInstance {
  id: string;
  name: string;
  source: string;
  description: string;
  origin: "Race" | "Subrace" | "Background" | "Class" | "Subclass" | "Feat";
  className?: string;
  /** The subclass a Subclass feature belongs to. Absent on every other origin. */
  subclassName?: string;
  /** The level a class or subclass feature is gained at. Absent on race, background and feat features. */
  level?: number;
  max?: number;
  resetOn?: "short" | "long";
  attacks?: number;
  /** The Rule Choice option this feature's trait resolves to, when one is chosen. */
  chosenOption?: string;
  /** Proficiency Grants the feature carries from the Catalog (ADR 0015). Absent when it grants none. */
  grants?: ProficiencyGrant[];
  /** The Initiative Bonus the feature carries from the Catalog (ADR 0016). Absent when it gives none. */
  initiativeBonus?: InitiativeBonus;
}
