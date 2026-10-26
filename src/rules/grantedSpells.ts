import type { AbilityKey, Character, AsiSelection } from "../types/character.ts";
import type { AdditionalSpells, FeatData, SpellData } from "../types/dnd5e.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "./innateMagic.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { resolveSpellName } from "./subclassSpells.ts";
import {
  chosenAbilityOptionsOf,
  chosenSpellsOf,
  fixedGrantAbility,
  heldFeatsOf,
  offeredSpellLists,
  pickSlotsOf,
  pickedAbilityOf,
  pickedSpellListOf,
  spellListLabel,
  usesOf,
} from "./choices/featSpells.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

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
  proficiencyBonus: number;
  modifiers: Record<AbilityKey, number>;
}

/**
 * The Innate Magic sources the character's feats grant (ADR 0017). Each feat the character holds (through an ability score
 * improvement, an origin feat or a class choice) gives one source per spell grant: its spells, at will or with a
 * once-per-Long-Rest counter, and its own casting ability. A feat that offers named spell lists gives the source of the list
 * the player picked. Spells are never written into a class's known or prepared lists. A part that is not yet resolved (an
 * ability not recorded, a list or a spell not picked) keeps its source and raises a needs-review notice instead.
 */
export function grantedSpellSources(
  character: Character,
  catalogs?: CharacterCatalogs,
  scores?: GrantedSpellScores
): InnateSpellProfile[] {
  const feats = catalogListings(catalogs).feats();
  const ctx: GrantContext = {
    character,
    compendium: catalogs?.compendium ?? currentCompendium(),
    activeBooks: catalogs?.activeBooks,
    proficiencyBonus: scores?.proficiencyBonus ?? proficiencyBonus(totalLevel(character)),
    modifiers: scores?.modifiers ?? effectiveScores(character).modifiers,
  };
  const sources: InnateSpellProfile[] = [];

  for (const { feat, selection } of heldFeatsOf(character, feats)) {
    if (!feat.additionalSpells) continue;
    // Spells named by this feat are listed once, across all its grants.
    const seen = new Set<string>();
    if (offeredSpellLists(feat).length > 0) {
      const picked = pickedSpellListOf(character, feat);
      if (picked) {
        const source = grantSource(ctx, feat, picked, selection, seen, `${feat.name} (${spellListLabel(picked.name ?? "")})`);
        if (source) sources.push(source);
      } else {
        sources.push({ title: feat.name, spells: [], notices: ["Needs review: choose a spell list"] });
      }
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name === "string") continue;
      const source = grantSource(ctx, feat, grant, selection, seen, feat.name);
      if (source) sources.push(source);
    }
  }
  return sources;
}

/** One source for one grant, or nothing when the grant gives no spell and nothing is awaiting a pick. */
function grantSource(
  ctx: GrantContext,
  feat: FeatData,
  grant: AdditionalSpells,
  selection: AsiSelection,
  seen: Set<string>,
  title: string
): InnateSpellProfile | undefined {
  const ability = abilityOf(ctx.character, feat, grant, selection);
  // A grant that names no casting ability at all gives no source, as it always has.
  if (ability === undefined && grant.ability === undefined) return undefined;

  const entryName = typeof grant.name === "string" ? grant.name : undefined;
  const spells = grantedSpells(feat.name, grant, seen, ctx);
  const notices: string[] = [];
  if (ability === undefined) {
    notices.push(grant.ability === "inherit" ? "Needs review: the ability increase is not recorded" : "Needs review: choose a casting ability");
  }
  for (const slot of pickSlotsOf(grant)) {
    const chosen = chosenSpellsOf(ctx.character, feat, grant, slot, ctx.compendium, ctx.activeBooks);
    for (const data of chosen) {
      if (seen.has(data.name.toLowerCase())) continue;
      spells.push(innateEntry(data, feat.name, entryName, slot.uses));
      seen.add(data.name.toLowerCase());
    }
    const owed = slot.count - chosen.length;
    if (owed > 0) notices.push(`Needs review: pick ${owed} more ${owed === 1 ? "spell" : "spells"}`);
  }
  if (spells.length === 0 && notices.length === 0) return undefined;

  const notesField = notices.length > 0 ? { notices } : {};
  if (ability === undefined) return { title, spells, ...notesField };
  const mod = ctx.modifiers[ability] ?? 0;
  return {
    title,
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
function abilityOf(character: Character, feat: FeatData, grant: AdditionalSpells, selection: AsiSelection): AbilityKey | undefined {
  if (grant.ability === "inherit") return selection.featAbility;
  if (grant.ability !== undefined && typeof grant.ability === "object") {
    const picked = pickedAbilityOf(character, feat);
    return picked !== undefined && chosenAbilityOptionsOf(grant).includes(picked) ? picked : undefined;
  }
  return fixedGrantAbility(grant);
}

/**
 * The spells one grant gives that resolve now. Known spells and the innate at-will list are at will. Daily and per-rest spells
 * carry a counter that a Long Rest restores. A spell already listed for this feat is not listed twice.
 */
function grantedSpells(featName: string, grant: AdditionalSpells, seen: Set<string>, ctx: GrantContext): InnateSpellEntry[] {
  const spells: InnateSpellEntry[] = [];
  const entryName = typeof grant.name === "string" ? grant.name : undefined;
  const add = (name: string, uses?: number) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    const data = resolveSpellName(name, ctx.activeBooks, ctx.compendium, { activeOnly: true });
    if (!data) return;
    seen.add(key);
    spells.push(innateEntry(data, featName, entryName, uses));
  };

  for (const names of listsIn(grant.known)) for (const name of names) add(name);
  for (const group of groupsIn(grant.innate)) {
    for (const name of stringsIn(group.will)) add(name);
    for (const key of ["daily", "rest"] as const) {
      for (const [count, names] of Object.entries(group[key] ?? {})) {
        for (const name of stringsIn(names)) add(name, usesOf(count));
      }
    }
  }
  return spells;
}

/** The Innate Magic entry of a resolved spell. A spell with a use count carries the counter a Long Rest restores. */
function innateEntry(data: SpellData, featName: string, entryName: string | undefined, uses?: number): InnateSpellEntry {
  return {
    name: data.name,
    level: data.level,
    minCharacterLevel: 1,
    castingTime: data.castingTime,
    source: data.source,
    isCantrip: data.level === 0,
    ...(uses !== undefined
      ? { resourceCounterId: counterId(featName, data.name, entryName), maxUses: uses }
      : {}),
  };
}

/** The spell lists of a known-spells group, one per spell level key (the scraper keys them `_` for a feat). */
function listsIn(group: unknown): string[][] {
  if (!group || typeof group !== "object") return [];
  return Object.values(group).map(stringsIn);
}

/** The innate groups of a grant (the scraper keys them `_`), each with its at-will and per-rest lists. */
function groupsIn(innate: unknown): Record<string, any>[] {
  if (!innate || typeof innate !== "object") return [];
  return Object.values(innate).filter((group): group is Record<string, any> => Boolean(group) && typeof group === "object");
}

/** The string entries of a list. A `choose` object is a pick and is skipped. */
function stringsIn(list: unknown): string[] {
  if (typeof list === "string") return [list];
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is string => typeof item === "string");
}

/**
 * A counter id unique to the feat, the list it was picked from (when named) and the spell: two feats, or two lists of one
 * feat, never share a counter. An unnamed grant keeps the id it has always had.
 */
function counterId(featName: string, spellName: string, entryName?: string): string {
  const list = entryName ? `_${slug(entryName)}` : "";
  return `innate_feat_${slug(featName)}${list}_${slug(spellName)}`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
