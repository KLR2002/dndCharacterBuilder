import type { ActiveBooks } from "../constants/books.ts";
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
  OriginRuleRecord,
} from "../types/dnd5e.ts";
import { isCatalogStale, type CompendiumCollections } from "./compendiumStorage.ts";
import { findHeldRace, type HeldRace } from "../rules/raceLookup.ts";
import { SRD_SOURCE } from "../constants/books.ts";

/** Read-only, synchronous view over one catalog bundle (SRD Baseline or Integrated Catalog). */
export interface CompendiumListings {
  races(): RaceData[];
  classes(): ClassData[];
  feats(): FeatData[];
  backgrounds(): BackgroundData[];
  items(): ItemData[];
  spells(): SpellData[];
  beasts(): BeastData[];
  /** Conditions are never scoped by active books. */
  conditions(): ConditionData[];
  optionsAndFeatures(): OptionFeatureData[];
  originRules(): OriginRuleRecord[];
}

export interface Compendium {
  readonly integrated: boolean;
  /** True when the integrated catalog is below the format the application requires. Its records still load. */
  readonly stale: boolean;
  /** Listings scoped to active books. Unscoped when no books are given or the bundle is not integrated. */
  for(activeBooks?: readonly string[]): CompendiumListings;
  /** The race a held race resolves to, subrace included: the saved source's record, else an active book's (see findHeldRace). */
  findRace(held: HeldRace, activeBooks: ActiveBooks): RaceData | undefined;
  /** The other name lookups are never scoped, so existing character picks always resolve. */
  findClass(name: string, source?: string): ClassData | undefined;
  findSpell(name: string, source?: string): SpellData | undefined;
  findItem(name: string, source?: string): ItemData | undefined;
  findBackground(name: string, source?: string): BackgroundData | undefined;
  findBeast(name: string, source?: string): BeastData | undefined;
}

type Sourced = { readonly source: string };

interface Resolved<T> {
  readonly records: T[];
  /** True when the records came from the SRD Baseline because the integrated collection was missing or empty. */
  readonly fromBaseline: boolean;
}

// Integrated mode: the SRD records are stripped from integrated collections, and a missing or
// empty collection falls back to the SRD Baseline for that collection only.
function resolve<T extends Sourced>(
  integrated: boolean,
  own: readonly T[] | undefined,
  baselineRecords: readonly T[],
): Resolved<T> {
  if (!integrated) return { records: [...(own ?? [])], fromBaseline: false };
  if (own?.length) return { records: own.filter((r) => r.source !== SRD_SOURCE), fromBaseline: false };
  return { records: [...baselineRecords], fromBaseline: true };
}

// Inside a stripped integrated collection no record is "SRD", so the SRD clause only applies to
// records that came from the baseline fallback.
function admitter(activeBooks: readonly string[], fromBaseline: boolean): (source: string) => boolean {
  const books = new Set(activeBooks);
  return (source) => books.has(source) || (fromBaseline && source === SRD_SOURCE);
}

function findIn<T extends { name: string; source: string }>(records: T[], name: string, source?: string): T | undefined {
  return records.find((r) => r.name === name && (!source || r.source === source));
}

