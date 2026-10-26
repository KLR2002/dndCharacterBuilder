import type { AbilityKey, Character, AsiSelection } from "../types/character.ts";
import type { AdditionalSpells, FeatData } from "../types/dnd5e.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "./innateMagic.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { resolveSpellName } from "./subclassSpells.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The ability modifiers and proficiency bonus a source's save DC and attack bonus are read from. */
export interface GrantedSpellScores {
  modifiers: Record<AbilityKey, number>;
  proficiencyBonus: number;
}

/**
 * The Innate Magic sources the character's feats grant (ADR 0017). Each feat the character holds (through an ability score
 * improvement, an origin feat or a class choice) gives one source per spell grant that resolves now: its spells, at will or
 * with a once-per-Long-Rest counter, and its own casting ability. Spells are never written into a class's known or prepared
 * lists. Grants whose ability or spells are a pick are left out until the pick is made.
 */
export function grantedSpellSources(
  character: Character,
  catalogs?: CharacterCatalogs,
  scores?: GrantedSpellScores
): InnateSpellProfile[] {
  const feats = catalogListings(catalogs).feats();
  const compendium = catalogs?.compendium ?? currentCompendium();
  const pb = scores?.proficiencyBonus ?? proficiencyBonus(totalLevel(character));
  const modifiers = scores?.modifiers ?? effectiveScores(character).modifiers;
  const sources: InnateSpellProfile[] = [];

  for (const { feat, selection } of heldFeats(character, feats)) {
    if (!feat.additionalSpells) continue;
    const seen = new Set<string>();
    for (const grant of feat.additionalSpells) {
      const ability = fixedAbility(grant, selection);
      if (!ability) continue;
      const spells = grantedSpells(feat.name, grant, seen, catalogs?.activeBooks, compendium);
      if (spells.length === 0) continue;
      const mod = modifiers[ability] ?? 0;
      sources.push({
        title: feat.name,
        ability,
        spellSaveDc: 8 + pb + mod,
        spellAttackBonus: pb + mod,
        spells,
      });
    }
  }
  return sources;
}

/** Each feat the character holds once, with the selection that gave it (the ability increase it carries, if any). */
function heldFeats(character: Character, feats: FeatData[]): { feat: FeatData; selection: AsiSelection }[] {
  const held: { feat: FeatData; selection: AsiSelection }[] = [];
  for (const selection of [...(character.asiSelections ?? []), ...(character.originFeats ?? [])]) {
    if (selection.type !== "feat") continue;
    const feat = feats.find((f) => f.name === selection.featName && (!selection.featSource || f.source === selection.featSource));
    if (feat && !held.some((entry) => entry.feat === feat)) held.push({ feat, selection });
  }
  return held;
}

/** The casting ability a grant fixes: a named key, or the ability the feat's increase raised. A pick yields none yet. */
function fixedAbility(grant: AdditionalSpells, selection: AsiSelection): AbilityKey | undefined {
  const ability = grant.ability;
  if (ability === "inherit") return selection.featAbility;
  if (typeof ability === "string" && (ABILITY_KEYS as readonly string[]).includes(ability)) return ability as AbilityKey;
  return undefined;
}

/**
 * The spells one grant gives that resolve now. Known spells and the innate at-will list are at will. Daily and per-rest spells
 * carry a counter that a Long Rest restores. Ritual-only spells and picks are left out. A spell already listed for this feat is
 * not listed twice.
 */
function grantedSpells(
  featName: string,
  grant: AdditionalSpells,
  seen: Set<string>,
  activeBooks: string[] | undefined,
  compendium: Compendium
): InnateSpellEntry[] {
  const spells: InnateSpellEntry[] = [];
  const add = (name: string, uses?: number) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    const data = resolveSpellName(name, activeBooks, compendium);
    if (!data) return;
    seen.add(key);
    spells.push({
      name: data.name,
      level: data.level,
      minCharacterLevel: 1,
      castingTime: data.castingTime,
      source: data.source,
      isCantrip: data.level === 0,
      ...(uses !== undefined
        ? { resourceCounterId: counterId(featName, data.name), maxUses: uses }
        : {}),
    });
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

/** The uses a daily or per-rest key allows: `"1"` and `"1e"` are one use. */
function usesOf(count: string): number {
  const uses = parseInt(count, 10);
  return Number.isFinite(uses) && uses > 0 ? uses : 1;
}

/** A counter id unique to the feat and the spell: two feats never share a counter. */
function counterId(featName: string, spellName: string): string {
  return `innate_feat_${slug(featName)}_${slug(spellName)}`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
