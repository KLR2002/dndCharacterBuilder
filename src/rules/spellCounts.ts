import type { Character } from "../types/character.ts";
import type { SubclassData } from "../types/dnd5e.ts";
import type { CharacterCatalogs } from "./catalogs.ts";
import { allCatalogClasses } from "./catalogs.ts";
import { heldClass, THIRD_CASTERS } from "./classData.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import type { ClassSpellProfile } from "./spellcasting.ts";

const PACT_OF_THE_TOME_OWNER = "Warlock__Tome";

/** The per-level progressions a class's spellcasting or a subclass record carries. */
type CountedProgressions = Partial<Pick<SubclassData, "cantripsKnown" | "spellsKnown">> & { spellbookSpellsGained?: number[] };

export interface SpellCountPart {
  known: number;
  due: number;
}

export interface SpellCounts {
  cantrips: SpellCountPart | null;
  /** A Wizard's spellbook is a spell count of its own kind: due is the running total of its gains. */
  spells: (SpellCountPart & { kind: "known" | "spellbook" }) | null;
}

/** What a class level is due in cantrips and spells, as the Catalog gives it. A part is null when the Catalog has no number for it. */
export interface SpellsDue {
  cantrips: number | null;
  spells: { due: number; kind: "known" | "spellbook" } | null;
}

/** The class entry a due count is read on: its class, its subclass when it has one, and the class level. */
export interface SpellsDueEntry {
  className: string;
  source: string;
  subclassName?: string;
  level: number;
}

/**
 * What a class level is due, from the Catalog class or, for an Eldritch Knight or Arcane Trickster, from its subclass.
 * Both parts are null while the Catalog is stale, and at level 0 (no class yet).
 */
export function spellsDueAt(entry: SpellsDueEntry, catalogs?: CharacterCatalogs): SpellsDue {
  const compendium = catalogs?.compendium ?? currentCompendium();
  if (compendium.stale || entry.level < 1) return { cantrips: null, spells: null };

  const classRecord = heldClass({ className: entry.className, source: entry.source }, allCatalogClasses(catalogs));
  // An Eldritch Knight or Arcane Trickster counts by its subclass; every other caster by its class's spellcasting.
  const thirdCaster = entry.subclassName !== undefined && THIRD_CASTERS[entry.className] === entry.subclassName;
  const counted: CountedProgressions | undefined = thirdCaster
    ? classRecord?.subclasses.find((sc: SubclassData) => sc.name === entry.subclassName)
    : (classRecord?.spellcasting ?? undefined);

  const cantrips = dueAt(counted?.cantripsKnown, entry.level);
  const knownDue = dueAt(counted?.spellsKnown, entry.level);
  const spells = counted?.spellbookSpellsGained
    ? { due: runningTotal(counted.spellbookSpellsGained, entry.level), kind: "spellbook" as const }
    : knownDue === null ? null : { due: knownDue, kind: "known" as const };
  return { cantrips, spells };
}

/**
 * The cantrips and spells a class level gains: the due numbers at `toLevel` less those at `fromLevel`. A class with no
 * level yet (`fromLevel` 0) was due nothing. Null when the Catalog has no number for either part.
 */
export function spellsGainedAt(entry: Omit<SpellsDueEntry, "level">, fromLevel: number, toLevel: number, catalogs?: CharacterCatalogs): { cantrips: number; spells: number } | null {
  const to = spellsDueAt({ ...entry, level: toLevel }, catalogs);
  if (to.cantrips === null && to.spells === null) return null;
  const from = fromLevel === 0 ? { cantrips: null, spells: null } : spellsDueAt({ ...entry, level: fromLevel }, catalogs);
  return {
    cantrips: (to.cantrips ?? 0) - (from.cantrips ?? 0),
    spells: (to.spells?.due ?? 0) - (from.spells?.due ?? 0),
  };
}

/** A spell one class Spell Owner knows, with its level as the Compendium gives it (0 when the Compendium does not hold it). */
export interface OwnKnownSpell {
  name: string;
  source: string;
  level: number;
}

/**
 * The spells one class Spell Owner knows, as `spellCounts` counts them. The owner's own spells are saved under its key,
 * under its class with another book's key, or (legacy) with no key. Subclass and always-prepared spells, Pact of the
 * Tome and feat or race spells are left out.
 */
export function ownKnownSpells(profile: ClassSpellProfile, compendium: Compendium): OwnKnownSpell[] {
  const excluded = new Set([
    ...(profile.alwaysPreparedSpells ?? []).map((s) => s.name.toLowerCase()),
    ...(profile.subclassKnownSpells ?? []).map((s) => s.name.toLowerCase()),
  ]);
  // A single caster's profile also lists feat spells, and a Warlock's the Pact of the Tome cantrips; neither counts.
  const classPrefix = `${profile.className}__`;
  const isOwn = (key: string | undefined) =>
    key === undefined || key === profile.ownerKey || (key.startsWith(classPrefix) && key !== PACT_OF_THE_TOME_OWNER);
  return profile.knownSpells
    .filter((k) => isOwn(k.ownerKey) && !excluded.has(k.name.toLowerCase()))
    // A spell the Compendium does not hold is listed as a cantrip, as the Spell Page lists it.
    .map((k) => ({ name: k.name, source: k.source, level: compendium.findSpell(k.name, k.source)?.level ?? 0 }));
}

/**
 * The cantrips and spells one class Spell Owner knows against what its class level is due. The due numbers come from
 * the Catalog class, or from its Eldritch Knight or Arcane Trickster subclass at the class's level. The known spells are
 * the owner's own (see `ownKnownSpells`). A part is null when the Catalog has no number for it, and both are null while
 * the Catalog is stale.
 */
export function spellCounts(character: Character, profile: ClassSpellProfile, catalogs?: CharacterCatalogs): SpellCounts {
  const compendium = catalogs?.compendium ?? currentCompendium();
  if (compendium.stale) return { cantrips: null, spells: null };

  const entry = (character.classes ?? []).find((c) => c.className === profile.className && (c.source || "PHB") === profile.source);
  const level = entry?.level ?? profile.level;
  const due = spellsDueAt({ className: profile.className, source: profile.source, subclassName: profile.subclass, level }, catalogs);

  const owned = ownKnownSpells(profile, compendium);
  const cantripsKnown = owned.filter((s) => s.level === 0).length;
  const spellsKnown = owned.length - cantripsKnown;

  return {
    cantrips: due.cantrips === null ? null : { known: cantripsKnown, due: due.cantrips },
    spells: due.spells === null ? null : { known: spellsKnown, due: due.spells.due, kind: due.spells.kind },
  };
}

/** The number a per-level progression gives at a class level (index 0 is level 1), or null when it has none. */
function dueAt(progression: number[] | undefined, level: number): number | null {
  return progression?.[level - 1] ?? null;
}

/** The sum of a per-level progression up to a class level. */
function runningTotal(progression: number[], level: number): number {
  return progression.slice(0, level).reduce((sum, gain) => sum + gain, 0);
}
