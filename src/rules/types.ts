import type { InventoryItem } from "../types/character.ts";
import type { RaceData, ClassData, BackgroundData, FeatData } from "../types/dnd5e.ts";

export interface ResolvedAncestry {
  race?: { name?: string; abilityScoreIncrease?: Record<string, number>[]; speed?: { walk?: number; swim?: number; climb?: number; fly?: number }; traits?: { name: string; description?: string; text?: any }[] };
  subrace?: { name?: string; abilityScoreIncrease?: Record<string, number>[]; speed?: { walk?: number; swim?: number; climb?: number; fly?: number }; traits?: { name: string; description?: string; text?: any }[] };
}
// Structural extension until Task 3 persists normalized equipment mechanics.
export type ArmorItem = InventoryItem & { armorCategory?: string };
export interface RulesOptions extends ResolvedAncestry {
  items?: ArmorItem[];
  races?: RaceData[];
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
  max?: number;
  resetOn?: "short" | "long";
  attacks?: number;
  /** The Rule Choice option this feature's trait resolves to, when one is chosen. */
  chosenOption?: string;
}
