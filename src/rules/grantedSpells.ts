import type { AbilityKey, Character } from "../types/character.ts";
import type { AdditionalSpells, SpellData } from "../types/dnd5e.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "./innateMagic.ts";
import type { GrantedPreparedSpell } from "./spellcasting.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { resolveSpellName } from "./subclassSpells.ts";
import {
  chosenAbilityOptionsOf,
  chosenSpellsOf,
  featOwner,
  featCounterId,
  fixedGrantAbility,
  grantEntries,
  heldFeatsOf,
  isModelledGrant,
  offeredSpellLists,
  pickedAbilityOf,
  pickedSpellListOf,
  pickSlotsOf,
  preparedEntries,
  raceGrantsOf,
  slugOf,
  spellListLabel,
  usesOfEntry,
  type GrantOwner,
} from "./choices/featSpells.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

/** The prefix of a race's or subrace's daily or per-rest counter id. A feat's counters use their own prefix. */
const INNATE_SPELL_COUNTER_PREFIX = "innate_spell_";

/** The ability modifiers and proficiency bonus a source's save DC and attack bonus are read from. */
interface GrantedSpellScores {
  modifiers: Record<AbilityKey, number>;
  proficiencyBonus: number;
}

/** What one reading of the character's grants needs, shared by every source it builds. */
interface GrantContext {
  character: Character;
  compendium: Compendium;
  activeBooks: string[] | undefined;
  level: number;
  proficiencyBonus: number;
  modifiers: Record<AbilityKey, number>;
}

/**
 * The Innate Magic sources the character's race, subrace and feats grant (ADR 0017). Each grant gives one source: its spells,
 * at will or with a once-per-Long-Rest counter, and its own casting ability. A feat that offers named spell lists gives the
 * source of the list the player picked. Spells are never written into a class's known or prepared lists. A race's or
 * subrace's spells are listed from the character level that unlocks them. A part that is not yet resolved (an ability not
 * recorded, a list or a spell not picked) keeps its source and raises a needs-review notice instead.
 */
export function grantedSpellSources(
  character: Character,
  catalogs?: CharacterCatalogs,
  scores?: GrantedSpellScores
): InnateSpellProfile[] {
  const level = totalLevel(character);
  const ctx: GrantContext = {
    character,
    compendium: catalogs?.compendium ?? currentCompendium(),
    activeBooks: catalogs?.activeBooks,
    level,
    proficiencyBonus: scores?.proficiencyBonus ?? proficiencyBonus(level),
    modifiers: scores?.modifiers ?? effectiveScores(character).modifiers,
  };
  const listings = catalogListings(catalogs);
  const sources: InnateSpellProfile[] = [];

  const race = raceGrantsOf(character, listings.races());
  if (race) {
    const seen = new Set<string>();
    for (const grant of race.grants) {
      const source = grantSource(ctx, race.owner, grant, undefined, seen, race.owner.name);
      if (source) sources.push(source);
    }
  }

  for (const { feat, selection } of heldFeatsOf(character, listings.feats())) {
    if (!feat.additionalSpells) continue;
    const owner = featOwner(feat);
    // Spells named by this feat are listed once, across all its grants.
    const seen = new Set<string>();
    // A prepared-only list is never a card, so a feat whose lists are all prepared asks for no list here.
    if (offeredSpellLists(feat.additionalSpells).some(isModelledGrant)) {
      const picked = pickedSpellListOf(character, owner, feat.additionalSpells);
      if (picked) {
        const source = grantSource(ctx, owner, picked, selection, seen, `${feat.name} (${spellListLabel(picked.name ?? "")})`);
        if (source) sources.push(source);
      } else {
        sources.push({ title: feat.name, origin: "feat", spells: [], notices: ["Needs review: choose a spell list"] });
      }
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name === "string") continue;
      const source = grantSource(ctx, owner, grant, selection, seen, feat.name);
      if (source) sources.push(source);
    }
  }
  return sources;
}

/**
 * The prepared spells the character's feats and race give: the fixed spells of each prepared group and the picks made from it.
 * A named list counts only once the player has picked it. Each spell carries its source, and the class profiles apply the level
 * gates (see getClassSpellProfiles). A spell the active books do not hold is left out.
 */
