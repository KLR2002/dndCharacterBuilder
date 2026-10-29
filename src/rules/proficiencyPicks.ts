import { ALL_BOOKS, type ActiveBooks } from "../constants/books.ts";
import type { Character } from "../types/character.ts";
import type { BackgroundData, ClassData, GrantRequirement, ProficiencyGrant, RaceData } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";
import { grantRequirementMet } from "./optionFeatureGrants.ts";
import { findClassData } from "./catalogs.ts";
import {
  isSwapId,
  MULTICLASS_FEATURE,
  originalOfSwapId,
  multiclassSkillGrantOf,
  originSwapStateOf,
  swapLabelOf,
  type OriginSwapState,
} from "./proficiencySheet.ts";
import { poolNames, sourceRecordGrants, STARTING_PROFICIENCIES, validPicks, type ChoiceProficiencyGrant } from "./proficiencyPools.ts";
import { heldSubraceOf, raceSkillPickApplies, recordGrantSources, subracePickApplies } from "./recordProficiencyGrants.ts";
import { findHeldRace, findHeldRecord } from "./raceLookup.ts";
import { CUSTOM_BACKGROUND_GRANTS, isCustomBackground } from "./customBackground.ts";
import { normalizeSkillName } from "./skills.ts";
import { withNotices } from "./needsReview.ts";
import { getAvailableExpertiseMilestones, getMilestonePicks } from "./expertise.ts";

/**
 * Moves the class tool picks saved before the starting tool choice was a Proficiency Choice into that
 * choice's own pick, and clears the class bucket. Until this runs the sheet reads the bucket as picks of
 * the choice, so the sheet is the same before and after. Returns the character unchanged when there is
 * no bucket, no first class, or no starting tool choice in the Compendium.
 */
export function moveLegacyClassToolPicks(character: Character, compendium: Compendium): Character {
  const bucket = character.chosenTools?.class;
  const first = character.classes[0];
  if (bucket === undefined || !first) return character;
  const cls = findClassData(compendium.for().classes(), first);
  const choice = cls?.grants?.find(
    (grant): grant is ChoiceProficiencyGrant => grant.kind === "choice" && grant.category === "tools",
  );
  if (!choice) return character;

  const saved = character.proficiencyPicks?.[choice.id] ?? [];
  const moved = bucket.filter((name) => !saved.some((pick) => pick.toLowerCase() === name.toLowerCase()));
  const chosenTools = { ...character.chosenTools };
  delete chosenTools.class;
  const proficiencyPicks: Record<string, string[]> = { ...(character.proficiencyPicks ?? {}) };
  if (saved.length + moved.length > 0) proficiencyPicks[choice.id] = [...saved, ...moved];
  return {
    ...character,
    chosenTools,
    proficiencyPicks: Object.keys(proficiencyPicks).length > 0 ? proficiencyPicks : undefined,
  };
}

/** A bucket of the race or the background, the two places a saved tool or language was kept before picks. */
type SourceBucket = "race" | "background";

/** Which bucket a record-level grant source's saved picks were kept in. */
const BUCKET_OF = { Race: "race", Subrace: "race", Background: "background" } as const;

/**
 * Moves the race and background tool and language picks saved before they were Proficiency Choices into the
 * choice they belong to: each name goes to the first open choice of its category whose pool offers it, and
 * no choice takes more names than its count. A name no choice takes stays in its bucket, where the sheet keeps
 * reading it. Returns the character unchanged when nothing moves.
 */
