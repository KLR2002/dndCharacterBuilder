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
 * improvement, an origin feat or a class choice) gives one source per spell grant: its spells, at will or with a
 * once-per-Long-Rest counter, and its own casting ability. Spells are never written into a class's known or prepared
 * lists. A part that is not yet resolved (an ability not recorded, a pick not made) keeps its source and raises a
 * needs-review notice instead of inventing the missing spell.
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
    const named = feat.additionalSpells.filter((grant) => typeof grant.name === "string");
    if (named.length > 0) {
      // A choice between named spell lists: until one is picked, the feat keeps its card and asks for it.
      if (named.some((grant) => fixedAbility(grant, selection) !== undefined)) {
        sources.push({ title: feat.name, spells: [], notices: ["Needs review: choose a spell list"] });
      }
      continue;
    }
    for (const grant of feat.additionalSpells) {
      const source = grantSource(feat, grant, selection, seen, catalogs?.activeBooks, compendium, pb, modifiers);
      if (source) sources.push(source);
    }
  }
  return sources;
}

/** One source for one grant, or nothing when the grant gives no spell and nothing is awaiting a pick. */
function grantSource(
  feat: FeatData,
  grant: AdditionalSpells,
  selection: AsiSelection,
  seen: Set<string>,
  activeBooks: string[] | undefined,
  compendium: Compendium,
  pb: number,
  modifiers: Record<AbilityKey, number>
): InnateSpellProfile | undefined {
  const ability = fixedAbility(grant, selection);
  // A pick of ability is not offered yet, so that grant gives no source.
  if (ability === undefined && grant.ability !== "inherit") return undefined;

  const spells = grantedSpells(feat.name, grant, seen, activeBooks, compendium);
  const notices: string[] = [];
  if (ability === undefined) notices.push("Needs review: the ability increase is not recorded");
  for (const slot of pickSlotsOf(grant)) {
    notices.push(`Needs review: pick ${slot.count} more ${slot.count === 1 ? "spell" : "spells"}`);
  }
  if (spells.length === 0 && notices.length === 0) return undefined;

  const notesField = notices.length > 0 ? { notices } : {};
  if (ability === undefined) return { title: feat.name, spells, ...notesField };
  const mod = modifiers[ability] ?? 0;
  return {
    title: feat.name,
    ability,
    spellSaveDc: 8 + pb + mod,
    spellAttackBonus: pb + mod,
    spells,
    ...notesField,
  };
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

/** A place in a grant where the player picks spells, and how many picks it takes. Picks are not read yet, so each is owed. */
interface PickSlot {
  count: number;
}

/** The pick slots of a grant: a `choose` object in a known list, or in an innate list (at will, daily or per rest). */
function pickSlotsOf(grant: AdditionalSpells): PickSlot[] {
  const lists: unknown[] = [...Object.values(grant.known ?? {})];
  for (const group of groupsIn(grant.innate)) {
    lists.push(group.will, ...Object.values(group.daily ?? {}), ...Object.values(group.rest ?? {}));
  }
  const slots: PickSlot[] = [];
  for (const list of lists) {
    for (const item of Array.isArray(list) ? list : []) {
      const count = chooseCountOf(item);
      if (count !== undefined) slots.push({ count });
    }
  }
  return slots;
}

/** How many spells a `choose` object asks for (one when it gives no count), or undefined for a plain spell name. */
function chooseCountOf(item: unknown): number | undefined {
  if (!item || typeof item !== "object" || typeof (item as { choose?: unknown }).choose !== "string") return undefined;
  return (item as { count?: number }).count ?? 1;
}

/**
 * The spells one grant gives that resolve now. Known spells and the innate at-will list are at will. Daily and per-rest spells
 * carry a counter that a Long Rest restores. A spell already listed for this feat is not listed twice.
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
    const data = resolveSpellName(name, activeBooks, compendium, { activeOnly: true });
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