export function grantedPreparedSpells(character: Character, catalogs?: CharacterCatalogs): GrantedPreparedSpell[] {
  const listings = catalogListings(catalogs);
  const compendium = catalogs?.compendium ?? currentCompendium();
  const activeBooks = catalogs?.activeBooks;
  const out: GrantedPreparedSpell[] = [];

  const addGrant = (owner: GrantOwner, grant: AdditionalSpells, source: string) => {
    for (const entry of preparedEntries(grant)) {
      if (entry.kind !== "spell") continue;
      const data = resolveSpellName(entry.name, activeBooks, compendium, { activeOnly: true });
      if (!data) continue;
      out.push({
        spell: data,
        source,
        minCharacterLevel: entry.minCharacterLevel,
        ...(entry.minSpellLevel !== undefined ? { minSpellLevel: entry.minSpellLevel } : {}),
      });
    }
    for (const slot of pickSlotsOf(grant)) {
      if (!slot.prepared) continue;
      for (const data of chosenSpellsOf(character, owner, grant, slot, compendium, activeBooks)) {
        out.push({ spell: data, source, minCharacterLevel: slot.minCharacterLevel });
      }
    }
  };

  const race = raceGrantsOf(character, listings.races());
  if (race) for (const grant of race.grants) addGrant(race.owner, grant, race.owner.name);

  for (const { feat } of heldFeatsOf(character, listings.feats())) {
    if (!feat.additionalSpells) continue;
    const owner = featOwner(feat);
    const picked = pickedSpellListOf(character, owner, feat.additionalSpells);
    if (picked) addGrant(owner, picked, `${feat.name} (${spellListLabel(picked.name ?? "")})`);
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name !== "string") addGrant(owner, grant, feat.name);
    }
  }
  return out;
}

/**
 * One source for one grant, or nothing when the grant is not modelled (see isModelledGrant), names no casting ability, or
 * gives no spell and awaits no pick.
 */
function grantSource(
  ctx: GrantContext,
  owner: GrantOwner,
  grant: AdditionalSpells,
  selection: { featAbility?: AbilityKey } | undefined,
  seen: Set<string>,
  title: string
): InnateSpellProfile | undefined {
  if (!isModelledGrant(grant)) return undefined;
  const ability = abilityOf(ctx.character, owner, grant, selection);
  if (ability === undefined && grant.ability === undefined) return undefined;

  const entryName = typeof grant.name === "string" ? grant.name : undefined;
  const spells = grantedSpells({ owner, grant, seen, ctx, entryName });
  const notices: string[] = [];
  if (ability === undefined) {
    notices.push(grant.ability === "inherit" ? "Needs review: the ability increase is not recorded" : "Needs review: choose a casting ability");
  }
  for (const slot of pickSlotsOf(grant)) {
    if (slot.prepared || slot.minCharacterLevel > ctx.level) continue;
    const chosen = chosenSpellsOf(ctx.character, owner, grant, slot, ctx.compendium, ctx.activeBooks);
    for (const data of chosen) {
      if (seen.has(data.name.toLowerCase())) continue;
      spells.push(innateEntry(data, owner, entryName, usesOfEntry(slot, data.level), slot.minCharacterLevel));
      seen.add(data.name.toLowerCase());
    }
    const owed = slot.count - chosen.length;
    if (owed > 0) notices.push(`Needs review: pick ${owed} more ${owed === 1 ? "spell" : "spells"}`);
  }
  if (spells.length === 0 && notices.length === 0) return undefined;

  const origin = owner.kind === "race" ? "race" : "feat";
  const notesField = notices.length > 0 ? { notices } : {};
  if (ability === undefined) return { title, origin, spells, ...notesField };
  const mod = ctx.modifiers[ability] ?? 0;
  return {
    title,
    origin,
    ability,
    spellSaveDc: 8 + ctx.proficiencyBonus + mod,
    spellAttackBonus: ctx.proficiencyBonus + mod,
    spells,
    ...notesField,
  };
}

/**
 * The casting ability a grant gives: the ability the feat's increase raised, the one the player chose for its owner (of the ones
 * the grant offers), or the fixed one. Undefined while it is not resolved.
 */