export function moveLegacySourcePicks(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const listings = compendium.for();
  const sources = recordGrantSources(character, { races: listings.races(), backgrounds: listings.backgrounds(), activeBooks });
  const picks: Record<string, string[]> = { ...(character.proficiencyPicks ?? {}) };
  const buckets = {
    tools: { ...character.chosenTools } as Partial<Record<SourceBucket | "class", string[]>>,
    languages: { ...character.chosenLanguages } as Partial<Record<SourceBucket, string[]>>,
  };
  let moved = false;

  for (const category of ["tools", "languages"] as const) {
    const bucketsOfCategory = buckets[category];
    for (const bucket of ["race", "background"] as const) {
      const names = bucketsOfCategory[bucket] ?? [];
      let rest = names;
      for (const source of sources.filter((candidate) => BUCKET_OF[candidate.origin] === bucket)) {
        for (const grant of source.grants) {
          if (grant.kind !== "choice" || grant.category !== category || rest.length === 0) continue;
          const saved = picks[grant.id] ?? [];
          const offered = poolNames(grant);
          let open = grant.count - validPicks(grant, saved).length;
          const taken: string[] = [];
          rest = rest.filter((name) => {
            const match = offered.find((option) => option.toLowerCase() === name.trim().toLowerCase());
            if (!match) return true;
            if (saved.some((pick) => pick.toLowerCase() === match.toLowerCase())) {
              moved = true;
              return false;
            }
            if (open <= 0) return true;
            open -= 1;
            taken.push(match);
            moved = true;
            return false;
          });
          if (taken.length > 0) picks[grant.id] = [...saved, ...taken];
        }
      }
      if (rest.length !== names.length) {
        if (rest.length > 0) bucketsOfCategory[bucket] = rest;
        else delete bucketsOfCategory[bucket];
      }
    }
  }
  if (!moved) return character;

  const tidy = <T extends object>(bucketObject: T): T | undefined => (Object.keys(bucketObject).length > 0 ? bucketObject : undefined);
  return {
    ...character,
    chosenTools: tidy(buckets.tools) as Character["chosenTools"],
    chosenLanguages: tidy(buckets.languages) as Character["chosenLanguages"],
    proficiencyPicks: Object.keys(picks).length > 0 ? picks : undefined,
  };
}

/**
 * Moves saved Proficiency Choice picks from a grant's former, position-based id to the grant's id. A grant
 * carries each former id it had as `aliases`, so a character saved before ids were derived from the grant
 * loads with its picks under the new id. A pick already under the grant's id keeps its place, and a name
 * it already holds is not repeated. A saved id that no grant in the Compendium carries is kept as saved,
 * so an Integrated Catalog that still has position ids resolves its own picks. Returns the character
 * unchanged when no pick moves, so running it again changes nothing.
 */
export function moveAliasedProficiencyPicks(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const picks = character.proficiencyPicks;
  if (!picks || Object.keys(picks).length === 0) return character;

  const sources = grantSourcesIn(compendium, activeBooks);
  const idOfAlias = new Map<string, string>();
  for (const [id, owners] of sources) {
    for (const owner of owners) {
      for (const alias of owner.aliases) idOfAlias.set(alias, id);
    }
  }
  const next: Record<string, string[]> = {};
  const aliased: [string, string[]][] = [];
  for (const [key, names] of Object.entries(picks)) {
    if (!sources.has(key) && idOfAlias.has(key)) aliased.push([key, names]);
    else next[key] = names;
  }
  if (aliased.length === 0) return character;

  for (const [key, names] of aliased) {
    const target = idOfAlias.get(key) as string;
    const held = next[target] ?? [];
    const added = names.filter((name) => !held.some((pick) => pick.toLowerCase() === name.toLowerCase()));
    next[target] = [...held, ...added];
  }
  return { ...character, proficiencyPicks: Object.keys(next).length > 0 ? next : undefined };
}

/**
 * The reconciler's check on saved Proficiency Choice picks. It reads the Compendium and the
 * character directly rather than the granted-features pass, which reads the rule-choice module and so
 * cannot be imported from the reconciler. The check errs on the side of keeping a pick: it releases one
 * only when the Compendium names the grant and either the character clearly no longer holds its owner or
 * the grant belongs to an optional feature that is turned off.
 */

/** A class owner is the catalog class itself, so two classes of one name from different sources are told apart. */
type GrantOwner =
  | { kind: "class"; className: string; source: string }
  /** A later class's multiclass skill choice: held only while the class is an entry after the first. */
  | { kind: "multiclass"; className: string; source: string }
  | { kind: "subclass"; className: string; source: string; subclassName: string; subclassSource: string }
  | { kind: "feat"; featName: string }
  | { kind: "record"; origin: "Race" | "Subrace" | "Background"; name: string; source: string; raceName?: string; raceSource?: string }
  | { kind: "custom" };

/**
 * One place a Proficiency Grant is printed. A subclass printed under two classes of one name carries the same
 * grant id under each class, so an id can have several of these, one per owner.
 */
interface GrantSource {
  /** The grant's id, and the former ids it was saved under. */
  id: string;
  aliases: string[];
  /** The grant as the catalog prints it, with its Expertise mark when it has one. */
  grant: ProficiencyGrant;
  /** The feature the grant is printed on, named in the review notice. */
  feature: string;
  /** The level the feature is gained at. Feats are gained with no level, so 0. */
  level: number;
  /** Whether the feature is an optional class feature, held only while it is turned on. */
  optional: boolean;
  owner: GrantOwner;
  /** The pick on another feature's choice the grant depends on, when it has one. */
  requires?: GrantRequirement;
  /** Whether a grant of a held record applies to the character beyond its owner (a race's skill pick, a descent's). */
  applies?: (character: Character) => boolean;
}

