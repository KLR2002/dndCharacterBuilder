import type { AbilityKey, AsiSelection, Character, RuleChoiceEntry } from "../../types/character.ts";
import type { AdditionalSpells, FeatData, RaceData, SpellData } from "../../types/dnd5e.ts";
import type { Compendium, CompendiumListings } from "../../services/compendium.ts";
import { BACKGROUND_FEAT_SOURCE } from "../../constants/rules.ts";
import { ABILITIES, ABILITY_NAMES } from "../abilities.ts";
import { withNotices } from "../needsReview.ts";
import { totalLevel } from "../proficiencies.ts";
import { isSpellAvailableForClass } from "../spellcasting.ts";
import { resolveSpellName } from "../subclassSpells.ts";
import type { AvailableRuleChoice, RuleChoiceOrigin } from "./types.ts";

/**
 * The spell picks a granted spell source asks for (ADR 0017). A grant's owner is a feat the character holds or the race or
 * subrace whose grant it is. A feat that offers named spell lists is a choice between them: the player picks one list, and
 * that list's `choose` slots then take their spells. A grant whose casting ability is a choice takes it from one Rule Choice
 * its owner holds, saved once for all its grants. Every pick is a Rule Choice keyed by its owner and what it picks, so two
 * owners never share a pick. The ids are read by the reader and the reconciler; keep them in this module.
 */

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
interface HeldFeat {
  feat: FeatData;
  selection: AsiSelection;
}

/** The grants of one owner the character holds. A feat carries its record, so its named lists can be read. */
interface HeldGrants {
  owner: GrantOwner;
  grants: AdditionalSpells[];
  feat?: FeatData;
}

/** A race's or subrace's grants, with the record that owns them. */
interface RaceGrants {
  owner: GrantOwner;
  grants: AdditionalSpells[];
}

/**
 * A place in a grant where the player picks spells: its index among the grant's picks, how many, what it picks from, the uses
 * of its key, whether it sits in a known group and the character level it unlocks at. A pick chooses from a filter, or from
 * the named spells the grant lists.
 */
interface PickSlot {
  index: number;
  count: number;
  /** The `key=value|key=value` filter the pick chooses from. Absent for a pick from named spells. */
  filter?: string;
  /** The named spells the pick chooses from. Absent for a filter pick. */
  from?: string[];
  /** Set for a daily or per-rest slot: the uses a Long Rest restores. Absent for a known or at-will slot. */
  uses?: number;
  /** Whether the slot sits in a known group (see usesOfEntry). */
  fromKnown: boolean;
  /** The level the grant unlocks the slot at: 1 for a feat's, the section key for a race's. */
  minCharacterLevel: number;
}

/** One entry of a grant: a spell it gives, or a place where the player picks one. */
interface GrantSpell {
  kind: "spell";
  name: string;
  minCharacterLevel: number;
  /** Set under a `daily` or `rest` key: the uses per Long Rest. Absent for at-will spells. */
  uses?: number;
  /** Whether the spell sits in a known group (see usesOfEntry). */
  fromKnown: boolean;
}

interface GrantPick {
  kind: "pick";
  choose: string | { from: string[] };
  count: number;
  minCharacterLevel: number;
  uses?: number;
  fromKnown: boolean;
}

/**
 * The uses per Long Rest a granted spell carries, read from its entry and the spell's own level. A daily or per-rest key gives
 * its uses. A leveled spell of a known group is cast once per Long Rest too; a cantrip of one, and any spell of an innate
 * at-will list, is at will (undefined).
 */
export function usesOfEntry(entry: { uses?: number; fromKnown: boolean }, spellLevel: number): number | undefined {
  if (entry.uses !== undefined) return entry.uses;
  return entry.fromKnown && spellLevel > 0 ? 1 : undefined;
}

type GrantEntry = GrantSpell | GrantPick;

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
  return typeof ability === "string" && (ABILITIES as readonly string[]).includes(ability) ? (ability as AbilityKey) : undefined;
}

/** The abilities a grant lets the player choose from, when its ability is a choice. Empty otherwise. */
export function chosenAbilityOptionsOf(grant: AdditionalSpells): AbilityKey[] {
  const ability = grant.ability;
  if (!ability || typeof ability !== "object" || !Array.isArray(ability.choose)) return [];
  const options: readonly string[] = ability.choose;
  return ABILITIES.filter((key) => options.includes(key));
}

