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
  /**
   * Whether a record from `source` is listed. A record with no source is admitted, and so is an `SRD` record.
   * Book codes compare without regard to case. The unscoped listings admit every source; an empty book list
   * admits no book. This is the one book-admission rule (ADR 0025).
   */
  admits(source?: string): boolean;
}

export interface Compendium {
  readonly integrated: boolean;
  /** True when the integrated catalog is below the format the application requires. Its records still load. */
  readonly stale: boolean;
  /** Listings scoped to active books. Unscoped when no books are given or the bundle is not integrated. */
  for(activeBooks?: readonly string[]): CompendiumListings;
  /** The race a held race resolves to, subrace included: the saved source's record, else an active book's (see findHeldRace). */
  findRace(held: HeldRace, activeBooks: ActiveBooks): RaceData | undefined;
  /**
   * The other name lookups are never scoped, so existing character picks always resolve. A spell or item name
   * with source SRD, or no source, also resolves to the record whose `srdName` it is.
   */
  findClass(name: string, source?: string): ClassData | undefined;
  findSpell(name: string, source?: string): SpellData | undefined;
  findItem(name: string, source?: string): ItemData | undefined;
  findBackground(name: string, source?: string): BackgroundData | undefined;
  findBeast(name: string, source?: string): BeastData | undefined;
}

type Sourced = { readonly source: string };

// Integrated mode: the SRD records are stripped from integrated collections, and a missing or
// empty collection falls back to the SRD Baseline for that collection only.
function resolve<T extends Sourced>(integrated: boolean, own: readonly T[] | undefined, baselineRecords: readonly T[]): T[] {
  if (!integrated) return [...(own ?? [])];
  if (own?.length) return own.filter((r) => r.source !== SRD_SOURCE);
  return [...baselineRecords];
}

// The book-admission rule (ADR 0025), shared by every scoped listing.
function bookAdmitter(activeBooks: readonly string[]): (source?: string) => boolean {
  const books = new Set(activeBooks.map((b) => b.toLowerCase()));
  return (source) => !source || source === SRD_SOURCE || books.has(source.toLowerCase());
}

// Computes the list on first call. Later calls return the same array, frozen at runtime, so a
// caller that mutates a listing throws; copy it first. The type stays mutable so callers need no change.
function once<T>(compute: () => T[]): () => T[] {
  let value: T[] | undefined;
  return () => {
    value ??= Object.freeze(compute()) as T[];
    return value;
  };
}

function findIn<T extends { name: string; source: string }>(records: T[], name: string, source?: string): T | undefined {
  return records.find((r) => r.name === name && (!source || r.source === source));
}

// A name saved from the SRD Baseline is the SRD's name. An Integrated Catalog prints some of those records under
// another name and records the SRD's as `srdName`, so an SRD-sourced or unsourced name also resolves through it.
function findNamedIn<T extends { name: string; source: string; srdName?: string }>(
  records: T[],
  name: string,
  source?: string,
): T | undefined {
  const found = findIn(records, name, source);
  if (found || (source && source !== SRD_SOURCE)) return found;
  return records.find((r) => r.srdName === name);
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
    races: () => races,
    classes: () => classes,
    feats: () => feats,
    backgrounds: () => backgrounds,
    items: () => items,
    spells: () => spells,
    beasts: () => beasts,
    conditions: () => conditions,
    optionsAndFeatures: () => optionsAndFeatures,
    originRules: () => originRules,
    admits: () => true,
  };

  function scoped(activeBooks: readonly string[]): CompendiumListings {
    const admits = bookAdmitter(activeBooks);
    return {
      ...unscoped,
      admits,
      races: once(() =>
        races
          .filter((r) => admits(r.source))
          .map((r) => ({ ...r, subraces: (r.subraces || []).filter((sr) => admits(sr.source)) })),
      ),
      classes: once(() =>
        classes
          .filter((c) => admits(c.source))
          .map((c) => ({ ...c, subclasses: (c.subclasses || []).filter((sc) => admits(sc.source)) })),
      ),
      feats: once(() => feats.filter((f) => admits(f.source))),
      backgrounds: once(() => backgrounds.filter((b) => admits(b.source))),
      items: once(() => items.filter((i) => admits(i.source))),
      spells: once(() => spells.filter((s) => admits(s.source))),
      beasts: once(() => beasts.filter((b) => admits(b.source))),
      optionsAndFeatures: once(() => optionsAndFeatures.filter((o) => admits(o.source))),
      originRules: once(() => originRules.filter((o) => admits(o.source))),
    };
  }

  // One listings object per book list (books in order, case-insensitive), so each scoped array is computed once.
  // The cache lives in this closure: a new Compendium starts empty.
  const scopedByBooks = new Map<string, CompendiumListings>();
  function scopedFor(activeBooks: readonly string[]): CompendiumListings {
    const key = activeBooks.map((b) => b.toLowerCase()).join("|");
    let listings = scopedByBooks.get(key);
    if (!listings) {
      listings = scoped(activeBooks);
      scopedByBooks.set(key, listings);
    }
    return listings;
  }

  return {
    integrated,
    stale: isCatalogStale(bundle),
    for: (activeBooks) => (!activeBooks || !integrated ? unscoped : scopedFor(activeBooks)),
    findRace: (held, activeBooks) => findHeldRace(races, held, activeBooks).race,
    findClass: (name, source) => findIn(classes, name, source),
    findSpell: (name, source) => findNamedIn(spells, name, source),
    findItem: (name, source) => findNamedIn(items, name, source),
    findBackground: (name, source) => findIn(backgrounds, name, source),
    findBeast: (name, source) => findIn(beasts, name, source),
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
