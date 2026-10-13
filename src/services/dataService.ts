import racesRaw from "../data/races.json" with { type: "json" };
import classesRaw from "../data/classes.json" with { type: "json" };
import featsRaw from "../data/feats.json" with { type: "json" };
import backgroundsRaw from "../data/backgrounds.json" with { type: "json" };
import itemsRaw from "../data/items.json" with { type: "json" };
import spellsRaw from "../data/spells.json" with { type: "json" };
import conditionsRaw from "../data/conditions.json" with { type: "json" };
import optionsRaw from "../data/options_and_features.json" with { type: "json" };
import beastsRaw from "../data/beasts.json" with { type: "json" };

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
import type { CompendiumCollections } from "./compendiumStorage.ts";
import { loadCompendiumData } from "./compendiumStorage.ts";

let activeCompendiumStore: CompendiumCollections | null = null;

export function isCompendiumIntegrated(): boolean {
  return Boolean(activeCompendiumStore && activeCompendiumStore.hasIntegratedCatalog);
}

export function setCompendiumStore(store: CompendiumCollections | null): void {
  activeCompendiumStore = store;
}

export async function initCompendiumStore(): Promise<void> {
  try {
    const data = await loadCompendiumData();
    if (data && data.hasIntegratedCatalog) {
      activeCompendiumStore = data;
    } else {
      activeCompendiumStore = null;
    }
  } catch {
    activeCompendiumStore = null;
  }
}

export function clearCompendiumStore(): void {
  activeCompendiumStore = null;
}

// Helpers to get current active dataset (swapping SRD baseline out when integrated)
function getRawRaces(): RaceData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.races?.length) {
    return activeCompendiumStore.races.filter((r) => r.source !== "SRD");
  }
  return racesRaw as unknown as RaceData[];
}

function getRawClasses(): ClassData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.classes?.length) {
    return activeCompendiumStore.classes.filter((c) => c.source !== "SRD");
  }
  return classesRaw as unknown as ClassData[];
}

function getRawFeats(): FeatData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.feats?.length) {
    return activeCompendiumStore.feats.filter((f) => f.source !== "SRD");
  }
  return featsRaw as unknown as FeatData[];
}

function getRawBackgrounds(): BackgroundData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.backgrounds?.length) {
    return activeCompendiumStore.backgrounds.filter((b) => b.source !== "SRD");
  }
  return backgroundsRaw as unknown as BackgroundData[];
}

function getRawItems(): ItemData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.items?.length) {
    return activeCompendiumStore.items.filter((i) => i.source !== "SRD");
  }
  return itemsRaw as unknown as ItemData[];
}

function getRawSpells(): SpellData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.spells?.length) {
    return activeCompendiumStore.spells.filter((s) => s.source !== "SRD");
  }
  return spellsRaw as unknown as SpellData[];
}

function getRawConditions(): ConditionData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.conditions?.length) {
    return activeCompendiumStore.conditions.filter((c) => c.source !== "SRD");
  }
  return conditionsRaw as unknown as ConditionData[];
}

function getRawOptions(): OptionFeatureData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.optionsAndFeatures?.length) {
    return activeCompendiumStore.optionsAndFeatures.filter((o) => o.source !== "SRD");
  }
  return optionsRaw as unknown as OptionFeatureData[];
}

function getRawBeasts(): BeastData[] {
  if (isCompendiumIntegrated() && activeCompendiumStore?.beasts?.length) {
    return activeCompendiumStore.beasts.filter((b) => b.source !== "SRD");
  }
  return beastsRaw as unknown as BeastData[];
}

export function getBeasts(activeBooks?: string[]): BeastData[] {
  const beasts = getRawBeasts();
  if (!activeBooks || !isCompendiumIntegrated()) return beasts;
  const set = new Set(activeBooks);
  return beasts.filter((b) => set.has(b.source) || b.source === "SRD");
}

