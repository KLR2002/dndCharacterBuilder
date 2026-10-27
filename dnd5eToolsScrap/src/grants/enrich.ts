import {
  newProficiencyReport,
  resolveFeatureGrants,
  startingToolGrants,
  unmatchedOverrides,
  type GrantOverride,
} from "../parser/proficiency-grants.ts";
import { resolveInitiativeBonuses, type InitiativeBonusOverride } from "../parser/initiative-bonuses.ts";
import { featKey } from "../scrapers/feats.ts";
import { spellKey } from "../scrapers/spells.ts";
import { raceKey, subraceKey } from "../scrapers/races.ts";
import { backgroundKey } from "../scrapers/backgrounds.ts";
import type { AdditionalSpells } from "../types/models.ts";
import {
  allRefs,
  classFeatureOnlyRefs,
  classFeatureRefs,
  featRefs,
  traitRefs,
  type GrantRef,
  type TrackedBackground,
  type TrackedClass,
  type TrackedData,
  type TrackedFeat,
  type TrackedRace,
} from "./subjects.ts";

/**
 * Reviewed overrides, one list per tracked file. Matches the shape of PROFICIENCY_GRANT_OVERRIDES. The Initiative Bonus
 * overrides are optional: a caller that enriches only grants leaves them out.
 */
export interface GrantOverrides {
  classes: GrantOverride[];
  feats: GrantOverride[];
  initiativeBonuses?: InitiativeBonusOverride[];
}

/** The text of the tracked files this tooling enriches. `races` is optional: a caller that enriches only classes and feats leaves it out. */
export interface TrackedFiles {
  classes: string;
  feats: string;
  races?: string;
  backgrounds?: string;
}

/**
 * Adds, replaces or removes the `grants` field on every tracked class feature,
 * subclass feature and feat, and the `initiativeBonus` field on every class
 * feature, subclass feature, feat and race or subrace trait, using the same
 * extractors and overrides as the scraper. When the raw feats' spell grants are
 * given, it also sets or removes each feat's `additionalSpells` (ADR 0017).
 * Nothing else on the data is touched.
 */
function enrichTrackedData(
  data: TrackedData,
  overrides: GrantOverrides,
  featSpells?: Map<string, AdditionalSpells[]>,
  backgroundSpells?: Map<string, AdditionalSpells[]>,
  raceSpells?: Map<string, AdditionalSpells[]>,
): void {
  const classes = classFeatureRefs(data.classes);
  const feats = featRefs(data.feats);
  const features = classFeatureOnlyRefs(data.classes);
  const traits = data.races ? traitRefs(data.races) : [];
  const initiativeBonuses = overrides.initiativeBonuses ?? [];
  // The tracked files hold every class and feat, so an override that names none of them is stale.
  requireEveryOverridePlaced(classes, overrides.classes);
  requireEveryOverridePlaced(feats, overrides.feats);
  const initiativeRefs = [...features, ...feats, ...traits];
  requireEveryInitiativeOverridePlaced(initiativeRefs, initiativeBonuses);
  applyGrants(classes, overrides.classes);
  applyGrants(feats, overrides.feats);
  applyInitiativeBonuses(initiativeRefs, initiativeBonuses);
  applyStartingToolGrants(data.classes);
  if (featSpells) applyFeatSpells(data.feats, featSpells);
  if (backgroundSpells && data.backgrounds) applyBackgroundSpells(data.backgrounds, backgroundSpells);
  if (raceSpells && data.races) applyRaceSpells(data.races, raceSpells);
}

/** Writes each feat's spell grants from the raw feats file, or removes a stale one. */
function applyFeatSpells(feats: TrackedFeat[], featSpells: Map<string, AdditionalSpells[]>): void {
  for (const feat of feats) {
    const spells = featSpells.get(featKey(feat.name, feat.source));
    if (spells) feat.additionalSpells = spells;
    else delete feat.additionalSpells;
  }
}

/** Writes each race's and subrace's spell grants from the raw races file, or removes a stale one (ADR 0017). */
function applyRaceSpells(races: TrackedRace[], raceSpells: Map<string, AdditionalSpells[]>): void {
  for (const race of races) {
    const spells = raceSpells.get(raceKey(race.name, race.source));
    if (spells) race.additionalSpells = spells;
    else delete race.additionalSpells;
    for (const sub of race.subraces) {
      const subSpells = raceSpells.get(subraceKey(race.name, race.source, sub.name, sub.source));
      if (subSpells) sub.additionalSpells = subSpells;
      else delete sub.additionalSpells;
    }
  }
}

/** Writes each background's expanded spell lists from the raw backgrounds file, or removes a stale one. */
function applyBackgroundSpells(backgrounds: TrackedBackground[], spellsByBackground: Map<string, AdditionalSpells[]>): void {
  for (const background of backgrounds) {
    const spells = spellsByBackground.get(backgroundKey(background.name, background.source));
    if (spells) background.additionalSpells = spells;
    else delete background.additionalSpells;
  }
}

function requireEveryInitiativeOverridePlaced(refs: GrantRef[], overrides: InitiativeBonusOverride[]): void {
  const [stale] = unmatchedOverrides(refs.map((ref) => ref.subject), overrides);
  if (stale) throw new Error(`initiative bonus override matches no feature: ${stale.owner}|${stale.feature}|${stale.level}`);
}

