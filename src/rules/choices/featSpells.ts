import type { AbilityKey, AsiSelection, Character, RuleChoiceEntry } from "../../types/character.ts";
import type { AdditionalSpells, FeatData, RaceData, SpellData, SubraceData } from "../../types/dnd5e.ts";
import type { Compendium } from "../../services/compendium.ts";
import { BACKGROUND_FEAT_SOURCE } from "../../constants/rules.ts";
import { ABILITY_NAMES } from "../abilities.ts";
import { totalLevel } from "../proficiencies.ts";
import { isSpellAvailableForClass } from "../spellcasting.ts";
import { resolveSpellName } from "../subclassSpells.ts";
import { ruleChoiceId, type AvailableRuleChoice, type RuleChoiceOrigin } from "./types.ts";

/**
 * The spell picks a granted spell source asks for (ADR 0017). A grant's owner is a feat the character holds or the race or
 * subrace whose grant it is. A feat that offers named spell lists is a choice between them: the player picks one list, and
 * that list's `choose` slots then take their spells. A grant whose casting ability is a choice takes it from one Rule Choice
 * its owner holds, saved once for all its grants. Every pick is a Rule Choice keyed by its owner and what it picks, so two
 * owners never share a pick. The ids are read by the reader and the reconciler; keep them in this module.
 */

const ABILITY_KEYS: readonly AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
const UNNAMED_GRANT_KEY = "-";
const ABILITY_CHOICE_KEY = "Casting Ability";
const SPELL_LIST_KEY = "Spell List";

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

/**
 * A Rule Choice the descent or subrace option named here switches on: the subrace's spell grant is read only when the
 * player picked the option. The catalog lists the grant whatever the pick, so the gate is a pointer from a frozen Rule
 * Choice id to the option that opens it (ADR 0014). Only the Cantrip option of the Moon or Sun Elf descent is gated.
 */
const GRANT_GATED_BY_OPTION: ReadonlyMap<string, string> = new Map([
  ["SCAG__Half-Elf__Moon Elf or Sun Elf Descent__Variant Feature (Choose 1)", "Cantrip"],
]);

/** The mark each kind of owner puts in its pick ids. */
const OWNER_MARK: Record<GrantOwner["kind"], string> = { feat: "Feat Spells", race: "Race Spells" };

/**
 * Whose spell grant a pick is for: a feat the character holds, or the race or subrace record that gives the grant. `source`
 * and `name` are the owner's own record, so two owners of one kind never collide.
 */
export interface GrantOwner {
  kind: "feat" | "race";
  source: string;
  name: string;
}

/** A feat the character holds, with the selection that gave it. */
export interface HeldFeat {
  feat: FeatData;
  selection: AsiSelection;
}

/** The grants of one owner the character holds. A feat carries its record, so its named lists can be read. */
export interface HeldGrants {
  owner: GrantOwner;
  grants: AdditionalSpells[];
  feat?: FeatData;
}

/** A race's or subrace's grants, with the record that owns them. */
export interface RaceGrants {
  owner: GrantOwner;
  grants: AdditionalSpells[];
}

/**
 * A place in a grant where the player picks spells: its index among the grant's picks, how many, what it picks from, the uses
 * of its key and the character level it unlocks at. A pick chooses from a filter, or from the named spells the grant lists.
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
  /** The level the grant unlocks the slot at: 1 for a feat's, the section key for a race's. */
  minCharacterLevel: number;
}

/** One entry of a grant: a spell it gives, or a place where the player picks one. */
export interface GrantSpell {
  kind: "spell";
  name: string;
  minCharacterLevel: number;
  /** Set under a `daily` or `rest` key: the uses per Long Rest. Absent for at-will spells. */
  uses?: number;
}

export interface GrantPick {
  kind: "pick";
  choose: string | { from: string[] };
  count: number;
  minCharacterLevel: number;
  uses?: number;
}

export type GrantEntry = GrantSpell | GrantPick;

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

/** The owner of a feat's grants. */
export function featOwner(feat: { name: string; source: string }): GrantOwner {
  return { kind: "feat", source: feat.source, name: feat.name };
}

/** The owner of a race's or subrace's grants: the record that gives them. */
function raceOwner(record: { name: string; source: string }): GrantOwner {
  return { kind: "race", source: record.source, name: record.name };
}

