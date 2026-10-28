import type { AdditionalSpells, BackgroundData, ClassData, SpellData } from "../types/dnd5e.ts";
import type { Character, CharacterClass, KnownSpell, LegacyKnownSpell } from "../types/character.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { withNotices } from "./needsReview.ts";
import { heldFeatsOf, raceGrantsOf, raceTitleOf } from "./choices/featSpells.ts";
import { isCastingClass, isGiantBarbarian, isSpellAvailableForClass, spellOwnerKey } from "./spellcasting.ts";
import { normalizeKey, resolveSpellName } from "./subclassSpells.ts";
import { findHeldRecord } from "./raceLookup.ts";
import { isCustomBackground } from "./customBackground.ts";
import { UNKNOWN_OWNER_KEY } from "../constants/rules.ts";

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

/**
 * The background the character holds, found by the shared record lookup (see findHeldRecord). A custom background is never a
 * catalog record, even when it takes a catalog background's name.
 */
export function resolveCharacterBackground(
  character: Character,
  backgroundCatalog?: BackgroundData[],
  activeBooks?: readonly string[]
): BackgroundData | undefined {
  if (!character.background || isCustomBackground(character.background) || !backgroundCatalog) return undefined;
  return findHeldRecord(backgroundCatalog, character.background, activeBooks);
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
  const background = resolveCharacterBackground(character, listings.backgrounds(), activeBooks);
  if (background) sources.push({ title: `${background.name} background`, names: expandedSpellNamesOf(background.additionalSpells) });
  for (const { feat } of heldFeatsOf(character, listings.feats(), activeBooks)) {
    sources.push({ title: `${feat.name} feat`, names: expandedSpellNamesOf(feat.additionalSpells) });
  }
  const race = raceGrantsOf(character, listings.races(), activeBooks);
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
 * The Spell Owner keys of the plain class owners among `classes`. A known copy under any other key (Pact of the Tome, the Blessed
 * Warrior and Giant Power cantrips) is drawn from its own list, not from the class list, so no expanded list can have stranded it.
 */
function plainOwnerKeysOf(classes: readonly CharacterClass[]): Set<string> {
  return new Set(classes.filter((cls) => !isGiantBarbarian(cls)).map((cls) => spellOwnerKey(cls)));
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
  const stillListed = listedNamesOf(heldExpandedSources(after, compendium, activeBooks));
  const sourceOf = sourceTitlesOf(heldExpandedSources(before, compendium, activeBooks));
  return releaseExpandedKnownSpells(after, sourceOf, (known, spell) => {
    const key = normalizeKey(known.name);
    const ownerName = known.ownerKey?.split("__")[0] ?? known.className ?? "";
    const ownerLost = classNamed(before, ownerName) && !castsIn(after, ownerName, classes);
    return ownerLost
      ? listedByOwnClass(before, known, spell)
      : stillListed.has(key) || listedByOwnClass(after, known, spell);
  }, [...(before.classes ?? []), ...(after.classes ?? [])], compendium, activeBooks);
}

/**
 * Releases the known spells that a switched-off book's expanded list gave (ADR 0017). A spell is stranded when it is on the
 * expanded list of a source the character holds whose book is not active, and no active source's list gives it and its owning
 * class does not list it. Only a copy under its class's plain owner key can be stranded. A source the catalog does not hold at
 * all is not judged, so its spells stay. Switching the book back on restores nothing. Run with the active books when they change
 * and when a character is opened.
 */
export function releaseStrandedExpandedSpells(
  character: Character,
  compendium: Compendium = currentCompendium(),
  activeBooks: string[]
): Character {
  const stillListed = listedNamesOf(heldExpandedSources(character, compendium, activeBooks));
  const loaded = sourceTitlesOf(heldExpandedSources(character, compendium));
  return releaseExpandedKnownSpells(
    character,
    loaded,
    (known, spell) => stillListed.has(normalizeKey(known.name)) || listedByOwnClass(character, known, spell),
    character.classes ?? [],
    compendium,
    activeBooks
  );
}

/** The normalised names the expanded lists of the given sources give. */
function listedNamesOf(sources: readonly ExpandedSpellSource[]): Set<string> {
  return new Set(sources.flatMap((source) => source.names.map(normalizeKey)));
}

/** The title of the first source that gives each name, keyed by the normalised name. */
function sourceTitlesOf(sources: readonly ExpandedSpellSource[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const source of sources) {
    for (const name of source.names) {
      const key = normalizeKey(name);
      if (!titles.has(key)) titles.set(key, source.title);
    }
  }
  return titles;
}

/**
 * Removes the known spells of `sourceOf` that `stays` does not keep, each with a review notice naming the spell and its source,
 * and drops their prepared keys. Only a copy under a plain owner key of `ownerClasses` is a candidate, and a name the catalog
 * does not hold is kept. Returns `character` itself when nothing is released.
 */
function releaseExpandedKnownSpells(
  character: Character,
  sourceOf: ReadonlyMap<string, string>,
  stays: (known: KnownSpell | LegacyKnownSpell, spell: SpellData) => boolean,
  ownerClasses: readonly CharacterClass[],
  compendium: Compendium,
  activeBooks?: string[]
): Character {
  if (sourceOf.size === 0) return character;
  const plainOwnerKeys = plainOwnerKeysOf(ownerClasses);
  const notices: string[] = [];
  const released = new Set<string>();
  const knownSpells = (character.knownSpells ?? []).filter((known) => {
    const key = normalizeKey(known.name);
    const title = sourceOf.get(key);
    if (!title) return true;
    const ownerKey = known.ownerKey;
    if (ownerKey && ownerKey !== UNKNOWN_OWNER_KEY && !plainOwnerKeys.has(ownerKey)) return true;
    const spell = resolveSpellName(known.name, activeBooks, compendium);
    if (!spell || stays(known, spell)) return true;
    released.add(key);
    notices.push(`${known.name} removed: only on the ${title}'s spell list`);
    return false;
  });
  if (released.size === 0) return character;

  const keptNames = new Set(knownSpells.map((known) => normalizeKey(known.name)));
  const preparedSpells = (character.preparedSpells ?? []).filter((prepared) => {
    const key = normalizeKey(prepared.split("__")[0]);
    return !released.has(key) || keptNames.has(key);
  });
  return withNotices({ ...character, knownSpells, preparedSpells }, notices);
}
