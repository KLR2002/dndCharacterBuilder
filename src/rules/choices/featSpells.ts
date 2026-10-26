import type { AbilityKey, AsiSelection, Character, RuleChoiceEntry } from "../../types/character.ts";
import type { AdditionalSpells, FeatData, SpellData } from "../../types/dnd5e.ts";
import type { Compendium } from "../../services/compendium.ts";
import { ABILITY_NAMES } from "../abilities.ts";
import { isSpellAvailableForClass } from "../spellcasting.ts";
import { resolveSpellName } from "../subclassSpells.ts";
import type { AvailableRuleChoice } from "./types.ts";

/**
 * The spell picks a feat's grant asks for (ADR 0017). A feat that offers named spell lists is a choice between them: the
 * player picks one list, and that list's `choose` slots then take their spells. A grant without names has its slots directly.
 * A grant whose casting ability is a choice takes it from one Rule Choice the feat holds, saved once for all its grants.
 * Every pick is a Rule Choice of origin "feat", keyed by the feat and what it picks, so two feats never share a pick. The ids
 * are read by the reader and the reconciler; keep them in this module.
 */

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const FEAT_SPELLS_MARK = "Feat Spells";
const UNNAMED_GRANT_KEY = "-";
const ABILITY_CHOICE_KEY = "Casting Ability";

/** The school each one-letter code of a filter names, as the Catalog spells SpellData.school. */
const SCHOOL_BY_CODE: Readonly<Record<string, string>> = {
  A: "Abjuration",
  C: "Conjuration",
  D: "Divination",
  E: "Enchantment",
  I: "Illusion",
  N: "Necromancy",
  T: "Transmutation",
  V: "Evocation",
};

/** A feat the character holds, with the selection that gave it. */
export interface HeldFeat {
  feat: FeatData;
  selection: AsiSelection;
}

/**
 * A place in a grant where the player picks spells: its index among the grant's picks, how many, what it picks from, and the
 * uses of its key. A pick chooses from a filter, or from the named spells the grant lists.
 */
export interface PickSlot {
  index: number;
  count: number;
  /** The `key=value|key=value` filter the pick chooses from. Absent for a pick from named spells. */
  filter?: string;
  /** The named spells the pick chooses from. Absent for a filter pick. */
  from?: string[];
  /** Set for a daily or per-rest slot: the uses a Long Rest restores. Absent for a known or at-will slot. */
  uses?: number;
}

/**
 * The parsed `key=value|key=value` filter of a `choose` object. Keys this module does not model are listed, and match nothing.
 * A ritual filter is parsed so the reader can leave it out: the ritual book is not modelled (ADR 0017).
 */