/** The key an owner's picks share: its source, its kind's mark and its name. */
export function ownerKey(owner: GrantOwner): string {
  return `${owner.source}__${OWNER_MARK[owner.kind]}__${owner.name}`;
}

/** The Rule Choice origin of an owner's picks. */
function originOf(owner: GrantOwner): RuleChoiceOrigin {
  return owner.kind === "feat" ? "feat" : "race";
}

/**
 * The feat record a selection names. A feat a background grants carries the Background source marker, which is no
 * sourcebook, so it resolves by name; the first record of that name is taken.
 */
export function featOfSelection(selection: AsiSelection, feats: FeatData[]): FeatData | undefined {
  const named = feats.filter((f) => f.name === selection.featName);
  if (!selection.featSource || selection.featSource === BACKGROUND_FEAT_SOURCE) return named[0];
  return named.find((f) => f.source === selection.featSource);
}

/** Each feat the character holds once, in the order the character recorded them. */
export function heldFeatsOf(character: Character, feats: FeatData[]): HeldFeat[] {
  const held: HeldFeat[] = [];
  for (const selection of [...(character.asiSelections ?? []), ...(character.originFeats ?? [])]) {
    if (selection.type !== "feat") continue;
    const feat = featOfSelection(selection, feats);
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

/** The abilities the player may choose for an owner: those of its grants whose ability is a choice. The player picks one, once. */
export function abilityOptionsOfGrants(grants: readonly AdditionalSpells[]): AbilityKey[] {
  const options = new Set<AbilityKey>();
  for (const grant of grants) for (const key of chosenAbilityOptionsOf(grant)) options.add(key);
  return ABILITY_KEYS.filter((key) => options.has(key));
}

/** The casting ability the player chose for an owner, if one is recorded. A grant checks it against its own options. */
export function pickedAbilityOf(character: Character, owner: GrantOwner): AbilityKey | undefined {
  const picked = character.ruleChoices?.find((entry) => entry.id === abilityChoiceId(owner))?.picked[0];
  return (ABILITY_KEYS as readonly string[]).includes(picked ?? "") ? (picked as AbilityKey) : undefined;
}

/** The named spell lists a grant set offers. Every named grant is a list; the list's ability may be fixed or chosen. */
export function offeredSpellLists(grants: readonly AdditionalSpells[]): AdditionalSpells[] {
  return grants.filter((grant) => typeof grant.name === "string");
}

/** The grant of the spell list the player picked for an owner, if one is picked. */
export function pickedSpellListOf(character: Character, owner: GrantOwner, grants: readonly AdditionalSpells[]): AdditionalSpells | undefined {
  const picked = character.ruleChoices?.find((entry) => entry.id === spellListChoiceId(owner))?.picked[0];
  if (!picked) return undefined;
  return offeredSpellLists(grants).find((grant) => grant.name === picked);
}

/**
 * Every entry of a grant in its known and innate sections, in section and key order. A key is a character level for a race
 * (the level the entry unlocks at) and `_` for a feat (no level gate beyond the feat itself). A list is at will unless it sits
 * under a `daily` or `rest` key, which give its uses per Long Rest. A `choose` object is a pick. A `ritual` list is left out.
 */
export function grantEntries(grant: AdditionalSpells): GrantEntry[] {
  const entries: GrantEntry[] = [];
  for (const section of [grant.known, grant.innate]) {
    if (!section || typeof section !== "object") continue;
    for (const [key, value] of Object.entries(section)) {
      const minCharacterLevel = key === "_" ? 1 : Number(key);
      if (!Number.isFinite(minCharacterLevel)) continue;
      collectEntries(value, minCharacterLevel, undefined, entries);
    }
  }
  return entries;
}

function collectEntries(value: unknown, minCharacterLevel: number, uses: number | undefined, out: GrantEntry[]): void {
  const usesField = uses !== undefined ? { uses } : {};
  if (typeof value === "string") {
    out.push({ kind: "spell", name: value, minCharacterLevel, ...usesField });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEntries(item, minCharacterLevel, uses, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if ("choose" in record) {
    const payload = record.choose;
    if (typeof payload === "string") {
      out.push({ kind: "pick", choose: payload, count: countOf(record.count), minCharacterLevel, ...usesField });
    } else if (payload && typeof payload === "object" && Array.isArray((payload as { from?: unknown }).from)) {
      const from = ((payload as { from: unknown[] }).from).filter((name): name is string => typeof name === "string");
      out.push({ kind: "pick", choose: { from }, count: countOf((payload as { count?: unknown }).count), minCharacterLevel, ...usesField });
    }
    return;
  }
  for (const [key, inner] of Object.entries(record)) {
    if (key === "daily" || key === "rest") {
      if (inner && typeof inner === "object") {
        for (const [count, names] of Object.entries(inner)) collectEntries(names, minCharacterLevel, usesOf(count), out);
      }
    } else if (key === "will" || key === "_") {
      collectEntries(inner, minCharacterLevel, uses, out);
    }
  }
}

/**
 * The pick slots of a grant, in order: the picks its known entries make, then those of its innate entries. A ritual pick is
 * not a slot (the ritual book is not modelled, ADR 0017).
 */
export function pickSlotsOf(grant: AdditionalSpells): PickSlot[] {
  const slots: PickSlot[] = [];
  for (const entry of grantEntries(grant)) {
    if (entry.kind !== "pick") continue;
    const choose = entry.choose;
    if (typeof choose === "string" && parseSpellFilter(choose).ritual) continue;
    slots.push({
      index: slots.length,
      count: entry.count,
      minCharacterLevel: entry.minCharacterLevel,
      ...(typeof choose === "string" ? { filter: choose } : { from: choose.from }),
      ...(entry.uses !== undefined ? { uses: entry.uses } : {}),
    });
  }
  return slots;
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
  owner: GrantOwner,
  grant: AdditionalSpells,
  slot: PickSlot,
  compendium: Compendium,
  activeBooks?: readonly string[]
): SpellData[] {
  const picked = character.ruleChoices?.find((entry) => entry.id === grantSlotChoiceId(owner, grant, slot))?.picked ?? [];
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

/** The choice id of an owner's spell list pick. */
export function spellListChoiceId(owner: GrantOwner): string {
  return `${ownerKey(owner)}__${SPELL_LIST_KEY}`;
}

const FEAT_COUNTER_PREFIX = "innate_feat__";
const COUNTER_SEGMENT = "__";

/** A name as a counter or choice id segment: lower case, with runs of other characters as one underscore. Never holds "__". */
export function slugOf(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * The counter id of a feat's daily or per-rest spell: the feat, the spell list it was picked from (when named) and the spell.
 * Each segment is closed by "__", so one feat's counters never begin with another feat's prefix.
 */
export function featCounterId(featName: string, listName: string | undefined, spellName: string): string {
  const list = listName ? `${slugOf(listName)}${COUNTER_SEGMENT}` : "";
  return `${FEAT_COUNTER_PREFIX}${slugOf(featName)}${COUNTER_SEGMENT}${list}${slugOf(spellName)}`;
}

/** The choice id of a feat's spell list pick. */
export function featSpellListChoiceId(feat: FeatData): string {
  return spellListChoiceId(featOwner(feat));
}

/** The choice id of the casting ability the player picks for an owner, once for all its grants. */
export function abilityChoiceId(owner: GrantOwner): string {
  return `${ownerKey(owner)}__${ABILITY_CHOICE_KEY}`;
}

/** The choice id of one slot of a grant: its owner, its list (or `-`), and its index. */
export function grantSlotChoiceId(owner: GrantOwner, grant: AdditionalSpells, slot: PickSlot): string {
  const list = typeof grant.name === "string" ? grant.name : UNNAMED_GRANT_KEY;
  return `${ownerKey(owner)}__${list}__${slot.index}`;
}

/** Whether a Rule Choice id is one of the granted spell picks this module issues (a feat's or a race's). */
export function isGrantSpellChoiceId(id: string): boolean {
  const mark = id.split("__")[1];
  return mark === OWNER_MARK.feat || mark === OWNER_MARK.race;
}

/**
 * The race or subrace whose spell grant the character has, read from the catalog. A subrace whose grants exist replaces the
 * race's, as its trait takes the place of the race's Innate Magic, unless the subrace's option gate is shut (see
 * GRANT_GATED_BY_OPTION). Undefined when neither gives spells.
 */
export function raceGrantsOf(character: Character, races: RaceData[]): RaceGrants | undefined {
  // A lineage replacement stands in for the race, as the catalog resolves it.
  const lineage = character.lineageReplacement ? races.find((r) => r.name === character.lineageReplacement) : undefined;
  if (lineage) return lineage.additionalSpells?.length ? { owner: raceOwner(lineage), grants: lineage.additionalSpells } : undefined;

  const choice = character.race;
  if (!choice) return undefined;
  const race = races.find((r) => r.name === choice.name && (!choice.source || r.source === choice.source));
  const subrace = race?.subraces?.find(
    (s) => s.name === choice.subraceName && (!choice.subraceSource || s.source === choice.subraceSource)
  );
  if (subrace?.additionalSpells?.length && subraceGrantOpen(character, subrace)) {
    return { owner: raceOwner(subrace), grants: subrace.additionalSpells };
  }
  if (race?.additionalSpells?.length) return { owner: raceOwner(race), grants: race.additionalSpells };
  return undefined;
}

/** Whether every option gate on a subrace's choices is open: the player picked each gating option. */
function subraceGrantOpen(character: Character, subrace: SubraceData): boolean {
  for (const trait of subrace.traits ?? []) {
    if (!trait.choice) continue;
    const id = ruleChoiceId({ source: subrace.source, race: character.race?.name ?? "", subrace: { name: subrace.name }, trait: trait.name });
    const gate = GRANT_GATED_BY_OPTION.get(id);
    if (gate === undefined) continue;
    const picked = character.ruleChoices?.find((entry) => entry.id === id)?.picked ?? [];
    if (!picked.includes(gate)) return false;
  }
  return true;
}

/** Every owner of spell grants the character holds: its feats (with their records) and its race or subrace. */
export function heldGrantsOf(character: Character, feats: FeatData[], races: RaceData[]): HeldGrants[] {
  const held: HeldGrants[] = [];
  for (const { feat } of heldFeatsOf(character, feats)) {
    if (feat.additionalSpells) held.push({ owner: featOwner(feat), grants: feat.additionalSpells, feat });
  }
  const race = raceGrantsOf(character, races);
  if (race) held.push({ owner: race.owner, grants: race.grants });
  return held;
}

/** The feat-spell Rule Choices the character is offered now, for every feat it holds. Offered spells come from the active books. */
export function featSpellRuleChoices(character: Character, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  for (const { feat } of heldFeatsOf(character, compendium.for(activeBooks).feats())) {
    if (feat.additionalSpells) out.push(...grantChoicesOf(character, featOwner(feat), feat.additionalSpells, compendium, activeBooks));
  }
  return out;
}

/**
 * The race spell Rule Choices the character is offered now: its casting ability when the race lets the player choose it, and
 * the picks of its grant (each from the level it unlocks at). Offered spells come from the active books.
 */
export function raceSpellRuleChoices(character: Character, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  const race = raceGrantsOf(character, compendium.for(activeBooks).races());
  return race ? grantChoicesOf(character, race.owner, race.grants, compendium, activeBooks) : [];
}

/** The Rule Choices one owner's grants offer: its spell list, the picks of the list chosen, its casting ability and its unnamed picks. */
function grantChoicesOf(
  character: Character,
  owner: GrantOwner,
  grants: AdditionalSpells[],
  compendium: Compendium,
  activeBooks?: readonly string[]
): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  const lists = offeredSpellLists(grants);
  if (lists.length > 0) {
    out.push({
      id: spellListChoiceId(owner),
      traitName: `${owner.name} Spell List`,
      choose: 1,
      level: 1,
      effectLevel: 1,
      origin: originOf(owner),
      options: lists.map((grant) => {
        const fixed = chosenAbilityOptionsOf(grant).length === 0 ? fixedGrantAbility(grant) : undefined;
        return {
          name: grant.name ?? "",
          description: fixed ? `Casting ability: ${fixed.toUpperCase()}` : "Casting ability: chosen for the feat",
          label: spellListOptionLabel(grant, compendium, activeBooks),
        };
      }),
    });
    const picked = pickedSpellListOf(character, owner, grants);
    if (picked) out.push(...slotChoicesOf(character, owner, picked, compendium, activeBooks));
  }
  const abilities = abilityOptionsOfGrants(grants);
  if (abilities.length > 0) {
    out.push({
      id: abilityChoiceId(owner),
      traitName: `${owner.name} ${ABILITY_CHOICE_KEY}`,
      choose: 1,
      level: 1,
      effectLevel: 1,
      origin: originOf(owner),
      options: abilities.map((key) => ({ name: key, description: `Casting ability: ${ABILITY_NAMES[key]}`, label: ABILITY_NAMES[key] })),
    });
  }
  for (const grant of grants) {
    if (typeof grant.name === "string") continue;
    out.push(...slotChoicesOf(character, owner, grant, compendium, activeBooks));
  }
  return out;
}

/** The pick choices of one grant: one per slot the character has reached, offering the spells the slot chooses from. */
function slotChoicesOf(character: Character, owner: GrantOwner, grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]): AvailableRuleChoice[] {
  const level = totalLevel(character);
  return pickSlotsOf(grant)
    .filter((slot) => slot.minCharacterLevel <= level)
    .map((slot) => {
      const cantrip = slot.filter !== undefined && parseSpellFilter(slot.filter).level === 0;
      return {
        id: grantSlotChoiceId(owner, grant, slot),
        traitName: `${owner.name} ${cantrip ? "Cantrip" : "Spell"}`,
        choose: slot.count,
        level: slot.minCharacterLevel,
        effectLevel: slot.minCharacterLevel,
        origin: originOf(owner),
        options: offeredSpellsOf(slot, compendium, activeBooks).map((spell) => ({
          name: spell.name,
          description: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`}, ${spell.school}`,
        })),
      };
    });
}

/**
 * Releases the granted spell picks that no longer hold, with a review notice for each release. A pick is released when its
 * owner is no longer held, when its list is no longer the one picked, or (with the active books given) when the spell is no
 * longer offered. Picks of other choices are untouched. Returns the character itself when nothing changes.
 */
export function pruneInvalidFeatSpellPicks(character: Character, compendium: Compendium, activeBooks?: readonly string[]): Character {
  const entries = character.ruleChoices ?? [];
  if (!entries.some((entry) => isGrantSpellChoiceId(entry.id))) return character;

  const held = heldGrantsOf(character, compendium.for().feats(), compendium.for().races());
  const heldKeys = new Set(held.map(({ owner }) => ownerKey(owner)));
  // The offered options of each pick the character's owners still make, keyed by the choice id.
  const valid = new Map<string, string[] | undefined>();
  for (const { owner, grants, feat } of held) {
    if (feat && offeredSpellLists(grants).length > 0) {
      valid.set(spellListChoiceId(owner), undefined);
      const picked = pickedSpellListOf(character, owner, grants);
      if (picked) addSlots(valid, character, owner, picked, compendium, activeBooks);
    }
    const abilities = abilityOptionsOfGrants(grants);
    if (abilities.length > 0) valid.set(abilityChoiceId(owner), abilities);
    for (const grant of grants) {
      if (typeof grant.name !== "string") addSlots(valid, character, owner, grant, compendium, activeBooks);
    }
  }

  const notices: string[] = [];
  const kept: RuleChoiceEntry[] = [];
  for (const entry of entries) {
    if (!isGrantSpellChoiceId(entry.id)) {
      kept.push(entry);
      continue;
    }
    if (!valid.has(entry.id)) {
      const [source, mark, name] = entry.id.split("__");
      const isFeat = mark === OWNER_MARK.feat;
      const heldOwner = heldKeys.has(`${source}__${mark}__${name}`);
      const reason = !heldOwner
        ? (isFeat ? "feat no longer held" : "ancestry no longer grants it")
        : (isFeat ? "spell list changed" : "no longer offered");
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

/**
 * Releases the long-rest counters of the feats the character no longer holds, with a review notice for each. A counter is a
 * feat's when its id begins with the feat prefix; the feat it names is the segment after it. Other counters are untouched.
 * Returns the character itself when none is released.
 */
export function pruneReleasedFeatCounters(character: Character, compendium: Compendium): Character {
  const counters = character.resourceCounters ?? {};
  const featKeys = Object.keys(counters).filter((key) => key.startsWith(FEAT_COUNTER_PREFIX));
  if (featKeys.length === 0) return character;

  const heldSlugs = new Set(heldFeatsOf(character, compendium.for().feats()).map(({ feat }) => slugOf(feat.name)));
  const released = featKeys.filter((key) => !heldSlugs.has(key.slice(FEAT_COUNTER_PREFIX.length).split(COUNTER_SEGMENT)[0]));
  if (released.length === 0) return character;

  const nextCounters = { ...counters };
  const notices: string[] = [];
  for (const key of released) {
    notices.push(`${counters[key].name} removed: feat no longer held`);
    delete nextCounters[key];
  }
  return {
    ...character,
    resourceCounters: nextCounters,
    needsReview: Array.from(new Set([...(character.needsReview ?? []), ...notices])),
  };
}

/** Records, under each slot's choice id, the spells that slot offers at the character's level. */
function addSlots(
  valid: Map<string, string[] | undefined>,
  character: Character,
  owner: GrantOwner,
  grant: AdditionalSpells,
  compendium: Compendium,
  activeBooks?: readonly string[]
) {
  const level = totalLevel(character);
  for (const slot of pickSlotsOf(grant)) {
    if (slot.minCharacterLevel > level) continue;
    valid.set(
      grantSlotChoiceId(owner, grant, slot),
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
  const prefix = `${ownerKey(featOwner(feat))}__`;
  return featSpellRuleChoices(character, compendium, activeBooks).filter((choice) => choice.id.startsWith(prefix));
}

/**
 * The Rule Choice id a race's legacy High Elf cantrip was saved under (the old race table's pick, ADR 0017). Its value is frozen:
 * the migration reads it, and no new pick is saved under it.
 */
export const LEGACY_HIGH_ELF_CANTRIP_CHOICE_ID = "PHB__Elf__PHB__High Elf__Cantrip";

/**
 * Moves a saved High Elf or Half-Elf descent wizard cantrip to the race's own pick (ADR 0017). The cantrip was saved under the
 * legacy Rule Choice id, or as a known spell under the legacy `racial__innate` owner key. Both are released. The cantrip moves to
 * the race's wizard cantrip slot when the character's race still grants one. Otherwise it is released with a review notice. A
 * cantrip the offered spells no longer include is released by the reconciler, on the next open of the character.
 */
export function migrateLegacyRacialCantrip(character: Character, races: RaceData[]): Character {
  const legacyEntries = (character.ruleChoices ?? []).filter((entry) => entry.id === LEGACY_HIGH_ELF_CANTRIP_CHOICE_ID);
  const legacyKnown = (character.knownSpells ?? []).filter((spell) => spell.ownerKey === "racial__innate");
  if (legacyEntries.length === 0 && legacyKnown.length === 0) return character;

  const cleaned: Character = {
    ...character,
    ruleChoices: (character.ruleChoices ?? []).filter((entry) => entry.id !== LEGACY_HIGH_ELF_CANTRIP_CHOICE_ID),
    knownSpells: (character.knownSpells ?? []).filter((spell) => spell.ownerKey !== "racial__innate"),
  };
  const picked = legacyEntries.flatMap((entry) => entry.picked)[0] ?? legacyKnown[0]?.name;
  if (!picked) return cleaned;

  const race = raceGrantsOf(cleaned, races);
  const slot = race ? wizardCantripSlotOf(race.grants) : undefined;
  if (!race || !slot) {
    const notice = "High Elf Cantrip removed: the ancestry no longer grants a wizard cantrip";
    return { ...cleaned, needsReview: Array.from(new Set([...(cleaned.needsReview ?? []), notice])) };
  }
  const entry: RuleChoiceEntry = {
    id: grantSlotChoiceId(race.owner, slot.grant, slot.slot),
    trait: `${race.owner.name} Cantrip`,
    origin: "race",
    choose: 1,
    from: [picked],
    picked: [picked],
  };
  return { ...cleaned, ruleChoices: [...(cleaned.ruleChoices ?? []), entry] };
}

/** The pick of a grant that takes one wizard cantrip, with the grant it sits in. */
function wizardCantripSlotOf(grants: AdditionalSpells[]): { grant: AdditionalSpells; slot: PickSlot } | undefined {
  for (const grant of grants) {
    for (const slot of pickSlotsOf(grant)) {
      if (!slot.filter) continue;
      const parsed = parseSpellFilter(slot.filter);
      if (parsed.level === 0 && parsed.classes.some((cls) => cls.toLowerCase() === "wizard")) return { grant, slot };
    }
  }
  return undefined;
}
