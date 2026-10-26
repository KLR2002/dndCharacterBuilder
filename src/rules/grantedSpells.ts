import type { AbilityKey, Character, AsiSelection } from "../types/character.ts";
import type { AdditionalSpells, FeatData, SpellData } from "../types/dnd5e.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "./innateMagic.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { resolveCharacterAncestry } from "./characterAncestry.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { resolveSpellName } from "./subclassSpells.ts";
import {
  chosenAbilityOptionsOf,
  chosenSpellsOf,
  featCounterId,
  fixedGrantAbility,
  heldFeatsOf,
  offeredSpellLists,
  pickSlotsOf,
  pickedAbilityOf,
  pickedSpellListOf,
  slugOf,
  spellListLabel,
  usesOf,
} from "./choices/featSpells.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

/**
 * Counter ids the old race table saved under, for the spells whose id does not follow the slug of their name. Keeping them
 * means a saved use of the spell survives the move to the Catalog.
 */
const LEGACY_RACE_COUNTER_IDS: Record<string, string> = {
  "create or destroy water": "innate_spell_create_water",
};

/** The ability modifiers and proficiency bonus a source's save DC and attack bonus are read from. */
export interface GrantedSpellScores {
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
 * Whose grant a source is: the character's race or subrace, or a feat it holds. `name` is the race, subrace or feat's name.
 * A feat holder carries its record, so its picks can be read.
 */
interface GrantHolder {
  origin: "race" | "feat";
  name: string;
  feat?: FeatData;
}

/** A spell a grant names: the character level its key gives (a feat's `_` gives 1) and its uses per Long Rest (none: at will). */
interface NamedSpell {
  name: string;
  minCharacterLevel: number;
  uses?: number;
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
  const sources: InnateSpellProfile[] = [];

  const race = raceGrants(character, catalogs);
  if (race) {
    const holder: GrantHolder = { origin: "race", name: race.title };
    const seen = new Set<string>();
    for (const grant of race.grants) {
      const source = grantSource(ctx, holder, grant, undefined, seen, race.title);
      if (source) sources.push(source);
    }
  }

  for (const { feat, selection } of heldFeatsOf(character, catalogListings(catalogs).feats())) {
    if (!feat.additionalSpells) continue;
    const holder: GrantHolder = { origin: "feat", name: feat.name, feat };
    // Spells named by this feat are listed once, across all its grants.
    const seen = new Set<string>();
    if (offeredSpellLists(feat).length > 0) {
      const picked = pickedSpellListOf(character, feat);
      if (picked) {
        const source = grantSource(ctx, holder, picked, selection, seen, `${feat.name} (${spellListLabel(picked.name ?? "")})`);
        if (source) sources.push(source);
      } else {
        sources.push({ title: feat.name, origin: "feat", spells: [], notices: ["Needs review: choose a spell list"] });
      }
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name === "string") continue;
      const source = grantSource(ctx, holder, grant, selection, seen, feat.name);
      if (source) sources.push(source);
    }
  }
  return sources;
}

/**
 * The grants of the character's race or subrace. A subrace whose own grants exist replaces the race's, as its trait takes
 * the place of the race's Innate Magic; a subrace without grants leaves them.
 */
function raceGrants(character: Character, catalogs?: CharacterCatalogs): { title: string; grants: AdditionalSpells[] } | undefined {
  const ancestry = resolveCharacterAncestry(character, catalogListings(catalogs).races());
  const subrace = ancestry.subrace;
  const race = ancestry.race;
  if (subrace?.additionalSpells?.length && subrace.name) return { title: subrace.name, grants: subrace.additionalSpells };
  if (race?.additionalSpells?.length && race.name) return { title: race.name, grants: race.additionalSpells };
  return undefined;
}

/** One source for one grant, or nothing when the grant gives no spell and nothing is awaiting a pick. */
function grantSource(
  ctx: GrantContext,
  holder: GrantHolder,
  grant: AdditionalSpells,
  selection: AsiSelection | undefined,
  seen: Set<string>,
  title: string
): InnateSpellProfile | undefined {
  const ability = abilityOf(ctx.character, holder, grant, selection);
  // A grant that names no casting ability gives no source, and so does a race's ability choice, which a race does not offer yet.
  const awaitingRaceChoice = !holder.feat && typeof grant.ability === "object";
  if (ability === undefined && (grant.ability === undefined || awaitingRaceChoice)) return undefined;

  const entryName = typeof grant.name === "string" ? grant.name : undefined;
  const spells = grantedSpells({ holder, grant, seen, ctx });
  const notices: string[] = [];
  if (ability === undefined) {
    notices.push(grant.ability === "inherit" ? "Needs review: the ability increase is not recorded" : "Needs review: choose a casting ability");
  }
  // Picks are made by feats only; a race's picks are not offered yet.
  const slots = holder.feat ? pickSlotsOf(grant) : [];
  for (const slot of slots) {
    const chosen = chosenSpellsOf(ctx.character, holder.feat!, grant, slot, ctx.compendium, ctx.activeBooks);
    for (const data of chosen) {
      if (seen.has(data.name.toLowerCase())) continue;
      spells.push(innateEntry(data, holder, entryName, slot.uses, 1));
      seen.add(data.name.toLowerCase());
    }
    const owed = slot.count - chosen.length;
    if (owed > 0) notices.push(`Needs review: pick ${owed} more ${owed === 1 ? "spell" : "spells"}`);
  }
  if (spells.length === 0 && notices.length === 0) return undefined;

  const notesField = notices.length > 0 ? { notices } : {};
  if (ability === undefined) return { title, origin: holder.origin, spells, ...notesField };
  const mod = ctx.modifiers[ability] ?? 0;
  return {
    title,
    origin: holder.origin,
    ability,
    spellSaveDc: 8 + ctx.proficiencyBonus + mod,
    spellAttackBonus: ctx.proficiencyBonus + mod,
    spells,
    ...notesField,
  };
}