/**
 * Every Proficiency Grant id in the Compendium, with each place that carries it, in catalog order. Unscoped by books; the
 * held subrace a race's skill pick is gated on resolves within `activeBooks` when given. An id keeps all its owners: a pick
 * is released only when none of them is held.
 */
function grantSourcesIn(compendium: Compendium, activeBooks: ActiveBooks): Map<string, GrantSource[]> {
  const listings = compendium.for();
  const sources = new Map<string, GrantSource[]>();
  const add = (
    grants: ProficiencyGrant[] | undefined,
    source: Omit<GrantSource, "id" | "aliases" | "applies" | "grant">,
    appliesTo?: (grant: ProficiencyGrant, character: Character) => boolean,
  ) => {
    for (const grant of grants ?? []) {
      const owners = sources.get(grant.id) ?? [];
      const applies = appliesTo && ((character: Character) => appliesTo(grant, character));
      owners.push({ ...source, id: grant.id, aliases: grant.aliases ?? [], grant, requires: grant.requires ?? source.requires, applies });
      sources.set(grant.id, owners);
    }
  };
  for (const cls of listings.classes()) {
    add(cls.grants, {
      feature: STARTING_PROFICIENCIES,
      level: 1,
      optional: false,
      owner: { kind: "class", className: cls.name, source: cls.source },
    });
    for (const feature of cls.features) {
      add(feature.grants, {
        feature: feature.name,
        level: feature.level,
        optional: feature.isOptional === true,
        owner: { kind: "class", className: cls.name, source: cls.source },
      });
    }
    const multiclassSkill = multiclassSkillGrantOf(cls);
    if (multiclassSkill) {
      add([multiclassSkill], {
        feature: MULTICLASS_FEATURE,
        level: 1,
        optional: false,
        owner: { kind: "multiclass", className: cls.name, source: cls.source },
      });
    }
    for (const sub of cls.subclasses) {
      const owner = { kind: "subclass" as const, className: cls.name, source: cls.source, subclassName: sub.name, subclassSource: sub.source };
      for (const feature of sub.features) {
        add(feature.grants, { feature: feature.name, level: feature.level, optional: feature.isOptional === true, owner });
        // A folded option's grants are its own, applying while the feature's pick names it.
        for (const option of feature.choices?.options ?? []) {
          add(option.grants, {
            feature: option.name,
            level: option.level ?? feature.level,
            optional: false,
            owner,
            requires: { feature: feature.name, level: feature.level },
          });
        }
      }
    }
  }
  for (const feat of listings.feats()) {
    add(feat.grants, { feature: feat.name, level: 0, optional: false, owner: { kind: "feat", featName: feat.name } });
  }
  for (const race of listings.races()) {
    const raceOwner = { kind: "record" as const, origin: "Race" as const, name: race.name, source: race.source };
    // A race's skill pick depends on the descent the character holds, so each grant is gated on it (see raceSkillPickApplies).
    add(sourceRecordGrants(race.grants), { feature: race.name, level: 0, optional: false, owner: raceOwner }, (grant, character) =>
      raceSkillPickApplies(race, heldSubraceOf(race, character, activeBooks), character, grant),
    );
    for (const sub of race.subraces ?? []) {
      add(
        sourceRecordGrants(sub.grants),
        {
          feature: sub.name,
          level: 0,
          optional: false,
          owner: { kind: "record", origin: "Subrace", name: sub.name, source: sub.source, raceName: race.name, raceSource: race.source },
        },
        (grant, character) => subracePickApplies(race, sub, character, grant),
      );
    }
  }
  for (const background of listings.backgrounds()) {
    add(sourceRecordGrants(background.grants), {
      feature: background.name,
      level: 0,
      optional: false,
      owner: { kind: "record", origin: "Background", name: background.name, source: background.source },
    });
  }
  add(CUSTOM_BACKGROUND_GRANTS, { feature: "Custom Background", level: 0, optional: false, owner: { kind: "custom" } });
  return sources;
}

/**
 * Whether the character still holds the owner of a grant at the grant's level. A class entry holds the
 * owner when it resolves to the owner's own catalog class (name and source). Errs toward held.
 */
