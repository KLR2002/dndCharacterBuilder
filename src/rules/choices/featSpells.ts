import type { AbilityKey, AsiSelection, Character, RuleChoiceEntry } from "../../types/character.ts";
import type { AdditionalSpells, FeatData, SpellData } from "../../types/dnd5e.ts";
import type { Compendium } from "../../services/compendium.ts";
import { isSpellAvailableForClass } from "../spellcasting.ts";
import type { AvailableRuleChoice } from "./types.ts";

/**
 * The spell picks a feat's grant asks for (ADR 0017). A feat that offers named spell lists is a choice between them: the
 * player picks one list, and that list's `choose` slots then take their spells. A grant without names has its slots directly.
 * Every pick is a Rule Choice of origin "feat", keyed by the feat, the list (or `-` for an unnamed grant) and the slot, so two
 * feats never share a pick. The ids are read by the reader and the reconciler; keep them in this module.
 */

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const FEAT_SPELLS_MARK = "Feat Spells";
const UNNAMED_GRANT_KEY = "-";

/** A feat the character holds, with the selection that gave it. */
export interface HeldFeat {
  feat: FeatData;
  selection: AsiSelection;
}

/** A place in a grant where the player picks spells: its index among the grant's picks, how many, the filter it picks from, and the uses of its key. */
export interface PickSlot {
  index: number;
  count: number;
  filter: string;
  /** Set for a daily or per-rest slot: the uses a Long Rest restores. Absent for a known or at-will slot. */
  uses?: number;
}

/** The parsed `key=value|key=value` filter of a `choose` object. Keys this module does not model are listed, and match nothing. */
export interface SpellFilter {
  level?: number;
  classes: string[];
  unknownKeys: string[];
}

/** Each feat the character holds once, in the order the character recorded them. */
export function heldFeatsOf(character: Character, feats: FeatData[]): HeldFeat[] {
  const held: HeldFeat[] = [];
  for (const selection of [...(character.asiSelections ?? []), ...(character.originFeats ?? [])]) {
    if (selection.type !== "feat") continue;
    const feat = feats.find((f) => f.name === selection.featName && (!selection.featSource || f.source === selection.featSource));
    if (feat && !held.some((entry) => entry.feat === feat)) held.push({ feat, selection });
  }
  return held;
}

/** The ability a grant names outright. Undefined for an inherited or chosen ability. */
export function fixedGrantAbility(grant: AdditionalSpells): AbilityKey | undefined {
  const ability = grant.ability;
  return typeof ability === "string" && (ABILITY_KEYS as readonly string[]).includes(ability) ? (ability as AbilityKey) : undefined;
}

/** The named spell lists a feat offers: named grants with a fixed casting ability. A list whose ability is a pick is not offered yet. */
export function offeredSpellLists(feat: FeatData): AdditionalSpells[] {
  return (feat.additionalSpells ?? []).filter((grant) => typeof grant.name === "string" && fixedGrantAbility(grant) !== undefined);
}

/** The grant of the spell list the player picked for a feat, if one is picked. */
export function pickedSpellListOf(character: Character, feat: FeatData): AdditionalSpells | undefined {
  const picked = character.ruleChoices?.find((entry) => entry.id === featSpellListChoiceId(feat))?.picked[0];
  if (!picked) return undefined;
  return offeredSpellLists(feat).find((grant) => grant.name === picked);
}

/** The pick slots of a grant, in order: its known `choose` objects, then its innate ones (at will, daily and per rest). */
export function pickSlotsOf(grant: AdditionalSpells): PickSlot[] {
  const found: Omit<PickSlot, "index">[] = [];
  const take = (list: unknown, uses?: number) => {
    for (const item of Array.isArray(list) ? list : []) {
      if (!item || typeof item !== "object") continue;
      const choose = (item as { choose?: unknown }).choose;
      if (typeof choose !== "string") continue;
      const count = (item as { count?: unknown }).count;
      found.push({ count: typeof count === "number" ? count : 1, filter: choose, ...(uses !== undefined ? { uses } : {}) });
    }
  };
  for (const list of Object.values(grant.known ?? {})) take(list);
  for (const group of Object.values(grant.innate ?? {})) {
    if (!group || typeof group !== "object") continue;
    take((group as Record<string, unknown>).will);
    for (const key of ["daily", "rest"] as const) {
      const byCount = (group as Record<string, Record<string, unknown> | undefined>)[key] ?? {};
      for (const [count, list] of Object.entries(byCount)) take(list, usesOf(count));
    }
  }
  return found.map((slot, index) => ({ index, ...slot }));
}