/**
 * The casting ability a grant gives: the ability the feat's increase raised, the one the player chose for the feat (of the ones
 * the grant offers), or the fixed one. Undefined while it is not resolved.
 */
function abilityOf(character: Character, holder: GrantHolder, grant: AdditionalSpells, selection: AsiSelection | undefined): AbilityKey | undefined {
  if (grant.ability === "inherit") return selection?.featAbility;
  if (grant.ability !== undefined && typeof grant.ability === "object") {
    const picked = holder.feat ? pickedAbilityOf(character, holder.feat) : undefined;
    return picked !== undefined && chosenAbilityOptionsOf(grant).includes(picked) ? picked : undefined;
  }
  return fixedGrantAbility(grant);
}

/**
 * The spells one grant gives that resolve now and whose level the character has reached. Known spells and the innate
 * at-will list are at will. Daily and per-rest spells carry a counter that a Long Rest restores. Ritual-only spells and
 * picks are left out. A spell already listed for this holder is not listed twice.
 */
function grantedSpells(input: { holder: GrantHolder; grant: AdditionalSpells; seen: Set<string>; ctx: GrantContext }): InnateSpellEntry[] {
  const { holder, grant, seen, ctx } = input;
  const entryName = typeof grant.name === "string" ? grant.name : undefined;
  const spells: InnateSpellEntry[] = [];
  for (const { name, minCharacterLevel, uses } of namedSpells(grant)) {
    if (minCharacterLevel > ctx.level) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const data = resolveSpellName(name, ctx.activeBooks, ctx.compendium, { activeOnly: true });
    if (!data) continue;
    seen.add(key);
    spells.push(innateEntry(data, holder, entryName, uses, minCharacterLevel, grant.castLevels?.[key]));
  }
  return spells;
}

/**
 * The Innate Magic entry of a resolved spell. It is cast at the level the grant gives when it names one, else at the spell's
 * own level. A spell with a use count carries the counter a Long Rest restores.
 */
function innateEntry(
  data: SpellData,
  holder: GrantHolder,
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
    ...(uses !== undefined ? { resourceCounterId: counterId(holder, data.name, entryName), maxUses: uses } : {}),
  };
}

/** Every spell a grant names in its known and innate sections, in section and level order. */
function namedSpells(grant: AdditionalSpells): NamedSpell[] {
  return [...sectionSpells(grant.known), ...sectionSpells(grant.innate)];
}

/**
 * The spells of one section. Its keys are character levels for a race (the level the spell unlocks at) and `_` for a feat
 * (no level gate beyond the feat itself).
 */
function sectionSpells(section: unknown): NamedSpell[] {
  if (!section || typeof section !== "object") return [];
  const named: NamedSpell[] = [];
  for (const [key, value] of Object.entries(section)) {
    const minCharacterLevel = key === "_" ? 1 : Number(key);
    if (!Number.isFinite(minCharacterLevel)) continue;
    collectNamed(value, minCharacterLevel, undefined, named);
  }
  return named;
}

/**
 * Collects the spell names under one value. A list is at will unless it sits under a `daily` or `rest` key, which give its uses
 * per Long Rest. A `choose` object is a pick and yields nothing, and so does a `ritual` list.
 */
function collectNamed(value: unknown, minCharacterLevel: number, uses: number | undefined, named: NamedSpell[]): void {
  if (typeof value === "string") {
    named.push({ name: value, minCharacterLevel, uses });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNamed(item, minCharacterLevel, uses, named);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, inner] of Object.entries(value)) {
    if (key === "daily" || key === "rest") {
      if (inner && typeof inner === "object") {
        for (const [count, names] of Object.entries(inner)) collectNamed(names, minCharacterLevel, usesOf(count), named);
      }
    } else if (key === "will" || key === "_") {
      collectNamed(inner, minCharacterLevel, uses, named);
    }
  }
}

/**
 * The counter id of a daily or per-rest spell. A feat's is unique to the feat, the list it was picked from (when named) and the
 * spell: two feats, or two lists of one feat, never share a counter. A race's is the spell's own id, the one the old race table
 * saved, so a saved use survives the move.
 */
function counterId(holder: GrantHolder, spellName: string, entryName?: string): string {
  if (holder.origin === "race") {
    return LEGACY_RACE_COUNTER_IDS[spellName.toLowerCase()] ?? `innate_spell_${slugOf(spellName)}`;
  }
  return featCounterId(holder.name, entryName, spellName);
}