function ownerHeld(source: GrantSource, character: Character, classes: readonly ClassData[], held: HeldRecordIds): boolean {
  const owner = source.owner;
  if (owner.kind === "custom") return isCustomBackground(character.background);
  if (owner.kind === "record") return recordHeld(owner, held);
  if (owner.kind === "feat") {
    const wanted = owner.featName.toLowerCase();
    return [...(character.asiSelections ?? []), ...(character.originFeats ?? [])].some(
      (selection) => selection.type === "feat" && selection.featName?.toLowerCase() === wanted,
    );
  }
  // A multiclass grant is held by a class entry after the first only, as the sheet reads it.
  const entries = owner.kind === "multiclass" ? character.classes.slice(1) : character.classes;
  return entries.some((c) => {
    if (c.level < source.level) return false;
    const held = findClassData(classes, c);
    if (!held || held.name !== owner.className || held.source !== owner.source) return false;
    if (owner.kind === "class" || owner.kind === "multiclass") return true;
    if ((c.subclassName ?? "").toLowerCase() !== owner.subclassName.toLowerCase()) return false;
    const gate = { className: c.className, subclassName: owner.subclassName, subclassSource: owner.subclassSource };
    return grantRequirementMet(character, gate, source.requires, source.feature);
  });
}

/** The identity of a catalog record: its name and the book it is from. */
interface RecordIdentity {
  name: string;
  source: string;
}

/**
 * The race, subrace and background a character holds, each as the record the shared lookup resolves it to. A held record is
 * compared with an owner by identity, so a record saved under one book is held on a catalog that has its name in another.
 */
interface HeldRecordIds {
  race?: RecordIdentity;
  subrace?: RecordIdentity;
  background?: RecordIdentity;
}

function heldRecordIdsOf(
  character: Character,
  races: readonly RaceData[],
  backgrounds: readonly BackgroundData[],
  activeBooks: readonly string[] | undefined,
): HeldRecordIds {
  const { race, subrace } = findHeldRace(races, character.race, activeBooks);
  const background = character.background && !isCustomBackground(character.background)
    ? findHeldRecord(backgrounds, character.background, activeBooks)
    : undefined;
  return {
    race: race && { name: race.name, source: race.source },
    subrace: subrace && { name: subrace.name, source: subrace.source },
    background: background && { name: background.name, source: background.source },
  };
}

function isHeldAs(held: RecordIdentity | undefined, record: RecordIdentity): boolean {
  return held !== undefined && held.name === record.name && held.source === record.source;
}

/** Whether the character still holds a race, subrace or background record that grants this pick. */
function recordHeld(owner: Extract<GrantOwner, { kind: "record" }>, held: HeldRecordIds): boolean {
  if (owner.origin === "Background") return isHeldAs(held.background, owner);
  if (owner.origin === "Race") return isHeldAs(held.race, owner);
  // A subrace is held under its race: the race must be the owner's race, and the subrace the owner's.
  return isHeldAs(held.race, { name: owner.raceName ?? "", source: owner.raceSource ?? "" }) && isHeldAs(held.subrace, owner);
}

/**
 * The reason one place's grant is released, or undefined when that place still applies. An optional feature
 * that is turned off grants nothing, as the granted-features pass reads it; otherwise the owner decides.
 */
function placeReleaseReason(source: GrantSource, character: Character, classes: readonly ClassData[], held: HeldRecordIds): string | undefined {
  if (source.optional && !character.optionalFeatureReplacements?.[source.feature]) return "feature is turned off";
  if (!ownerHeld(source, character, classes, held)) return "no longer granted";
  return source.applies && !source.applies(character) ? "no longer granted" : undefined;
}

/**
 * The reason a grant's pick is released, or undefined when the grant still applies. The grant applies while
 * any of its owners applies, so a shared id is released only when every owner has released it. The reason is
 * the first owner's.
 */
function releaseReason(owners: readonly GrantSource[], character: Character, classes: readonly ClassData[], held: HeldRecordIds): string | undefined {
  let reason: string | undefined;
  for (const owner of owners) {
    const ownerReason = placeReleaseReason(owner, character, classes, held);
    if (ownerReason === undefined) return undefined;
    reason ??= ownerReason;
  }
  return reason;
}

/**
 * The notice that releases a swap's pick, or undefined when the swap is kept. A swap is released when the held race
 * no longer grants its original, and its replacement is dropped when another source now grants it or it is no longer in the pool. Both checks run
 * only while the rule is in effect: with TCE off a saved swap is kept and ignored.
 */