export function createCompendium(
  bundle: CompendiumCollections,
  baseline: CompendiumCollections = SRD_BASELINE,
): Compendium {
  const integrated = bundle.hasIntegratedCatalog;
  const races = resolve(integrated, bundle.races, baseline.races);
  const classes = resolve(integrated, bundle.classes, baseline.classes);
  const feats = resolve(integrated, bundle.feats, baseline.feats);
  const backgrounds = resolve(integrated, bundle.backgrounds, baseline.backgrounds);
  const items = resolve(integrated, bundle.items, baseline.items);
  const spells = resolve(integrated, bundle.spells, baseline.spells);
  const beasts = resolve(integrated, bundle.beasts, baseline.beasts);
  const conditions = resolve(integrated, bundle.conditions, baseline.conditions);
  const optionsAndFeatures = resolve(integrated, bundle.optionsAndFeatures, baseline.optionsAndFeatures);
  const originRules = resolve(integrated, bundle.originRules, baseline.originRules ?? []);

  const unscoped: CompendiumListings = {
    races: () => races.records,
    classes: () => classes.records,
    feats: () => feats.records,
    backgrounds: () => backgrounds.records,
    items: () => items.records,
    spells: () => spells.records,
    beasts: () => beasts.records,
    conditions: () => conditions.records,
    optionsAndFeatures: () => optionsAndFeatures.records,
    originRules: () => originRules.records,
  };

  function scoped(activeBooks: readonly string[]): CompendiumListings {
    const admitRace = admitter(activeBooks, races.fromBaseline);
    const admitClass = admitter(activeBooks, classes.fromBaseline);
    const admitFeat = admitter(activeBooks, feats.fromBaseline);
    const admitBackground = admitter(activeBooks, backgrounds.fromBaseline);
    const admitItem = admitter(activeBooks, items.fromBaseline);
    const admitSpell = admitter(activeBooks, spells.fromBaseline);
    const admitBeast = admitter(activeBooks, beasts.fromBaseline);
    const admitOption = admitter(activeBooks, optionsAndFeatures.fromBaseline);
    const admitOrigin = admitter(activeBooks, originRules.fromBaseline);
    return {
      ...unscoped,
      races: () =>
        races.records
          .filter((r) => admitRace(r.source))
          .map((r) => ({ ...r, subraces: (r.subraces || []).filter((sr) => admitRace(sr.source)) })),
      classes: () =>
        classes.records
          .filter((c) => admitClass(c.source))
          .map((c) => ({ ...c, subclasses: (c.subclasses || []).filter((sc) => admitClass(sc.source)) })),
      feats: () => feats.records.filter((f) => admitFeat(f.source)),
      backgrounds: () => backgrounds.records.filter((b) => admitBackground(b.source)),
      items: () => items.records.filter((i) => !i.source || admitItem(i.source)),
      spells: () => spells.records.filter((s) => admitSpell(s.source)),
      beasts: () => beasts.records.filter((b) => admitBeast(b.source)),
      optionsAndFeatures: () => optionsAndFeatures.records.filter((o) => admitOption(o.source)),
      originRules: () => originRules.records.filter((o) => admitOrigin(o.source)),
    };
  }

  return {
    integrated,
    stale: isCatalogStale(bundle),
    for: (activeBooks) => (!activeBooks || !integrated ? unscoped : scoped(activeBooks)),
    findRace: (held, activeBooks) => findHeldRace(races.records, held, activeBooks).race,
    findClass: (name, source) => findIn(classes.records, name, source),
    findSpell: (name, source) => findIn(spells.records, name, source),
    findItem: (name, source) => findIn(items.records, name, source),
    findBackground: (name, source) => findIn(backgrounds.records, name, source),
    findBeast: (name, source) => findIn(beasts.records, name, source),
  };
}

const SRD_BASELINE: CompendiumCollections = {
  hasIntegratedCatalog: false,
  races: racesRaw as unknown as RaceData[],
  classes: classesRaw as unknown as ClassData[],
  feats: featsRaw as unknown as FeatData[],
  backgrounds: backgroundsRaw as unknown as BackgroundData[],
  items: itemsRaw as unknown as ItemData[],
  spells: spellsRaw as unknown as SpellData[],
  beasts: beastsRaw as unknown as BeastData[],
  conditions: conditionsRaw as unknown as ConditionData[],
  optionsAndFeatures: optionsRaw as unknown as OptionFeatureData[],
  books: [],
  originRules: [],
};

/** The SRD Baseline's classes, the fallback for a held class the active catalog lacks. */
export function srdBaselineClasses(): readonly ClassData[] {
  return SRD_BASELINE.classes;
}

/** The SRD Baseline's races, the reference for which races the race picker offers a plain form. */
export function srdBaselineRaces(): readonly RaceData[] {
  return SRD_BASELINE.races;
}

const srdCompendium = createCompendium(SRD_BASELINE);
let current: Compendium = srdCompendium;

// Process-wide default. Only this module changes it.

export function currentCompendium(): Compendium {
  return current;
}

export function integrate(bundle: CompendiumCollections): void {
  current = bundle.hasIntegratedCatalog ? createCompendium(bundle, SRD_BASELINE) : srdCompendium;
}

export function revertToSrd(): void {
  current = srdCompendium;
}