/** The uses a daily or per-rest key allows: `"1"` and `"1e"` are one use. */
export function usesOf(count: string): number {
  const uses = parseInt(count, 10);
  return Number.isFinite(uses) && uses > 0 ? uses : 1;
}

/** Parses a `key=value|key=value` filter. `class` may list several classes with `;`. Any other key is unknown. */
export function parseSpellFilter(filter: string): SpellFilter {
  const parsed: SpellFilter = { classes: [], unknownKeys: [] };
  for (const part of filter.split("|")) {
    const eq = part.indexOf("=");
    const key = (eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase();
    const value = eq < 0 ? "" : part.slice(eq + 1).trim();
    if (key === "level" && /^\d+$/.test(value)) parsed.level = parseInt(value, 10);
    else if (key === "class" && value) parsed.classes = value.split(";").map((cls) => cls.trim()).filter(Boolean);
    else parsed.unknownKeys.push(part.trim());
  }
  return parsed;
}

/**
 * The spells a filter offers: those of the filter's level, listed for one of its classes, in the active books (the same
 * rule `isSpellAvailableForClass` applies, so the Alternative Spell Lists count). Sorted by name. A filter with a key this
 * module does not model offers nothing.
 */
export function spellsMatching(filter: string, compendium: Compendium, activeBooks?: readonly string[]): SpellData[] {
  const parsed = parseSpellFilter(filter);
  if (parsed.unknownKeys.length > 0) return [];
  const seen = new Set<string>();
  const offered: SpellData[] = [];
  for (const spell of compendium.for(activeBooks).spells()) {
    if (parsed.level !== undefined && spell.level !== parsed.level) continue;
    if (parsed.classes.length > 0 && !parsed.classes.some((cls) => isSpellAvailableForClass(spell, cls, activeBooks as string[] | undefined))) continue;
    if (seen.has(spell.name)) continue;
    seen.add(spell.name);
    offered.push(spell);
  }
  return offered.sort((a, b) => a.name.localeCompare(b.name));
}

/** The spells the player picked for a slot that are still offered: a pick whose spell is switched off or no longer listed drops out. */
export function chosenSpellsOf(
  character: Character,
  feat: FeatData,
  grant: AdditionalSpells,
  slot: PickSlot,
  compendium: Compendium,
  activeBooks?: readonly string[]
): SpellData[] {
  const picked = character.ruleChoices?.find((entry) => entry.id === featSpellSlotChoiceId(feat, grant, slot))?.picked ?? [];
  if (picked.length === 0) return [];
  const offered = spellsMatching(slot.filter, compendium, activeBooks);
  const chosen: SpellData[] = [];
  for (const name of picked) {
    const spell = offered.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (spell) chosen.push(spell);
  }
  return chosen;
}

/** The title word a list gives its card: the list's name without its trailing "Spells". */
export function spellListLabel(listName: string): string {
  return listName.replace(/\s+Spells$/i, "");
}

/** The choice id of a feat's spell list pick. */
export function featSpellListChoiceId(feat: FeatData): string {
  return `${feat.source}__${FEAT_SPELLS_MARK}__${feat.name}__Spell List`;
}

/** The choice id of one slot of a grant: its feat, its list (or `-`), and its index. */
export function featSpellSlotChoiceId(feat: FeatData, grant: AdditionalSpells, slot: PickSlot): string {
  const list = typeof grant.name === "string" ? grant.name : UNNAMED_GRANT_KEY;
  return `${feat.source}__${FEAT_SPELLS_MARK}__${feat.name}__${list}__${slot.index}`;
}

/** Whether a Rule Choice id is one of the feat spell picks this module issues. */
export function isFeatSpellChoiceId(id: string): boolean {
  return id.split("__")[1] === FEAT_SPELLS_MARK;
}

/**
 * The feat spell picks the character is offered now: the spell list choice of each feat that offers lists, the picks of
 * the list the player has chosen, and the picks of each unnamed grant. Offered spells come from the active books.
 */
export function featSpellRuleChoices(character: Character, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  for (const { feat } of heldFeatsOf(character, compendium.for(activeBooks).feats())) {
    if (!feat.additionalSpells) continue;
    const lists = offeredSpellLists(feat);
    if (lists.length > 0) {
      out.push({
        id: featSpellListChoiceId(feat),
        traitName: `${feat.name} Spell List`,
        choose: 1,
        level: 1,
        effectLevel: 1,
        origin: "feat",
        options: lists.map((grant) => ({
          name: grant.name ?? "",
          description: `Casting ability: ${fixedGrantAbility(grant)?.toUpperCase() ?? ""}`,
        })),
      });
      const picked = pickedSpellListOf(character, feat);
      if (picked) out.push(...slotChoicesOf(feat, picked, compendium, activeBooks));
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name === "string" || typeof grant.ability !== "string") continue;
      out.push(...slotChoicesOf(feat, grant, compendium, activeBooks));
    }
  }
  return out;
}

