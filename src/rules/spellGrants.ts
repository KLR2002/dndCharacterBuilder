import { SRD_SOURCE, type ActiveBooks } from "../constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../constants/rules.ts";
import type { AsiSelection, Character } from "../types/character.ts";
import type { AdditionalSpells, BackgroundData, FeatData, RaceData, SubraceData } from "../types/dnd5e.ts";
import { currentCompendium, type Compendium, type CompendiumListings } from "../services/compendium.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { isCustomBackground } from "./customBackground.ts";
import { grantGateOpen } from "./grantGate.ts";
import { findHeldRace, findHeldRecord } from "./raceLookup.ts";

/**
 * The one reader of the owners that grant spells (ADR 0017): the race or subrace (or lineage replacement), each feat the
 * character holds, and the background. Every spell reader and every Rule Choice reader asks this module which owners it
 * holds, so the rules for resolving a held record live here and nowhere else. A leaf module: it imports nothing that imports
 * the spell readers back.
 */

/** The mark each kind of owner puts in its pick ids. */
export const OWNER_MARK: Record<GrantOwner["kind"], string> = { feat: "Feat Spells", race: "Race Spells" };

/**
 * The source slot of a race's pick key. A race is held by its name whichever book holds it, so its key names no book: a pick
 * made on one catalog's record of a race is the same pick on another catalog's.
 */
export const RACE_KEY_SOURCE = "-";

/**
 * Whose spell grant a pick is for: a feat the character holds, or the race or subrace record that gives the grant. `source`
 * and `name` are the owner's own record; a race's key carries no source (see ownerKey).
 */
export interface GrantOwner {
  kind: "feat" | "race";
  source: string;
  name: string;
}

/**
 * An owner the character holds whose record may grant spells. A feat is held with the selection that gave it. A race's grants
 * are the ones whose gate is open. A background owns no picks, so it carries no owner.
 */
export type HeldSpellGrant =
  | { kind: "race"; record: RaceData | SubraceData; owner: GrantOwner; additionalSpells: AdditionalSpells[] }
  | { kind: "feat"; record: FeatData; owner: GrantOwner; additionalSpells?: AdditionalSpells[]; selection: AsiSelection }
  | { kind: "background"; record: BackgroundData; additionalSpells?: AdditionalSpells[] };

/** The records a held owner is read from, already scoped to the active books. */
export interface SpellGrantRecords {
  races: readonly RaceData[];
  feats: readonly FeatData[];
  backgrounds: readonly BackgroundData[];
}

export interface HeldSpellGrantOptions {
  /**
   * Every record a held feat name may stand for, rather than the one the reader resolves. A background-claimed feat is held
   * by its name, so a pick saved under one record stays held while the book that holds it is not the one chosen now. The
   * reconciler checks picks against every record; the readers take the one resolved.
   */
  everyFeatRecord?: boolean;
}

/** The feat record a selection names. A feat a background grants carries the Background source marker, which is no sourcebook. */
interface FeatResolution {
  activeBooks: ActiveBooks;
  /** The listings scoped to `activeBooks`, which say whether a feat's book is one of the active books. */
  listings: CompendiumListings;
  backgroundSource?: string;
}

/**
 * Every owner of spell grants the character holds, read from the catalogs scoped to their active books. Order: the background,
 * then the feats in the order the character took them, then the race or subrace. Every held feat is returned, whatever its
 * record gives; a reader skips the feats whose `additionalSpells` is absent.
 */
export function heldSpellGrants(character: Character, catalogs?: CharacterCatalogs, options: HeldSpellGrantOptions = {}): HeldSpellGrant[] {
  const listings = catalogListings(catalogs);
  return heldSpellGrantsIn(
    character,
    { races: listings.races(), feats: listings.feats(), backgrounds: listings.backgrounds() },
    catalogs?.activeBooks,
    options,
    catalogs?.compendium,
  );
}