/** Writes each class, subclass or feat's Initiative Bonus, or removes a stale one. */
function applyInitiativeBonuses(refs: GrantRef[], overrides: InitiativeBonusOverride[]): void {
  const bonuses = resolveInitiativeBonuses(refs.map((ref) => ref.subject), overrides, newProficiencyReport());
  bonuses.forEach((bonus, i) => {
    const holder = refs[i].holder;
    if (bonus) holder.initiativeBonus = bonus;
    else delete holder.initiativeBonus;
  });
}

/**
 * Sets each class's "Starting Proficiencies" grants from its starting tool texts, as the class scraper does.
 * A class whose tool texts state no grant gets none; the scraper reports those texts when it runs.
 */
function applyStartingToolGrants(classes: TrackedClass[]): void {
  for (const cls of classes) {
    const { grants } = startingToolGrants(
      { source: cls.source, owner: cls.name, feature: "Starting Proficiencies", level: 1 },
      cls.toolProficiencies ?? []
    );
    if (grants.length > 0) cls.grants = grants;
    else delete cls.grants;
  }
}

function requireEveryOverridePlaced(refs: GrantRef[], overrides: GrantOverride[]): void {
  const [stale] = unmatchedOverrides(refs.map((ref) => ref.subject), overrides);
  if (stale) throw new Error(`proficiency override matches no feature: ${stale.owner}|${stale.feature}|${stale.level}`);
}

/**
 * Enriches the text of the tracked files. Each file must already be in the
 * tracked format, so that writing it back reproduces every byte that the
 * enrichment did not change.
 */
export function enrichGrantFiles(
  files: TrackedFiles,
  overrides: GrantOverrides,
  featSpells?: Map<string, AdditionalSpells[]>,
  backgroundSpells?: Map<string, AdditionalSpells[]>,
  raceSpells?: Map<string, AdditionalSpells[]>,
): TrackedFiles {
  const data = readTracked(files);
  enrichTrackedData(data, overrides, featSpells, backgroundSpells, raceSpells);
  return writeTracked(data);
}

/**
 * Removes every `grants` and `initiativeBonus` field from features and feats, and every `initiativeBonus` from race and
 * subrace traits (their grants come from the scraper, not from this tooling). The inverse of enrichment on the same data.
 */
export function stripGrantFiles(files: TrackedFiles): TrackedFiles {
  const data = readTracked(files);
  for (const ref of allRefs(data)) {
    delete ref.holder.grants;
    delete ref.holder.initiativeBonus;
  }
  for (const cls of data.classes) delete cls.grants;
  for (const feat of data.feats) delete feat.additionalSpells;
  for (const race of data.races ?? []) {
    delete race.additionalSpells;
    for (const sub of race.subraces) delete sub.additionalSpells;
  }
  for (const background of data.backgrounds ?? []) delete background.additionalSpells;
  for (const ref of traitRefs(data.races ?? [])) delete ref.holder.initiativeBonus;
  return writeTracked(data);
}

function applyGrants(refs: GrantRef[], overrides: GrantOverride[]): void {
  const resolved = resolveFeatureGrants(
    refs.map((ref) => ref.subject),
    overrides,
    newProficiencyReport()
  );
  resolved.forEach((result, i) => {
    const holder = refs[i].holder;
    if (result.grants.length > 0) holder.grants = result.grants;
    else delete holder.grants;
  });
}

/** The tracked format: JSON.stringify with two-space indent and no trailing newline. */
function readTracked(files: TrackedFiles): TrackedData {
  return {
    classes: parseCanonical(files.classes, "classes.json") as TrackedClass[],
    feats: parseCanonical(files.feats, "feats.json") as TrackedFeat[],
    ...(files.races !== undefined ? { races: parseCanonical(files.races, "races.json") as TrackedRace[] } : {}),
    ...(files.backgrounds !== undefined
      ? { backgrounds: parseCanonical(files.backgrounds, "backgrounds.json") as TrackedBackground[] }
      : {}),
  };
}

function writeTracked(data: TrackedData): TrackedFiles {
  return {
    classes: canonical(data.classes),
    feats: canonical(data.feats),
    ...(data.races !== undefined ? { races: canonical(data.races) } : {}),
    ...(data.backgrounds !== undefined ? { backgrounds: canonical(data.backgrounds) } : {}),
  };
}

/**
 * Writes each tracked spell's attack-roll kinds from the raw spells (the scraper's `spellAttackMap`), or removes a stale one.
 * The field sits before the spell's raw entries, where the scraper puts it. Returns the text unchanged when nothing changes.
 */
export function enrichSpellAttacks(spellsText: string, attacks: Map<string, string[]>): string {
  const spells = parseCanonical(spellsText, "spells.json") as Array<Record<string, unknown>>;
  const enriched = spells.map((spell) => {
    const { spellAttack: _stale, rawEntries, ...rest } = spell;
    const kinds = attacks.get(spellKey(String(spell.name), String(spell.source)));
    return { ...rest, ...(kinds ? { spellAttack: kinds } : {}), ...(rawEntries !== undefined ? { rawEntries } : {}) };
  });
  return canonical(enriched);
}

function parseCanonical(text: string, name: string): unknown {
  const data: unknown = JSON.parse(text);
  if (canonical(data) !== text) {
    throw new Error(`${name} is not canonical tracked JSON (two-space indent, no trailing newline); refusing to rewrite it`);
  }
  return data;
}

function canonical(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