/** The abilities the player may choose for an owner: those of its modelled grants whose ability is a choice. The player picks one, once. */
function abilityOptionsOfGrants(grants: readonly AdditionalSpells[]): AbilityKey[] {
  const options = new Set<AbilityKey>();
  for (const grant of grants.filter(isModelledGrant)) for (const key of chosenAbilityOptionsOf(grant)) options.add(key);
  return ABILITIES.filter((key) => options.has(key));
}

/** The casting ability the player chose for an owner, if one is recorded. A grant checks it against its own options. */
export function pickedAbilityOf(character: Character, owner: GrantOwner): AbilityKey | undefined {
  const picked = character.ruleChoices?.find((entry) => entry.id === abilityChoiceId(owner))?.picked[0];
  return (ABILITIES as readonly string[]).includes(picked ?? "") ? (picked as AbilityKey) : undefined;
}

/** The named spell lists a grant set offers: the named grants the reader models. The list's ability may be fixed or chosen. */
export function offeredSpellLists(grants: readonly AdditionalSpells[]): AdditionalSpells[] {
  return grants.filter((grant) => typeof grant.name === "string" && isModelledGrant(grant));
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
 * An entry of the known section is marked, since a leveled one of it is cast once per Long Rest (see usesOfEntry).
 */
export function grantEntries(grant: AdditionalSpells): GrantEntry[] {
  const entries: GrantEntry[] = [];
  for (const [section, fromKnown] of [
    [grant.known, true],
    [grant.innate, false],
  ] as const) {
    if (!section || typeof section !== "object") continue;
    for (const [key, value] of Object.entries(section)) {
      const minCharacterLevel = key === "_" ? 1 : Number(key);
      if (!Number.isFinite(minCharacterLevel)) continue;
      collectEntries(value, minCharacterLevel, undefined, entries, fromKnown);
    }
  }
  return entries;
}

function collectEntries(value: unknown, minCharacterLevel: number, uses: number | undefined, out: GrantEntry[], fromKnown: boolean): void {
  const usesField = uses !== undefined ? { uses } : {};
  if (typeof value === "string") {
    out.push({ kind: "spell", name: value, minCharacterLevel, ...usesField, fromKnown });
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectEntries(item, minCharacterLevel, uses, out, fromKnown);
    return;
  }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if ("choose" in record) {
    const payload = record.choose;
    if (typeof payload === "string") {
      out.push({ kind: "pick", choose: payload, count: countOf(record.count), minCharacterLevel, ...usesField, fromKnown });
    } else if (payload && typeof payload === "object" && Array.isArray((payload as { from?: unknown }).from)) {
      const from = ((payload as { from: unknown[] }).from).filter((name): name is string => typeof name === "string");
      out.push({
        kind: "pick",
        choose: { from },
        count: countOf((payload as { count?: unknown }).count),
        minCharacterLevel,
        ...usesField,
        fromKnown,
      });
    }
    return;
  }
  for (const [key, inner] of Object.entries(record)) {
    if (key === "daily" || key === "rest") {
      if (inner && typeof inner === "object") {
        for (const [count, names] of Object.entries(inner)) collectEntries(names, minCharacterLevel, usesOf(count), out, fromKnown);
      }
    } else if (key === "will" || key === "_") {
      collectEntries(inner, minCharacterLevel, uses, out, fromKnown);
    }
  }
}

/**
 * Whether the reader can fill a pick: a named list is always fillable, and a filter is when it is not a ritual filter and every
 * one of its keys is one the reader models. A pick that cannot be filled is never offered.
 */
function isFillablePick(choose: string | { from: string[] }): boolean {
  if (typeof choose !== "string") return true;
  const parsed = parseSpellFilter(choose);
  return !parsed.ritual && parsed.unknownKeys.length === 0;
}

/**
 * Whether the reader models a grant: it gives a spell, or it has a pick it can fill. A grant with neither (a prepared group,
 * or ritual spells only) is not modelled, so it gives no card and offers no pick.
 */
export function isModelledGrant(grant: AdditionalSpells): boolean {
  return grantEntries(grant).some((entry) => entry.kind === "spell" || (entry.kind === "pick" && isFillablePick(entry.choose)));
}

/**
 * The pick slots of a grant, in order: the picks its known entries make, then those of its innate entries. A pick that cannot
 * be filled is not a slot: a ritual pick (the ritual book is not modelled, ADR 0017) or one with a key the reader does not model.
 */
export function pickSlotsOf(grant: AdditionalSpells): PickSlot[] {
  const slots: PickSlot[] = [];
  for (const entry of grantEntries(grant)) {
    if (entry.kind !== "pick") continue;
    const choose = entry.choose;
    if (!isFillablePick(choose)) continue;
    slots.push({
      index: slots.length,
      count: entry.count,
      fromKnown: entry.fromKnown,
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
function usesOf(count: string): number {
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
function spellsMatching(filter: string, compendium: Compendium, activeBooks?: readonly string[]): SpellData[] {
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
function offeredSpellsOf(slot: PickSlot, compendium: Compendium, activeBooks?: readonly string[]): SpellData[] {
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
function fixedKnownSpellNamesOf(grant: AdditionalSpells): string[] {
  return Object.values(grant.known ?? {}).flatMap((list) =>
    Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [],
  );
}

/**
 * The label a named spell list is offered under: its spells that it gives outright, named (`Lorehold: Light, Sacred Flame`), or
 * the list's own name when it gives none outright.
 */
function spellListOptionLabel(grant: AdditionalSpells, compendium: Compendium, activeBooks?: readonly string[]): string {
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
function spellListChoiceId(owner: GrantOwner): string {
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

/** The choice id of the casting ability the player picks for an owner, once for all its grants. */
function abilityChoiceId(owner: GrantOwner): string {
  return `${ownerKey(owner)}__${ABILITY_CHOICE_KEY}`;
}

/** The choice id of one slot of a grant: its owner, its list (or `-`), and its index. */
function grantSlotChoiceId(owner: GrantOwner, grant: AdditionalSpells, slot: PickSlot): string {
  const list = typeof grant.name === "string" ? grant.name : UNNAMED_GRANT_KEY;
  return `${ownerKey(owner)}__${list}__${slot.index}`;
}

/** Whether a Rule Choice id is one of the granted spell picks this module issues (a feat's or a race's). */
export function isGrantSpellChoiceId(id: string): boolean {
  const mark = id.split("__")[1];
  return mark === OWNER_MARK.feat || mark === OWNER_MARK.race;
}

/**
 * The race or subrace whose spell grant the character has, read from the catalog. A subrace whose grants are read replaces the
 * race's, as its trait takes the place of the race's Innate Magic. Only the grants whose gate is open are read (see
 * grantGateOpen). Undefined when neither gives spells the character reads.
 */
export function raceGrantsOf(character: Character, races: RaceData[]): RaceGrants | undefined {
  // A lineage replacement stands in for the race, as the catalog resolves it.
  const lineage = character.lineageReplacement ? races.find((r) => r.name === character.lineageReplacement) : undefined;
  if (lineage) return openRaceGrants(character, raceOwner(lineage), lineage.additionalSpells);

  const choice = character.race;
  if (!choice) return undefined;
  const race = races.find((r) => r.name === choice.name && (!choice.source || r.source === choice.source));
  const subrace = race?.subraces?.find(
    (s) => s.name === choice.subraceName && (!choice.subraceSource || s.source === choice.subraceSource)
  );
  const subraceGrants = subrace ? openRaceGrants(character, raceOwner(subrace), subrace.additionalSpells) : undefined;
  if (subraceGrants) return subraceGrants;
  return race ? openRaceGrants(character, raceOwner(race), race.additionalSpells) : undefined;
}

/** The grants of a race or subrace whose gate is open, with the record that owns them. Undefined when none is open. */
function openRaceGrants(character: Character, owner: GrantOwner, grants: AdditionalSpells[] | undefined): RaceGrants | undefined {
  const open = (grants ?? []).filter((grant) => grantGateOpen(character, grant));
  return open.length > 0 ? { owner, grants: open } : undefined;
}

/**
 * Whether a grant's gate is open. A grant with no gate always is. A gated grant is read only while the player picked the
 * gate's option in the Rule Choice it names (ADR 0014): the gate is written into the Catalog by the scraper.
 */
export function grantGateOpen(character: Character, grant: AdditionalSpells): boolean {
  const gate = grant.gatedBy;
  if (!gate) return true;
  const picked = character.ruleChoices?.find((entry) => entry.id === gate.choiceId)?.picked ?? [];
  return picked.includes(gate.option);
}

/** Every owner of spell grants the character holds: its feats (with their records) and its race or subrace. */
function heldGrantsOf(character: Character, feats: FeatData[], races: RaceData[]): HeldGrants[] {
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
          description: fixed ? `Casting ability: ${fixed.toUpperCase()}` : `Casting ability: chosen for the ${owner.kind}`,
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
 * The name a released pick's notice gives it: the spell it was picked as, the spell list, or the casting ability.
 */
function releasedPickLabel(entry: RuleChoiceEntry, pick: string): string {
  if (entry.id.endsWith(`__${SPELL_LIST_KEY}`)) return pick;
  if (entry.id.endsWith(`__${ABILITY_CHOICE_KEY}`)) {
    return (ABILITIES as readonly string[]).includes(pick) ? `${ABILITY_NAMES[pick as AbilityKey]} casting ability` : pick;
  }
  return pick;
}

/**
 * The review notices for the picks an entry released: one per pick, each naming the pick and the feat or race it came from.
 * An entry with no pick recorded is named by its trait.
 */
function releaseNotices(entry: RuleChoiceEntry, reason: string, picks: readonly string[] = entry.picked): string[] {
  if (picks.length === 0) return [`${entry.trait} removed: ${reason}`];
  // A Rule Choice id is the source, the owner's kind mark, the owner's name, then the pick (see ownerKey and the id builders).
  const owner = entry.id.split("__")[2];
  return picks.map((pick) => `${releasedPickLabel(entry, pick)} removed from ${owner}: ${reason}`);
}

/**
 * Whether the catalog holds any record of the kind a Rule Choice id's owner belongs to (feat or race). A catalog with none of a
 * kind is not loaded: it cannot say that a record is gone, so the reconciler releases nothing of that kind.
 */
function catalogHoldsKindOf(id: string, listings: CompendiumListings): boolean {
  return id.split("__")[1] === OWNER_MARK.feat ? listings.feats().length > 0 : listings.races().length > 0;
}

/**
 * Releases the granted spell picks that no longer hold, with a review notice for each release. A pick is released when its
 * owner is no longer held, when its list is no longer the one picked, or (with the active books given) when the spell is no
 * longer offered. Picks of other choices are untouched. A pick whose owner's kind the catalog holds no record of is not loaded,
 * so it is kept without a notice. Returns the character itself when nothing changes.
 */
export function pruneInvalidFeatSpellPicks(character: Character, compendium: Compendium, activeBooks?: readonly string[]): Character {
  const entries = character.ruleChoices ?? [];
  if (!entries.some((entry) => isGrantSpellChoiceId(entry.id))) return character;

  const listings = compendium.for();
  const held = heldGrantsOf(character, listings.feats(), listings.races());
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
    if (!isGrantSpellChoiceId(entry.id) || !catalogHoldsKindOf(entry.id, listings)) {
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
      notices.push(...releaseNotices(entry, reason));
      continue;
    }
    const offered = valid.get(entry.id);
    const picked = offered ? entry.picked.filter((name) => offered.includes(name)) : entry.picked;
    const dropped = entry.picked.filter((name) => !picked.includes(name));
    if (dropped.length > 0) notices.push(...releaseNotices(entry, "no longer offered", dropped));
    if (picked.length > 0) kept.push(picked.length === entry.picked.length ? entry : { ...entry, picked });
  }

  if (notices.length === 0 && kept.length === entries.length && kept.every((entry, i) => entry === entries[i])) return character;
  return withNotices({ ...character, ruleChoices: kept }, notices);
}

/**
 * Releases the long-rest counters of a feat's spell that no longer holds, with a review notice for each. A counter is a feat's
 * when its id begins with the feat prefix. Its segments are the feat, then the spell list it was picked from (only when the
 * feat offers named lists), then the spell. A counter is released when its feat is no longer held, or when its list is not the
 * one the feat holds now. Other counters are untouched, and a catalog that holds no feat is not loaded, so none is released.
 * Returns the character itself when none is released.
 */
export function pruneReleasedFeatCounters(character: Character, compendium: Compendium): Character {
  const listings = compendium.for();
  const counters = character.resourceCounters ?? {};
  const featKeys = Object.keys(counters).filter((key) => key.startsWith(FEAT_COUNTER_PREFIX));
  if (featKeys.length === 0 || listings.feats().length === 0) return character;

  // Each feat the character holds, by its slug, with the slug of the spell list it holds (undefined when none is picked).
  const held = new Map<string, { name: string; list: string | undefined }>();
  for (const { feat } of heldFeatsOf(character, listings.feats())) {
    const picked = pickedSpellListOf(character, featOwner(feat), feat.additionalSpells ?? []);
    held.set(slugOf(feat.name), { name: feat.name, list: picked?.name ? slugOf(picked.name) : undefined });
  }

  const nextCounters = { ...counters };
  const notices: string[] = [];
  for (const key of featKeys) {
    const [featSlug, ...segments] = key.slice(FEAT_COUNTER_PREFIX.length).split(COUNTER_SEGMENT);
    const counterName = counters[key].name;
    const heldFeat = held.get(featSlug);
    if (!heldFeat) {
      const catalogName = listings.feats().find((feat) => slugOf(feat.name) === featSlug)?.name;
      notices.push(catalogName
        ? `${counterName} removed from ${catalogName}: feat no longer held`
        : `${counterName} removed: feat no longer held`);
      delete nextCounters[key];
      continue;
    }
    const listSlug = segments.length === 2 ? segments[0] : undefined;
    if (listSlug !== undefined && listSlug !== heldFeat.list) {
      notices.push(`${counterName} removed from ${heldFeat.name}: spell list changed`);
      delete nextCounters[key];
    }
  }
  if (notices.length === 0) return character;
  return withNotices({ ...character, resourceCounters: nextCounters }, notices);
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
 * A Rule Choice id a High Elf cantrip was saved under (ADR 0017). It is the documented example of the legacy ids the migration
 * reads: see isLegacyHighElfCantripId. No new pick is saved under it.
 */
export const LEGACY_HIGH_ELF_CANTRIP_CHOICE_ID = "PHB__Elf__PHB__High Elf__Cantrip";

/**
 * Whether a Rule Choice id is a legacy High Elf cantrip pick, saved from any source. The legacy reader matched any id that names
 * High Elf, so this does too; a granted spell's own pick id is never one.
 */
function isLegacyHighElfCantripId(id: string): boolean {
  return !isGrantSpellChoiceId(id) && id.includes("High Elf");
}

/**
 * Moves a saved High Elf or Half-Elf descent cantrip to the race's own pick (ADR 0017). The cantrip was saved under a legacy Rule
 * Choice id, or as a known spell under the legacy `racial__innate` owner key. Both are released. The cantrip moves to the race's
 * first cantrip slot that takes its spell from a class list, whatever the class, when the character's race still grants one.
 * Otherwise it is released with a review notice. A cantrip the offered spells no longer include is released by the reconciler,
 * on the next open of the character.
 */
export function migrateLegacyRacialCantrip(character: Character, races: RaceData[]): Character {
  const legacyEntries = (character.ruleChoices ?? []).filter((entry) => isLegacyHighElfCantripId(entry.id));
  const legacyKnown = (character.knownSpells ?? []).filter((spell) => spell.ownerKey === "racial__innate");
  if (legacyEntries.length === 0 && legacyKnown.length === 0) return character;

  const cleaned: Character = {
    ...character,
    ruleChoices: (character.ruleChoices ?? []).filter((entry) => !isLegacyHighElfCantripId(entry.id)),
    knownSpells: (character.knownSpells ?? []).filter((spell) => spell.ownerKey !== "racial__innate"),
  };
  const picked = legacyEntries.flatMap((entry) => entry.picked)[0] ?? legacyKnown[0]?.name;
  if (!picked) return cleaned;

  const race = raceGrantsOf(cleaned, races);
  const slot = race ? cantripSlotOf(race.grants) : undefined;
  if (!race || !slot) {
    return withNotices(cleaned, [`${picked} removed from ${character.race?.name ?? "ancestry"}: ancestry no longer grants it`]);
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

/** The first pick of the grants that takes one cantrip from a named class's list, with the grant it sits in. */
function cantripSlotOf(grants: AdditionalSpells[]): { grant: AdditionalSpells; slot: PickSlot } | undefined {
  for (const grant of grants) {
    for (const slot of pickSlotsOf(grant)) {
      if (!slot.filter) continue;
      const parsed = parseSpellFilter(slot.filter);
      if (parsed.level === 0 && parsed.classes.length > 0) return { grant, slot };
    }
  }
  return undefined;
}