/**
 * heldSpellGrants over records the caller has already chosen. A caller that reads only the races passes no feats or backgrounds.
 * `compendium` says which books are admitted under `activeBooks`; it defaults to the process-wide current Compendium.
 */
export function heldSpellGrantsIn(
  character: Character,
  records: SpellGrantRecords,
  activeBooks: ActiveBooks,
  options: HeldSpellGrantOptions = {},
  compendium: Compendium = currentCompendium(),
): HeldSpellGrant[] {
  const held: HeldSpellGrant[] = [];
  const background = resolveCharacterBackground(character, records.backgrounds, activeBooks);
  if (background) held.push({ kind: "background", record: background, additionalSpells: background.additionalSpells });
  const listings = compendium.for(activeBooks);
  for (const { feat, selection } of heldFeatEntries(character, records.feats, activeBooks, listings, options.everyFeatRecord === true)) {
    held.push({ kind: "feat", record: feat, owner: featOwner(feat), additionalSpells: feat.additionalSpells, selection });
  }
  const race = raceGrantsOf(character, records.races, activeBooks);
  if (race) held.push({ kind: "race", record: race.record, owner: race.owner, additionalSpells: race.grants });
  return held;
}

/**
 * The background the character holds, found by the shared record lookup (see findHeldRecord). A custom background is never a
 * catalog record, even when it takes a catalog background's name.
 */
export function resolveCharacterBackground(
  character: Character,
  backgroundCatalog: readonly BackgroundData[] | undefined,
  activeBooks: ActiveBooks
): BackgroundData | undefined {
  if (!character.background || isCustomBackground(character.background) || !backgroundCatalog) return undefined;
  return findHeldRecord(backgroundCatalog, character.background, activeBooks);
}

/** The owner of a feat's grants. */
export function featOwner(feat: { name: string; source: string }): GrantOwner {
  return { kind: "feat", source: feat.source, name: feat.name };
}

/** The owner of a race's or subrace's grants: the record that gives them. */
function raceOwner(record: { name: string; source: string }): GrantOwner {
  return { kind: "race", source: record.source, name: record.name };
}

/**
 * The title a race or subrace is shown by: a subrace reads with its race ("Lumen Sample Kin") unless its own name already
 * reads as a name, having more than one word or containing the race's name ("Veil Descent", "Sample Kin Heritage"). A race with no
 * parent reads by its own name.
 */
function raceTitle(name: string, parentRace: string | undefined): string {
  if (parentRace === undefined || /\s/.test(name) || name.toLowerCase().includes(parentRace.toLowerCase())) return name;
  return `${name} ${parentRace}`;
}

/**
 * The title of a race or subrace the character holds. The character's own race is the parent of its subrace, so the catalog is
 * never asked which race a subrace belongs to: several races can list a subrace of one name.
 */
export function raceTitleOf(character: Character, name: string): string {
  const parent = character.race && character.race.subraceName === name ? character.race.name : undefined;
  return raceTitle(name, parent);
}

/**
 * The key an owner's picks share: its source (none for a race), its kind's mark and its name. A race's key names no book (see
 * RACE_KEY_SOURCE).
 */
export function ownerKey(owner: GrantOwner): string {
  const source = owner.kind === "race" ? RACE_KEY_SOURCE : owner.source;
  return `${source}__${OWNER_MARK[owner.kind]}__${owner.name}`;
}

/** The selections that took a feat, the character's own first and then its origin feats. */
function featSelectionsOf(character: Character): AsiSelection[] {
  return [...(character.asiSelections ?? []), ...(character.originFeats ?? [])].filter((selection) => selection.type === "feat");
}

/**
 * The feat record a selection names. A feat a background grants carries the Background source marker, which is no
 * sourcebook, so it resolves by name, among the records of that name in this order: a record of an active book, then
 * the record of the background's own book, then the first in catalog order. The order is the same on every load, so
 * the owner key of the picks made on it is too.
 */
