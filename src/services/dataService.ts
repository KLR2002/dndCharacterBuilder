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

const racesData = racesRaw as unknown as RaceData[];
const classesData = classesRaw as unknown as ClassData[];
const featsData = featsRaw as unknown as FeatData[];
const backgroundsData = backgroundsRaw as unknown as BackgroundData[];
const itemsData = itemsRaw as unknown as ItemData[];
const spellsData = spellsRaw as unknown as SpellData[];
const conditionsData = conditionsRaw as unknown as ConditionData[];
const optionsData = optionsRaw as unknown as OptionFeatureData[];
const beastsData = beastsRaw as unknown as BeastData[];

export function getBeasts(activeBooks?: string[]): BeastData[] {
  if (!activeBooks) return beastsData;
  const set = new Set(activeBooks);
  return beastsData.filter((b) => set.has(b.source));
}

export function getRaces(activeBooks?: string[]): RaceData[] {
  if (!activeBooks) return racesData;
  const set = new Set(activeBooks);
  return racesData
    .filter((r) => set.has(r.source))
    .map((r) => ({
      ...r,
      subraces: (r.subraces || []).filter((sr) => set.has(sr.source)),
    }));
}

export function getClasses(activeBooks?: string[]): ClassData[] {
  if (!activeBooks) return classesData;
  const set = new Set(activeBooks);
  return classesData
    .filter((c) => set.has(c.source))
    .map((c) => ({
      ...c,
      subclasses: (c.subclasses || []).filter((sc) => set.has(sc.source)),
    }));
}

export function getFeats(activeBooks?: string[]): FeatData[] {
  if (!activeBooks) return featsData;
  const set = new Set(activeBooks);
  return featsData.filter((f) => set.has(f.source));
}

export function getBackgrounds(activeBooks?: string[]): BackgroundData[] {
  if (!activeBooks) return backgroundsData;
  const set = new Set(activeBooks);
  return backgroundsData.filter((b) => set.has(b.source));
}

export function getItems(activeBooks?: string[]): ItemData[] {
  if (!activeBooks) return itemsData;
  const set = new Set(activeBooks);
  return itemsData.filter((i) => !i.source || set.has(i.source));
}

export function getSpells(activeBooks?: string[]): SpellData[] {
  if (!activeBooks) return spellsData;
  const set = new Set(activeBooks);
  return spellsData.filter((s) => set.has(s.source));
}

export function getConditions(): ConditionData[] {
  return conditionsData;
}

export function getOptionsAndFeatures(activeBooks?: string[]): OptionFeatureData[] {
  if (!activeBooks) return optionsData;
  const set = new Set(activeBooks);
  return optionsData.filter((o) => set.has(o.source));
}

export function findRace(name: string, source?: string): RaceData | undefined {
  if (source) {
    return racesData.find((r) => r.name === name && r.source === source);
  }
  return racesData.find((r) => r.name === name);
}

export function findClass(name: string, source?: string): ClassData | undefined {
  if (source) {
    return classesData.find((c) => c.name === name && c.source === source);
  }
  return classesData.find((c) => c.name === name);
}

export function findSpell(name: string, source?: string): SpellData | undefined {
  if (source) {
    return spellsData.find((s) => s.name === name && s.source === source);
  }
  return spellsData.find((s) => s.name === name);
}

export function findItem(name: string, source?: string): ItemData | undefined {
  if (source) {
    return itemsData.find((i) => i.name === name && i.source === source);
  }
  return itemsData.find((i) => i.name === name);
}

export function findBackground(name: string, source?: string): BackgroundData | undefined {
  if (source) {
    return backgroundsData.find((b) => b.name === name && b.source === source);
  }
  return backgroundsData.find((b) => b.name === name);
}

export function findBeast(name: string, source?: string): BeastData | undefined {
  if (source) {
    return beastsData.find((b) => b.name === name && b.source === source);
  }
  return beastsData.find((b) => b.name === name);
}