/** The pick choices of one grant: one per slot, offering the spells of its filter. */
function slotChoicesOf(feat: FeatData, grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  return pickSlotsOf(grant).map((slot) => {
    const cantrip = parseSpellFilter(slot.filter).level === 0;
    return {
      id: featSpellSlotChoiceId(feat, grant, slot),
      traitName: `${feat.name} ${cantrip ? "Cantrip" : "Spell"}`,
      choose: slot.count,
      level: 1,
      effectLevel: 1,
      origin: "feat",
      options: spellsMatching(slot.filter, compendium, activeBooks).map((spell) => ({
        name: spell.name,
        description: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`}, ${spell.school}`,
      })),
    };
  });
}

/**
 * Releases the feat spell picks that no longer hold, with a review notice for each release. A pick is released when its
 * feat is no longer held, when its list is no longer the one picked, or (with the active books given) when the spell is no
 * longer offered. Picks of other choices are untouched. Returns the character itself when nothing changes.
 */
export function pruneInvalidFeatSpellPicks(character: Character, compendium: Compendium, activeBooks?: readonly string[]): Character {
  const entries = character.ruleChoices ?? [];
  if (!entries.some((entry) => isFeatSpellChoiceId(entry.id))) return character;

  const held = heldFeatsOf(character, compendium.for().feats());
  const heldKeys = new Set(held.map(({ feat }) => `${feat.source}__${feat.name}`));
  // The offered spells of each pick the character's held feats still make, keyed by the choice id.
  const valid = new Map<string, string[] | undefined>();
  for (const { feat } of held) {
    if (!feat.additionalSpells) continue;
    const lists = offeredSpellLists(feat);
    if (lists.length > 0) {
      valid.set(featSpellListChoiceId(feat), undefined);
      const picked = pickedSpellListOf(character, feat);
      if (picked) addSlots(valid, feat, picked, compendium, activeBooks);
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name !== "string" && typeof grant.ability === "string") addSlots(valid, feat, grant, compendium, activeBooks);
    }
  }

  const notices: string[] = [];
  const kept: RuleChoiceEntry[] = [];
  for (const entry of entries) {
    if (!isFeatSpellChoiceId(entry.id)) {
      kept.push(entry);
      continue;
    }
    if (!valid.has(entry.id)) {
      const [source, , featName] = entry.id.split("__");
      const reason = heldKeys.has(`${source}__${featName}`) ? "spell list changed" : "feat no longer held";
      notices.push(`${entry.trait} removed: ${reason}`);
      continue;
    }
    const offered = valid.get(entry.id);
    const picked = offered ? entry.picked.filter((name) => offered.includes(name)) : entry.picked;
    if (picked.length < entry.picked.length) {
      notices.push(`${entry.trait} ${entry.picked.filter((name) => !picked.includes(name)).join(", ")} removed: no longer offered`);
    }
    if (picked.length > 0) kept.push(picked.length === entry.picked.length ? entry : { ...entry, picked });
  }

  if (notices.length === 0 && kept.length === entries.length && kept.every((entry, i) => entry === entries[i])) return character;
  return {
    ...character,
    ruleChoices: kept,
    needsReview: Array.from(new Set([...(character.needsReview ?? []), ...notices])),
  };
}

/** Records, under each slot's choice id, the spells that slot offers (or undefined for a choice with no offer list). */
function addSlots(valid: Map<string, string[] | undefined>, feat: FeatData, grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]) {
  for (const slot of pickSlotsOf(grant)) {
    valid.set(
      featSpellSlotChoiceId(feat, grant, slot),
      spellsMatching(slot.filter, compendium, activeBooks).map((spell) => spell.name)
    );
  }
}

/** The feat spell picks of one feat the character holds, for the feat's own control on the builder. */
export function featSpellChoicesOf(
  character: Character,
  feat: { name: string; source: string },
  compendium: Compendium,
  activeBooks?: readonly string[]
): AvailableRuleChoice[] {
  const prefix = `${feat.source}__${FEAT_SPELLS_MARK}__${feat.name}__`;
  return featSpellRuleChoices(character, compendium, activeBooks).filter((choice) => choice.id.startsWith(prefix));
}