export function featOfSelection(selection: AsiSelection, feats: readonly FeatData[], resolution: FeatResolution): FeatData | undefined {
  const named = feats.filter((f) => f.name === selection.featName);
  if (selection.featSource && selection.featSource !== BACKGROUND_FEAT_SOURCE) {
    return named.find((f) => f.source === selection.featSource);
  }
  // An active book's feat is one the listings admit other than the SRD's; with no books given, nothing ranks first.
  const isActive = (feat: FeatData): boolean =>
    resolution.activeBooks !== undefined && feat.source !== SRD_SOURCE && resolution.listings.admits(feat.source);
  const rank = (feat: FeatData): number => (isActive(feat) ? 0 : feat.source === resolution.backgroundSource ? 1 : 2);
  let best: FeatData | undefined;
  for (const feat of named) if (!best || rank(feat) < rank(best)) best = feat;
  return best;
}

/**
 * Every record a selection may stand for: the book it names, or each record of the name when it names none (a
 * background-claimed feat), in catalog order.
 */
function candidateFeatsOf(selection: AsiSelection, feats: readonly FeatData[]): FeatData[] {
  const explicit = selection.featSource && selection.featSource !== BACKGROUND_FEAT_SOURCE;
  return feats.filter((feat) => feat.name === selection.featName && (!explicit || feat.source === selection.featSource));
}

/** Each held feat once, with the selection that gave it, in the order the character recorded them. */
function heldFeatEntries(
  character: Character,
  feats: readonly FeatData[],
  activeBooks: ActiveBooks,
  listings: CompendiumListings,
  everyRecord: boolean,
): { feat: FeatData; selection: AsiSelection }[] {
  const resolution: FeatResolution = { activeBooks, listings, backgroundSource: character.background?.source };
  const held: { feat: FeatData; selection: AsiSelection }[] = [];
  for (const selection of featSelectionsOf(character)) {
    const found = everyRecord ? candidateFeatsOf(selection, feats) : [featOfSelection(selection, feats, resolution)];
    for (const feat of found) {
      if (feat && !held.some((entry) => entry.feat === feat)) held.push({ feat, selection });
    }
  }
  return held;
}

/** The record a race or subrace is held as, with its grants whose gate is open. Undefined when none is open. */
interface RaceGrants {
  record: RaceData | SubraceData;
  owner: GrantOwner;
  grants: AdditionalSpells[];
}

/**
 * The race or subrace whose spell grant the character has. A subrace whose grants are read replaces the race's, as its trait
 * takes the place of the race's Innate Magic. Only the grants whose gate is open are read (see grantGateOpen). Undefined when
 * neither gives spells the character reads. The race, its subrace and a lineage replacement are resolved by the shared
 * lookup, scoped to `activeBooks`.
 */
function raceGrantsOf(character: Character, races: readonly RaceData[], activeBooks: ActiveBooks): RaceGrants | undefined {
  // A lineage replacement stands in for the race, as the catalog resolves it.
  const lineage = character.lineageReplacement ? findHeldRace(races, { name: character.lineageReplacement }, activeBooks).race : undefined;
  if (lineage) return openRaceGrants(character, lineage, lineage.additionalSpells);

  const { race, subrace } = findHeldRace(races, character.race, activeBooks);
  if (!race) return undefined;
  const subraceGrants = subrace ? openRaceGrants(character, subrace, subrace.additionalSpells) : undefined;
  if (subraceGrants) return subraceGrants;
  return openRaceGrants(character, race, race.additionalSpells);
}

/** The grants of a race or subrace whose gate is open, with the record that owns them. Undefined when none is open. */
function openRaceGrants(character: Character, record: RaceData | SubraceData, grants: AdditionalSpells[] | undefined): RaceGrants | undefined {
  const open = (grants ?? []).filter((grant) => grantGateOpen(character, grant));
  return open.length > 0 ? { record, owner: raceOwner(record), grants: open } : undefined;
}