function abilityOf(
  character: Character,
  owner: GrantOwner,
  grant: AdditionalSpells,
  selection: { featAbility?: AbilityKey } | undefined
): AbilityKey | undefined {
  if (grant.ability === "inherit") return selection?.featAbility;
  if (grant.ability !== undefined && typeof grant.ability === "object") {
    const picked = pickedAbilityOf(character, owner);
    return picked !== undefined && chosenAbilityOptionsOf(grant).includes(picked) ? picked : undefined;
  }
  return fixedGrantAbility(grant);
}

/**
 * The spells one grant gives that resolve now and whose level the character has reached. Cantrips of the known groups and the
 * innate at-will list are at will. Daily and per-rest spells, and a leveled spell of a known group, carry a counter that a Long
 * Rest restores. Ritual-only spells and picks are left out. A spell already listed for this owner is not listed twice.
 */
function grantedSpells(input: { owner: GrantOwner; grant: AdditionalSpells; seen: Set<string>; ctx: GrantContext; entryName?: string }): InnateSpellEntry[] {
  const { owner, grant, seen, ctx, entryName } = input;
  const spells: InnateSpellEntry[] = [];
  for (const entry of grantEntries(grant)) {
    if (entry.kind !== "spell") continue;
    if (entry.minCharacterLevel > ctx.level) continue;
    const key = entry.name.toLowerCase();
    if (seen.has(key)) continue;
    const data = resolveSpellName(entry.name, ctx.activeBooks, ctx.compendium, { activeOnly: true });
    if (!data) continue;
    seen.add(key);
    spells.push(innateEntry(data, owner, entryName, usesOfEntry(entry, data.level), entry.minCharacterLevel, grant.castLevels?.[key]));
  }
  return spells;
}

/**
 * The Innate Magic entry of a resolved spell. It is cast at the level the grant gives when it names one, else at the spell's
 * own level. A spell with a use count carries the counter a Long Rest restores.
 */
function innateEntry(
  data: SpellData,
  owner: GrantOwner,
  entryName: string | undefined,
  uses: number | undefined,
  minCharacterLevel: number,
  castLevel?: number
): InnateSpellEntry {
  return {
    name: data.name,
    level: castLevel ?? data.level,
    minCharacterLevel,
    castingTime: data.castingTime,
    source: data.source,
    isCantrip: data.level === 0,
    ...(uses !== undefined ? { resourceCounterId: counterId(owner, data.name, entryName), maxUses: uses } : {}),
  };
}

/**
 * The counter id of a daily or per-rest spell. A feat's is unique to the feat, the list it was picked from (when named) and the
 * spell: two feats, or two lists of one feat, never share a counter. A race's is the spell's own id; a saved use under an older
 * id moves to it (moveLegacyInnateCounters).
 */
function counterId(owner: GrantOwner, spellName: string, entryName?: string): string {
  if (owner.kind === "race") return `${INNATE_SPELL_COUNTER_PREFIX}${slugOf(spellName)}`;
  return featCounterId(owner.name, entryName, spellName);
}

/**
 * Moves each saved race or subrace counter that no current source owns to the id of the spell it names (ADR 0017). The counter
 * carries its spell's name ("Innate: <spell>"), so an id an older release saved under is found by name, not by a table of old
 * ids. A counter whose spell no current source gives, or whose current id is already taken, is left as it is.
 */
export function moveLegacyInnateCounters(character: Character, compendium: Compendium, activeBooks?: string[]): Character {
  const counters = character.resourceCounters ?? {};
  const legacyKeys = Object.keys(counters).filter((key) => key.startsWith(INNATE_SPELL_COUNTER_PREFIX));
  if (legacyKeys.length === 0) return character;

  const currentIds = new Map<string, string>();
  for (const source of grantedSpellSources(character, { compendium, activeBooks })) {
    for (const spell of source.spells) {
      if (spell.resourceCounterId) currentIds.set(`innate: ${spell.name}`.toLowerCase(), spell.resourceCounterId);
    }
  }
  const next = { ...counters };
  let moved = false;
  for (const key of legacyKeys) {
    const target = currentIds.get(counters[key].name.toLowerCase());
    if (!target || target === key || next[target]) continue;
    next[target] = { ...counters[key], id: target };
    delete next[key];
    moved = true;
  }
  return moved ? { ...character, resourceCounters: next } : character;
}