export function getRaces(activeBooks?: string[]): RaceData[] {
  const races = getRawRaces();
  if (!activeBooks || !isCompendiumIntegrated()) return races;
  const set = new Set(activeBooks);
  return races
    .filter((r) => set.has(r.source) || r.source === "SRD")
    .map((r) => ({
      ...r,
      subraces: (r.subraces || []).filter((sr) => set.has(sr.source) || sr.source === "SRD"),
    }));
}

export function getClasses(activeBooks?: string[]): ClassData[] {
  const classes = getRawClasses();
  if (!activeBooks || !isCompendiumIntegrated()) return classes;
  const set = new Set(activeBooks);
  return classes
    .filter((c) => set.has(c.source) || c.source === "SRD")
    .map((c) => ({
      ...c,
      subclasses: (c.subclasses || []).filter((sc) => set.has(sc.source) || sc.source === "SRD"),
    }));
}

export function getFeats(activeBooks?: string[]): FeatData[] {
  const feats = getRawFeats();
  if (!activeBooks || !isCompendiumIntegrated()) return feats;
  const set = new Set(activeBooks);
  return feats.filter((f) => set.has(f.source) || f.source === "SRD");
}

export function getBackgrounds(activeBooks?: string[]): BackgroundData[] {
  const backgrounds = getRawBackgrounds();
  if (!activeBooks || !isCompendiumIntegrated()) return backgrounds;
  const set = new Set(activeBooks);
  return backgrounds.filter((b) => set.has(b.source) || b.source === "SRD");
}

export function getItems(activeBooks?: string[]): ItemData[] {
  const items = getRawItems();
  if (!activeBooks || !isCompendiumIntegrated()) return items;
  const set = new Set(activeBooks);
  return items.filter((i) => !i.source || i.source === "SRD" || set.has(i.source));
}

export function getSpells(activeBooks?: string[]): SpellData[] {
  const spells = getRawSpells();
  if (!activeBooks || !isCompendiumIntegrated()) return spells;
  const set = new Set(activeBooks);
  return spells.filter((s) => set.has(s.source) || s.source === "SRD");
}

export function getConditions(): ConditionData[] {
  return getRawConditions();
}

export function getOptionsAndFeatures(activeBooks?: string[]): OptionFeatureData[] {
  const options = getRawOptions();
  if (!activeBooks || !isCompendiumIntegrated()) return options;
  const set = new Set(activeBooks);
  return options.filter((o) => set.has(o.source) || o.source === "SRD");
}

export function findRace(name: string, source?: string): RaceData | undefined {
  const races = getRawRaces();
  if (source) {
    return races.find((r) => r.name === name && r.source === source);
  }
  return races.find((r) => r.name === name);
}

export function findClass(name: string, source?: string): ClassData | undefined {
  const classes = getRawClasses();
  if (source) {
    return classes.find((c) => c.name === name && c.source === source);
  }
  return classes.find((c) => c.name === name);
}

export function findSpell(name: string, source?: string): SpellData | undefined {
  const spells = getRawSpells();
  if (source) {
    return spells.find((s) => s.name === name && s.source === source);
  }
  return spells.find((s) => s.name === name);
}

export function findItem(name: string, source?: string): ItemData | undefined {
  const items = getRawItems();
  if (source) {
    return items.find((i) => i.name === name && i.source === source);
  }
  return items.find((i) => i.name === name);
}

export function findBackground(name: string, source?: string): BackgroundData | undefined {
  const backgrounds = getRawBackgrounds();
  if (source) {
    return backgrounds.find((b) => b.name === name && b.source === source);
  }
  return backgrounds.find((b) => b.name === name);
}

export function findBeast(name: string, source?: string): BeastData | undefined {
  const beasts = getRawBeasts();
  if (source) {
    return beasts.find((b) => b.name === name && b.source === source);
  }
  return beasts.find((b) => b.name === name);
}
