import type { AdditionalSpells, BackgroundData, ClassData, SpellData } from "../types/dnd5e.ts";
import type { Character } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { withNotices } from "./needsReview.ts";
import { heldFeatsOf, raceGrantsOf, raceTitleOf } from "./choices/featSpells.ts";
import { isCastingClass, isSpellAvailableForClass } from "./spellcasting.ts";
import { normalizeKey, resolveSpellName } from "./subclassSpells.ts";
import { findHeldRecord } from "./raceLookup.ts";

/**
 * The spell names a list of spell grants adds to the list of each spellcasting class the character has (ADR 0017). The
 * expanded lists are keyed by spell level (the cantrip list is `s0`); they carry no level gate, so every name counts.
 */
function expandedSpellNamesOf(grants: readonly AdditionalSpells[] | undefined): string[] {
  const names: string[] = [];
  for (const grant of grants ?? []) {
    for (const list of Object.values(grant.expanded ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const name of list) {
        if (typeof name === "string") names.push(name);
      }
    }
  }
  return names;
}

/** A source the character holds whose expanded lists add spells to its classes' lists, and the names those lists give. */
export interface ExpandedSpellSource {
  /** How a notice names the source: "Sample Rune Mark feat", "Sample Rune Line race" or "Sample Scholar background". */
  title: string;
  names: string[];
}

/** The background the character holds, found by its name and, when the character records one, its source. */
export function resolveCharacterBackground(character: Character, backgroundCatalog?: BackgroundData[]): BackgroundData | undefined {
  if (!character.background || !backgroundCatalog) return undefined;
  return findHeldRecord(backgroundCatalog, character.background);
}

/**
 * The expanded lists the character's sources give: its background, each feat it holds, and its race or subrace (the grants the
 * reader reads). A source with no expanded list is left out. The background and the race are read from the Compendium scoped to
 * the active books, the feats as heldFeatsOf reads them.
 */
function heldExpandedSources(
  character: Character,
  compendium: Compendium = currentCompendium(),
  activeBooks?: readonly string[]
): ExpandedSpellSource[] {
  const listings = compendium.for(activeBooks);
  const sources: ExpandedSpellSource[] = [];
  const background = resolveCharacterBackground(character, listings.backgrounds());
  if (background) sources.push({ title: `${background.name} background`, names: expandedSpellNamesOf(background.additionalSpells) });
  for (const { feat } of heldFeatsOf(character, listings.feats(), activeBooks)) {
    sources.push({ title: `${feat.name} feat`, names: expandedSpellNamesOf(feat.additionalSpells) });
  }
  const race = raceGrantsOf(character, listings.races());
  if (race) sources.push({ title: `${raceTitleOf(character, race.owner.name)} race`, names: expandedSpellNamesOf(race.grants) });
  return sources.filter((source) => source.names.length > 0);
}

/** The names every held expanded list adds to each spellcasting class's list: the input to a class profile's expanded spells. */
export function heldExpandedSpellNames(character: Character, compendium?: Compendium, activeBooks?: readonly string[]): string[] {
  return heldExpandedSources(character, compendium, activeBooks).flatMap((source) => source.names);
}

/** Whether the character holds a class of this name, casting or not. */
function classNamed(character: Character, className: string): boolean {
  return (character.classes ?? []).some((cls) => cls.className === className);
}

/** Whether the character's class of this name casts, so that the expanded lists join its list. */
function castsIn(character: Character, className: string, classes: readonly ClassData[]): boolean {
  return (character.classes ?? []).some((cls) => cls.className === className && isCastingClass(cls, classes));
}

/**
 * Whether the class that owns a known spell still lists it on its own list: its class list or subclass expansion, with no
 * expanded list. The owner is the class the spell's owner key names, or its class name when it has no owner key.
 */
function listedByOwnClass(character: Character, known: { ownerKey?: string; className?: string }, spell: SpellData): boolean {
  const ownerName = known.ownerKey?.split("__")[0] ?? known.className;
  return (character.classes ?? []).some((cls) =>
    cls.className === ownerName &&
    isSpellAvailableForClass(spell, cls.className, undefined, {
      subclassName: cls.subclassName || cls.subclass,
      classLevel: cls.level,
      ruleChoices: character.ruleChoices,
    })
  );
}

/**
 * Releases the known spells that only the expanded lists `before` held gave and `after` no longer gives (ADR 0017). Each release
 * is noticed, naming the spell and the source it came from. A spell a class gives itself stays, and so does a name the Catalog
 * does not hold. Its prepared key goes with it. Returns `after` itself when nothing is released.
 *
 * A known copy is judged by the class that owns it. While that class still casts, the expanded lists of `after` and its own
 * list keep the copy. Once the class has lost its casting (a level dropped below Spellcasting, or the class removed), the copy
 * is judged by that class's own list before the change, since no expanded list joins a class that does not cast.
 *
 * The transitions that remove a background, feat, race or class call this with the state before the change and the reconciled
 * state after it, so the same rule covers every source.
 */
export function releaseExpandedOnlySpells(
  before: Character,
  after: Character,
  compendium: Compendium = currentCompendium(),
  activeBooks?: string[]
): Character {
  const classes = compendium.for(activeBooks).classes();
  const stillListed = new Set(heldExpandedSources(after, compendium, activeBooks).flatMap((source) => source.names.map(normalizeKey)));
  const sourceOf = new Map<string, string>();
  for (const source of heldExpandedSources(before, compendium, activeBooks)) {
    for (const name of source.names) {
      const key = normalizeKey(name);
      if (!sourceOf.has(key)) sourceOf.set(key, source.title);
    }
  }
  if (sourceOf.size === 0) return after;

  const notices: string[] = [];
  const released = new Set<string>();
  const knownSpells = (after.knownSpells ?? []).filter((known) => {
    const key = normalizeKey(known.name);
    const title = sourceOf.get(key);
    if (!title) return true;
    const spell = resolveSpellName(known.name, activeBooks, compendium);
    if (!spell) return true;
    const ownerName = known.ownerKey?.split("__")[0] ?? known.className ?? "";
    const ownerLost = classNamed(before, ownerName) && !castsIn(after, ownerName, classes);
    const stays = ownerLost
      ? listedByOwnClass(before, known, spell)
      : stillListed.has(key) || listedByOwnClass(after, known, spell);
    if (stays) return true;
    released.add(key);
    notices.push(`${known.name} removed: only on the ${title}'s spell list`);
    return false;
  });
  if (released.size === 0) return after;

  const keptNames = new Set(knownSpells.map((known) => normalizeKey(known.name)));
  const preparedSpells = (after.preparedSpells ?? []).filter((prepared) => {
    const key = normalizeKey(prepared.split("__")[0]);
    return !released.has(key) || keptNames.has(key);
  });
  return withNotices({ ...after, knownSpells, preparedSpells }, notices);
}
