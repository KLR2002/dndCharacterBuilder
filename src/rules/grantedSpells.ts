import type { AbilityKey, Character, AsiSelection } from "../types/character.ts";
import type { AdditionalSpells, FeatData } from "../types/dnd5e.ts";
import type { InnateSpellEntry, InnateSpellProfile } from "./innateMagic.ts";
import { catalogListings, type CharacterCatalogs } from "./catalogs.ts";
import { resolveCharacterAncestry } from "./characterAncestry.ts";
import { effectiveScores } from "./abilities.ts";
import { proficiencyBonus, totalLevel } from "./proficiencies.ts";
import { resolveSpellName } from "./subclassSpells.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

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

/** One thing that grants spells: a feat the character holds, or the character's race or subrace. */
interface GrantHolder {
  title: string;
  origin: "race" | "feat";
  grants: AdditionalSpells[];
  /** The ability score improvement that gave a feat, which an `inherit` ability reads. */
  selection?: AsiSelection;
}

/** A spell a grant names: the character level its key gives (a feat's `_` gives 1) and its uses per Long Rest (none: at will). */
interface NamedSpell {
  name: string;
  minCharacterLevel: number;
  uses?: number;
}

/**
 * The Innate Magic sources the character's race, subrace and feats grant (ADR 0017). Each holder gives one source per spell
 * grant that resolves now: its spells, at will or with a once-per-Long-Rest counter, and its own casting ability. Spells are
 * never written into a class's known or prepared lists. Spells gated by a character level are listed from that level. Grants
 * whose ability or spells are a pick are left out until the pick is made.
 */
export function grantedSpellSources(
  character: Character,
  catalogs?: CharacterCatalogs,
  scores?: GrantedSpellScores
): InnateSpellProfile[] {
  const compendium = catalogs?.compendium ?? currentCompendium();
  const level = totalLevel(character);
  const pb = scores?.proficiencyBonus ?? proficiencyBonus(level);
  const modifiers = scores?.modifiers ?? effectiveScores(character).modifiers;
  const sources: InnateSpellProfile[] = [];

  for (const holder of grantHolders(character, catalogs)) {
    const seen = new Set<string>();
    for (const grant of holder.grants) {
      const ability = fixedAbility(grant, holder.selection);
      if (!ability) continue;
      const spells = grantedSpells({ holder, grant, seen, level, activeBooks: catalogs?.activeBooks, compendium });
      if (spells.length === 0) continue;
      const mod = modifiers[ability] ?? 0;
      sources.push({
        title: holder.title,
        origin: holder.origin,
        ability,
        spellSaveDc: 8 + pb + mod,
        spellAttackBonus: pb + mod,
        spells,
      });
    }
  }
  return sources;
}

/**
 * What grants spells to the character: its race or subrace, then each feat it holds. A subrace whose own grants exist
 * replaces the race's, as its trait takes the place of the race's Innate Magic; a subrace without grants leaves them.
 */
function grantHolders(character: Character, catalogs?: CharacterCatalogs): GrantHolder[] {
  const holders: GrantHolder[] = [];
  const ancestry = resolveCharacterAncestry(character, catalogListings(catalogs).races());
  const subrace = ancestry.subrace;
  const race = ancestry.race;
  if (subrace?.additionalSpells?.length && subrace.name) {
    holders.push({ title: subrace.name, origin: "race", grants: subrace.additionalSpells });
  } else if (race?.additionalSpells?.length && race.name) {
    holders.push({ title: race.name, origin: "race", grants: race.additionalSpells });
  }
  for (const { feat, selection } of heldFeats(character, catalogListings(catalogs).feats())) {
    if (feat.additionalSpells) holders.push({ title: feat.name, origin: "feat", grants: feat.additionalSpells, selection });
  }
  return holders;
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
function fixedAbility(grant: AdditionalSpells, selection?: AsiSelection): AbilityKey | undefined {
  const ability = grant.ability;
  if (ability === "inherit") return selection?.featAbility;
  if (typeof ability === "string" && (ABILITY_KEYS as readonly string[]).includes(ability)) return ability as AbilityKey;
  return undefined;
}

/**
 * The spells one grant gives that resolve now and whose level the character has reached. Known spells and the innate
 * at-will list are at will. Daily and per-rest spells carry a counter that a Long Rest restores. Ritual-only spells and picks
 * are left out. A spell already listed for this holder is not listed twice.
 */
function grantedSpells(input: {
  holder: GrantHolder;
  grant: AdditionalSpells;
  seen: Set<string>;
  level: number;
  activeBooks: string[] | undefined;
  compendium: Compendium;
}): InnateSpellEntry[] {
  const { holder, grant, seen, level, activeBooks, compendium } = input;
  const spells: InnateSpellEntry[] = [];
  for (const { name, minCharacterLevel, uses } of namedSpells(grant)) {
    if (minCharacterLevel > level) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const data = resolveSpellName(name, activeBooks, compendium);
    if (!data) continue;
    seen.add(key);
    spells.push({
      name: data.name,
      level: data.level,
      minCharacterLevel,
      castingTime: data.castingTime,
      source: data.source,
      isCantrip: data.level === 0,
      ...(uses !== undefined
        ? { resourceCounterId: counterId(holder, data.name), maxUses: uses }
        : {}),
    });
  }
  return spells;
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

/** The uses a daily or per-rest key allows: `"1"` and `"1e"` are one use. */
function usesOf(count: string): number {
  const uses = parseInt(count, 10);
  return Number.isFinite(uses) && uses > 0 ? uses : 1;
}

/**
 * The counter id of a daily or per-rest spell. A feat's is unique to the feat and the spell. A race's is the spell's own id,
 * the one the old race table saved, so a saved use survives the move.
 */
function counterId(holder: GrantHolder, spellName: string): string {
  if (holder.origin === "race") {
    return LEGACY_RACE_COUNTER_IDS[spellName.toLowerCase()] ?? `innate_spell_${slug(spellName)}`;
  }
  return `innate_feat_${slug(holder.title)}_${slug(spellName)}`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