function originSwapNotice(id: string, pick: string, state: OriginSwapState): string | undefined {
  const label = swapLabelOf(id);
  const slot = state.slots.find((candidate) => candidate.id === id);
  if (!slot) {
    return state.raceKnown ? `${label} swap to ${pick} removed: ancestry no longer grants ${originalOfSwapId(id)}` : undefined;
  }
  if (!state.available || slot.replacement !== undefined) return undefined;
  return `${label} swap to ${pick} removed: ${pick} is no longer available`;
}

/**
 * Releases saved Proficiency Choice picks whose grant no longer applies, each with a review notice.
 * A pick is kept when the Compendium does not hold its grant (a missing or stale catalog), so a saved
 * pick is never lost for want of data. Returns the character unchanged when nothing is released.
 */
export function pruneInvalidProficiencyPicks(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const picks = character.proficiencyPicks;
  if (!picks || Object.keys(picks).length === 0) return character;

  const sources = grantSourcesIn(compendium, activeBooks);
  const listings = compendium.for();
  const held = heldRecordIdsOf(character, listings.races(), listings.backgrounds(), activeBooks);
  const kept: Record<string, string[]> = {};
  const notices: string[] = [];
  let swapState: OriginSwapState | undefined;
  for (const [id, names] of Object.entries(picks)) {
    if (isSwapId(id)) {
      swapState ??= originSwapStateOf(character, { compendium, activeBooks });
      const notice = names.length > 0 ? originSwapNotice(id, names[0], swapState) : undefined;
      if (notice) notices.push(notice);
      else kept[id] = names;
      continue;
    }
    const owners = sources.get(id);
    const reason = owners && releaseReason(owners, character, listings.classes(), held);
    if (!owners || !reason) {
      kept[id] = names;
    } else if (names.length > 0) {
      notices.push(`${names.join(", ")} removed from ${owners[0].feature}: ${reason}`);
    }
  }
  if (Object.keys(kept).length === Object.keys(picks).length) return character;

  return withNotices({ ...character, proficiencyPicks: Object.keys(kept).length > 0 ? kept : undefined }, notices);
}

/**
 * Moves the race, subrace and background skill picks saved before they were Proficiency Choices into the
 * skill choice they belong to: each name goes to the first open skill choice of a race, subrace or background
 * held now whose pool offers it, up to that choice's count. A name no choice takes stays in its legacy entry, and
 * in the old skill bucket, where the sheet keeps reading it. A legacy entry is dropped once every name it held has
 * moved. Class skill choices are left alone. Returns the character unchanged when nothing moves or changes.
 */
export function moveLegacySkillPicks(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const legacy = (character.skillChoices ?? []).filter((entry) => entry.origin === "race" || entry.origin === "background");
  if (legacy.length === 0) return character;

  const listings = compendium.for();
  const offered = [
    ...recordGrantSources(character, { races: listings.races(), backgrounds: listings.backgrounds(), activeBooks }).flatMap((source) =>
      source.grants.map((grant) => ({ grant, origins: source.origin === "Background" ? ["Background"] : ["Race", "Subrace"] })),
    ),
    ...(isCustomBackground(character.background) ? CUSTOM_BACKGROUND_GRANTS.map((grant) => ({ grant, origins: ["Background"] })) : []),
  ].filter((entry): entry is { grant: ChoiceProficiencyGrant; origins: string[] } => entry.grant.kind === "choice" && entry.grant.category === "skills");

  const picks: Record<string, string[]> = { ...(character.proficiencyPicks ?? {}) };
  const moved = new Set<string>();
  const leftover = new Set<string>();
  for (const entry of legacy) {
    const wanted = entry.origin === "race" ? "Race" : "Background";
    for (const name of entry.picked) {
      const key = normalizeSkillName(name).toLowerCase();
      const target = offered.find(({ grant, origins }) => {
        if (!origins.includes(wanted) || !poolNames(grant).some((option) => option.toLowerCase() === key)) return false;
        const held = validPicks(grant, picks[grant.id] ?? []);
        return held.length < grant.count && !held.some((pick) => pick.toLowerCase() === key);
      });
      if (!target) {
        leftover.add(key);
        continue;
      }
      const canonical = poolNames(target.grant).find((option) => option.toLowerCase() === key) as string;
      picks[target.grant.id] = [...(picks[target.grant.id] ?? []), canonical];
      moved.add(key);
    }
  }

  const skillChoices = (character.skillChoices ?? []).flatMap((entry) => {
    if (!legacy.includes(entry)) return [entry];
    const rest = entry.picked.filter((name) => leftover.has(normalizeSkillName(name).toLowerCase()));
    return rest.length > 0 ? [{ ...entry, picked: rest }] : [];
  });
  if (moved.size === 0 && JSON.stringify(skillChoices) === JSON.stringify(character.skillChoices)) return character;

  const classPicked = new Set(
    skillChoices.filter((entry) => entry.origin === "class").flatMap((entry) => entry.picked.map((pick) => normalizeSkillName(pick).toLowerCase())),
  );
  const chosenSkills = (character.chosenSkills ?? []).filter((skill) => {
    const key = normalizeSkillName(skill).toLowerCase();
    return !moved.has(key) || classPicked.has(key) || leftover.has(key);
  });
  return {
    ...character,
    proficiencyPicks: Object.keys(picks).length > 0 ? picks : undefined,
    skillChoices,
    chosenSkills,
  };
}

