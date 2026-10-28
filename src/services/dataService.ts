import type {
  RaceData,
  ClassData,
  FeatData,
  BackgroundData,
  ItemData,
  SpellData,
  ConditionData,
  OptionFeatureData,
  BeastData,
} from "../types/dnd5e.ts";
import { currentCompendium } from "./compendium.ts";
import type { HeldRace } from "../rules/raceLookup.ts";

// Read facade over the Compendium owner in ./compendium.ts. Use `integrate` and `revertToSrd` from
// that module to change the active catalog, and take a Compendium (currentCompendium()) in new code.

export function isCompendiumIntegrated(): boolean {
  return currentCompendium().integrated;
}

export function getBeasts(activeBooks?: string[]): BeastData[] {
  return currentCompendium().for(activeBooks).beasts();
}

export function getRaces(activeBooks?: string[]): RaceData[] {
  return currentCompendium().for(activeBooks).races();
}

export function getClasses(activeBooks?: string[]): ClassData[] {
  return currentCompendium().for(activeBooks).classes();
}

export function getFeats(activeBooks?: string[]): FeatData[] {
  return currentCompendium().for(activeBooks).feats();
}

export function getBackgrounds(activeBooks?: string[]): BackgroundData[] {
  return currentCompendium().for(activeBooks).backgrounds();
}

export function getItems(activeBooks?: string[]): ItemData[] {
  return currentCompendium().for(activeBooks).items();
}

export function getSpells(activeBooks?: string[]): SpellData[] {
  return currentCompendium().for(activeBooks).spells();
}

export function getConditions(): ConditionData[] {
  return currentCompendium().for().conditions();
}

export function getOptionsAndFeatures(activeBooks?: string[]): OptionFeatureData[] {
  return currentCompendium().for(activeBooks).optionsAndFeatures();
}

export function findRace(held: HeldRace, activeBooks?: readonly string[]): RaceData | undefined {
  return currentCompendium().findRace(held, activeBooks);
}

export function findClass(name: string, source?: string): ClassData | undefined {
  return currentCompendium().findClass(name, source);
}

export function findSpell(name: string, source?: string): SpellData | undefined {
  return currentCompendium().findSpell(name, source);
}

export function findItem(name: string, source?: string): ItemData | undefined {
  return currentCompendium().findItem(name, source);
}

export function findBackground(name: string, source?: string): BackgroundData | undefined {
  return currentCompendium().findBackground(name, source);
}

export function findBeast(name: string, source?: string): BeastData | undefined {
  return currentCompendium().findBeast(name, source);
}