export interface SpellFilter {
  level?: number;
  classes: string[];
  /** Full school names, as SpellData.school spells them. */
  schools: string[];
  /** Attack-roll kinds, lower case: m (melee), r (ranged), o (other). */
  attacks: string[];
  ritual: boolean;
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

/** The abilities a grant lets the player choose from, when its ability is a choice. Empty otherwise. */
export function chosenAbilityOptionsOf(grant: AdditionalSpells): AbilityKey[] {
  const ability = grant.ability;
  if (!ability || typeof ability !== "object" || !Array.isArray(ability.choose)) return [];
  const options: readonly string[] = ability.choose;
  return ABILITY_KEYS.filter((key) => options.includes(key));
}

/** The abilities the player may choose for a feat: those of its grants whose ability is a choice. The player picks one, once. */
export function featAbilityOptionsOf(feat: FeatData): AbilityKey[] {
  const options = new Set<AbilityKey>();
  for (const grant of feat.additionalSpells ?? []) for (const key of chosenAbilityOptionsOf(grant)) options.add(key);
  return ABILITY_KEYS.filter((key) => options.has(key));
}

/** The casting ability the player chose for a feat, if one is chosen and the feat offers it. */
export function pickedAbilityOf(character: Character, feat: FeatData): AbilityKey | undefined {
  const picked = character.ruleChoices?.find((entry) => entry.id === featAbilityChoiceId(feat))?.picked[0];
  return featAbilityOptionsOf(feat).find((key) => key === picked);
}

/** The named spell lists a feat offers. Every named grant is a list; the list's ability may be fixed or chosen. */
export function offeredSpellLists(feat: FeatData): AdditionalSpells[] {
  return (feat.additionalSpells ?? []).filter((grant) => typeof grant.name === "string");
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
      const { choose, count } = item as { choose?: unknown; count?: unknown };
      const usesField = uses !== undefined ? { uses } : {};
      if (typeof choose === "string") {
        // The ritual book is not modelled, so a ritual pick is left out without a notice (ADR 0017).
        if (parseSpellFilter(choose).ritual) continue;
        found.push({ count: countOf(count), filter: choose, ...usesField });
      } else if (choose && typeof choose === "object" && Array.isArray((choose as { from?: unknown }).from)) {
        const pick = choose as { from: unknown[]; count?: unknown };
        found.push({ count: countOf(pick.count), from: pick.from.filter((name): name is string => typeof name === "string"), ...usesField });
      }
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

/** How many spells a pick takes, as its `count` gives it; one when the source gives none. */
function countOf(count: unknown): number {
  return typeof count === "number" ? count : 1;
}

/** The uses a daily or per-rest key allows: `"1"` and `"1e"` are one use. */
export function usesOf(count: string): number {
  const uses = parseInt(count, 10);
  return Number.isFinite(uses) && uses > 0 ? uses : 1;
}

/**
 * Parses a `key=value|key=value` filter. A value may list several with `;` (classes, schools, attack-roll kinds). Any other
 * key is unknown.
 */
export function parseSpellFilter(filter: string): SpellFilter {
  const parsed: SpellFilter = { classes: [], schools: [], attacks: [], ritual: false, unknownKeys: [] };
  for (const part of filter.split("|")) {
    const eq = part.indexOf("=");
    const key = (eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase();
    const value = eq < 0 ? "" : part.slice(eq + 1).trim();
    const values = value.split(";").map((item) => item.trim()).filter(Boolean);
    if (key === "level" && /^\d+$/.test(value)) parsed.level = parseInt(value, 10);
    else if (key === "class" && values.length > 0) parsed.classes = values;
    else if (key === "school" && values.length > 0) parsed.schools = values.map((code) => SCHOOL_BY_CODE[code.toUpperCase()] ?? code);
    else if (key === "spell attack" && values.length > 0) parsed.attacks = values.map((kind) => kind.toLowerCase());
    else if (key === "components & miscellaneous" && value.toLowerCase() === "ritual") parsed.ritual = true;
    else parsed.unknownKeys.push(part.trim());
  }
  return parsed;
}

/**
 * The spells a filter offers: those of the filter's level, listed for one of its classes, with one of its schools and one of its
 * attack-roll kinds, in the active books (the same rule `isSpellAvailableForClass` applies, so the Alternative Spell Lists
 * count). Sorted by name. A filter with a key this module does not model, or a ritual filter, offers nothing.
 */
export function spellsMatching(filter: string, compendium: Compendium, activeBooks?: readonly string[]): SpellData[] {
  const parsed = parseSpellFilter(filter);
  if (parsed.unknownKeys.length > 0 || parsed.ritual) return [];
  const seen = new Set<string>();
  const offered: SpellData[] = [];
  for (const spell of compendium.for(activeBooks).spells()) {
    if (parsed.level !== undefined && spell.level !== parsed.level) continue;
    if (parsed.classes.length > 0 && !parsed.classes.some((cls) => isSpellAvailableForClass(spell, cls, activeBooks as string[] | undefined))) continue;
    if (parsed.schools.length > 0 && !parsed.schools.includes(spell.school)) continue;
    if (parsed.attacks.length > 0 && !(spell.spellAttack ?? []).some((kind) => parsed.attacks.includes(kind.toLowerCase()))) continue;
    if (seen.has(spell.name)) continue;
    seen.add(spell.name);
    offered.push(spell);
  }
  return offered.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The spells a pick slot offers: those its filter matches, or the named spells it chooses from that the active books hold.
 * A named spell that a switched-off book holds is not offered.
 */
export function offeredSpellsOf(slot: PickSlot, compendium: Compendium, activeBooks?: readonly string[]): SpellData[] {
  if (slot.filter !== undefined) return spellsMatching(slot.filter, compendium, activeBooks);
  const offered: SpellData[] = [];
  for (const name of slot.from ?? []) {
    const spell = resolveSpellName(name, activeBooks as string[] | undefined, compendium, { activeOnly: true });
    if (spell && !offered.some((candidate) => candidate.name === spell.name)) offered.push(spell);
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
  const offered = offeredSpellsOf(slot, compendium, activeBooks);
  const chosen: SpellData[] = [];
  for (const name of picked) {
    const spell = offered.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (spell) chosen.push(spell);
  }
  return chosen;
}

/** The name a spell list gives its card and its pick: the list's name without a trailing "Spells" or a number. */
export function spellListLabel(listName: string): string {
  return listName.replace(/\s+Spells$/i, "").replace(/\s+\d+$/, "");
}

/** The spells a grant gives outright, in its known groups. A `choose` object is a pick and is left out. */
export function fixedKnownSpellNamesOf(grant: AdditionalSpells): string[] {
  return Object.values(grant.known ?? {}).flatMap((list) =>
    Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [],
  );
}

/**
 * The label a named spell list is offered under: its spells that it gives outright, named (`Lorehold: Light, Sacred Flame`), or
 * the list's own name when it gives none outright.
 */
export function spellListOptionLabel(grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]): string {
  const name = grant.name ?? "";
  const fixed = fixedKnownSpellNamesOf(grant);
  if (fixed.length === 0) return name;
  const titles = fixed.map((spellName) => resolveSpellName(spellName, activeBooks as string[] | undefined, compendium)?.name ?? titleCase(spellName));
  return `${spellListLabel(name)}: ${titles.join(", ")}`;
}

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** The choice id of a feat's spell list pick. */
export function featSpellListChoiceId(feat: FeatData): string {
  return `${feat.source}__${FEAT_SPELLS_MARK}__${feat.name}__Spell List`;
}

/** The choice id of the casting ability the player picks for a feat, once for all its grants. */
export function featAbilityChoiceId(feat: FeatData): string {
  return `${feat.source}__${FEAT_SPELLS_MARK}__${feat.name}__${ABILITY_CHOICE_KEY}`;
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
 * the list the player has chosen, the casting ability of each feat with a choice of ability, and the picks of each unnamed
 * grant. Offered spells come from the active books.
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
        options: lists.map((grant) => {
          const fixed = chosenAbilityOptionsOf(grant).length === 0 ? fixedGrantAbility(grant) : undefined;
          return {
            name: grant.name ?? "",
            description: fixed ? `Casting ability: ${fixed.toUpperCase()}` : "Casting ability: chosen for the feat",
            label: spellListOptionLabel(grant, compendium, activeBooks),
          };
        }),
      });
      const picked = pickedSpellListOf(character, feat);
      if (picked) out.push(...slotChoicesOf(feat, picked, compendium, activeBooks));
    }
    const abilities = featAbilityOptionsOf(feat);
    if (abilities.length > 0) {
      out.push({
        id: featAbilityChoiceId(feat),
        traitName: `${feat.name} ${ABILITY_CHOICE_KEY}`,
        choose: 1,
        level: 1,
        effectLevel: 1,
        origin: "feat",
        options: abilities.map((key) => ({ name: key, description: `Casting ability: ${ABILITY_NAMES[key]}`, label: ABILITY_NAMES[key] })),
      });
    }
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name === "string") continue;
      out.push(...slotChoicesOf(feat, grant, compendium, activeBooks));
    }
  }
  return out;
}