/**
 * Moves Expertise picks saved in chosenExpertise into a held skill choice that now carries Expertise. A name the
 * choice offers goes into its free slots, in the order it was picked; a name already among its picks is dropped,
 * since the grant gives its Expertise. A name an Expertise milestone of the character holds stays in chosenExpertise,
 * so the milestone keeps its own slot. A name no free slot takes stays in chosenExpertise, and the Expertise pass
 * releases it with its review notice. Before this, a Knowledge Domain Cleric's Blessings Expertise was a separate
 * milestone. Returns the character unchanged when nothing moves.
 */
export function moveExpertisePicksToGrants(character: Character, compendium: Compendium, activeBooks: ActiveBooks): Character {
  const expertise = character.chosenExpertise ?? [];
  if (expertise.length === 0) return character;

  const listings = compendium.for();
  const held = heldRecordIdsOf(character, listings.races(), listings.backgrounds(), activeBooks);
  const classes = listings.classes();
  const offered: { id: string; grant: ChoiceProficiencyGrant }[] = [];
  for (const [id, owners] of grantSourcesIn(compendium, activeBooks)) {
    const grant = owners[0].grant;
    if (grant.kind !== "choice" || grant.category !== "skills" || grant.expertise !== true) continue;
    if (releaseReason(owners, character, classes, held) !== undefined) continue;
    offered.push({ id, grant });
  }
  if (offered.length === 0) return character;

  // Unscoped on purpose: the move must see the milestones of switched-off books, so the scoped prune that follows releases them with a notice.
  const milestoneHeld = new Set(
    getMilestonePicks(getAvailableExpertiseMilestones(character, { compendium, activeBooks: ALL_BOOKS }), expertise).flatMap((pick) =>
      pick.chosen.map((name) => name.trim().toLowerCase()),
    ),
  );
  const picks: Record<string, string[]> = { ...(character.proficiencyPicks ?? {}) };
  const kept: string[] = [];
  let moved = false;
  for (const name of expertise) {
    const key = name.trim().toLowerCase();
    if (milestoneHeld.has(key)) {
      kept.push(name);
      continue;
    }
    const target = offered.find(({ id, grant }) => {
      if (!poolNames(grant).some((option) => option.toLowerCase() === key)) return false;
      const held = validPicks(grant, picks[id] ?? []);
      return held.some((pick) => pick.toLowerCase() === key) || held.length < grant.count;
    });
    if (!target) {
      kept.push(name);
      continue;
    }
    const held = validPicks(target.grant, picks[target.id] ?? []);
    if (!held.some((pick) => pick.toLowerCase() === key)) {
      const option = poolNames(target.grant).find((candidate) => candidate.toLowerCase() === key) as string;
      picks[target.id] = [...(picks[target.id] ?? []), option];
    }
    moved = true;
  }
  if (!moved) return character;
  return { ...character, proficiencyPicks: picks, chosenExpertise: kept };
}

/**
 * Drops the empty multiclass skill entries that saves kept in `skillChoices` before a later class's skill choice
 * was a Proficiency Choice. Nothing could pick into them, so an empty one holds nothing. An entry that holds a
 * pick is kept as saved. Returns the character unchanged when there is no such entry.
 */
export function dropLegacyMulticlassSkillEntries(character: Character): Character {
  const entries = character.skillChoices ?? [];
  const kept = entries.filter((entry) => !(entry.id.startsWith("multiclass_skill_") && entry.picked.length === 0));
  if (kept.length === entries.length) return character;
  return { ...character, skillChoices: kept.length > 0 ? kept : undefined };
}