/** The pick choices of one grant: one per slot, offering the spells the slot chooses from. */
function slotChoicesOf(feat: FeatData, grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  return pickSlotsOf(grant).map((slot) => {
    const cantrip = slot.filter !== undefined && parseSpellFilter(slot.filter).level === 0;
    return {
      id: featSpellSlotChoiceId(feat, grant, slot),
      traitName: `${feat.name} ${cantrip ? "Cantrip" : "Spell"}`,
      choose: slot.count,
      level: 1,
      effectLevel: 1,
      origin: "feat",
      options: offeredSpellsOf(slot, compendium, activeBooks).map((spell) => ({
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
  // The offered options of each pick the character's held feats still make, keyed by the choice id.
  const valid = new Map<string, string[] | undefined>();
  for (const { feat } of held) {
    if (!feat.additionalSpells) continue;
    const lists = offeredSpellLists(feat);
    if (lists.length > 0) {
      valid.set(featSpellListChoiceId(feat), undefined);
      const picked = pickedSpellListOf(character, feat);
      if (picked) addSlots(valid, feat, picked, compendium, activeBooks);
    }
    const abilities = featAbilityOptionsOf(feat);
    if (abilities.length > 0) valid.set(featAbilityChoiceId(feat), abilities);
    for (const grant of feat.additionalSpells) {
      if (typeof grant.name !== "string") addSlots(valid, feat, grant, compendium, activeBooks);
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

/** Records, under each slot's choice id, the spells that slot offers. */
function addSlots(valid: Map<string, string[] | undefined>, feat: FeatData, grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]) {
  for (const slot of pickSlotsOf(grant)) {
    valid.set(
      featSpellSlotChoiceId(feat, grant, slot),
      offeredSpellsOf(slot, compendium, activeBooks).map((spell) => spell.name)
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
