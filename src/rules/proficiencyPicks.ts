import type { Character } from "../types/character.ts";
import type { ClassData, GrantRequirement, ProficiencyGrant } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";
import { grantRequirementMet } from "./optionFeatureGrants.ts";
import { findClassData } from "./catalogs.ts";
import { poolNames, sourceRecordGrants, STARTING_PROFICIENCIES, validPicks, type ChoiceProficiencyGrant } from "./proficiencyPools.ts";
import { recordGrantSources } from "./recordProficiencyGrants.ts";

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
export function moveLegacySourcePicks(character: Character, compendium: Compendium): Character {
  const listings = compendium.for();
  const sources = recordGrantSources(character, { races: listings.races(), backgrounds: listings.backgrounds() });
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
export function moveAliasedProficiencyPicks(character: Character, compendium: Compendium): Character {
  const picks = character.proficiencyPicks;
  if (!picks || Object.keys(picks).length === 0) return character;

  const sources = grantSourcesIn(compendium);
  const idOfAlias = new Map<string, string>();
  for (const [id, owners] of sources) {
    for (const owner of owners) {
      for (const alias of owner.aliases) idOfAlias.set(alias, id);
    }
  }
  const next: Record<string, string[]> = {};
  const aliased: Array<[string, string[]]> = [];
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
  | { kind: "subclass"; className: string; source: string; subclassName: string; subclassSource: string }
  | { kind: "feat"; featName: string }
  | { kind: "record"; origin: "Race" | "Subrace" | "Background"; name: string; source: string; raceName?: string; raceSource?: string };

/**
 * One place a Proficiency Grant is printed. A subclass printed under two classes of one name carries the same
 * grant id under each class, so an id can have several of these, one per owner.
 */
interface GrantSource {
  /** The grant's id, and the former ids it was saved under. */
  id: string;
  aliases: string[];
  /** The feature the grant is printed on, named in the review notice. */
  feature: string;
  /** The level the feature is gained at. Feats are gained with no level, so 0. */
  level: number;
  /** Whether the feature is an optional class feature, held only while it is turned on. */
  optional: boolean;
  owner: GrantOwner;
  /** The pick on another feature's choice the grant depends on, when it has one. */
  requires?: GrantRequirement;
}

/**
 * Every Proficiency Grant id in the Compendium, with each place that carries it, in catalog order. Unscoped by books.
 * An id keeps all its owners: a pick is released only when none of them is held.
 */
function grantSourcesIn(compendium: Compendium): Map<string, GrantSource[]> {
  const listings = compendium.for();
  const sources = new Map<string, GrantSource[]>();
  const add = (grants: ProficiencyGrant[] | undefined, source: Omit<GrantSource, "id" | "aliases">) => {
    for (const grant of grants ?? []) {
      const owners = sources.get(grant.id) ?? [];
      owners.push({ ...source, id: grant.id, aliases: grant.aliases ?? [], requires: grant.requires ?? source.requires });
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
    add(sourceRecordGrants(race.grants), { feature: race.name, level: 0, optional: false, owner: raceOwner });
    for (const sub of race.subraces ?? []) {
      add(sourceRecordGrants(sub.grants), {
        feature: sub.name,
        level: 0,
        optional: false,
        owner: { kind: "record", origin: "Subrace", name: sub.name, source: sub.source, raceName: race.name, raceSource: race.source },
      });
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
  return sources;
}

/**
 * Whether the character still holds the owner of a grant at the grant's level. A class entry holds the
 * owner when it resolves to the owner's own catalog class (name and source). Errs toward held.
 */
function ownerHeld(source: GrantSource, character: Character, classes: readonly ClassData[]): boolean {
  const owner = source.owner;
  if (owner.kind === "record") return recordHeld(owner, character);
  if (owner.kind === "feat") {
    const wanted = owner.featName.toLowerCase();
    return [...(character.asiSelections ?? []), ...(character.originFeats ?? [])].some(
      (selection) => selection.type === "feat" && selection.featName?.toLowerCase() === wanted,
    );
  }
  return character.classes.some((c) => {
    if (c.level < source.level) return false;
    const held = findClassData(classes, c);
    if (!held || held.name !== owner.className || held.source !== owner.source) return false;
    if (owner.kind === "class") return true;
    if ((c.subclassName ?? "").toLowerCase() !== owner.subclassName.toLowerCase()) return false;
    const gate = { className: c.className, subclassName: owner.subclassName, subclassSource: owner.subclassSource };
    return grantRequirementMet(character, gate, source.requires, source.feature);
  });
}

/** Whether a name and an optional source match a held entry: the source is compared only when the character names one. */
function sameRecord(name: string, source: string | undefined, record: { name: string; source: string }): boolean {
  return record.name.toLowerCase() === name.toLowerCase() && (!source || record.source === source);
}

/** Whether the character still holds a race, subrace or background record that grants this pick. */
function recordHeld(owner: Extract<GrantOwner, { kind: "record" }>, character: Character): boolean {
  if (owner.origin === "Background") {
    return Boolean(character.background && !character.background.isCustom && sameRecord(character.background.name, character.background.source, owner));
  }
  const race = character.race;
  if (!race) return false;
  if (owner.origin === "Race") return sameRecord(race.name, race.source, owner);
  // A subrace is held under its race: the race must be the owner's race, and the subrace the owner's.
  const ownRace = { name: owner.raceName ?? "", source: owner.raceSource ?? "" };
  return sameRecord(race.name, race.source, ownRace) && Boolean(race.subraceName) && sameRecord(race.subraceName ?? "", race.subraceSource, owner);
}

/**
 * The reason one place's grant is released, or undefined when that place still applies. An optional feature
 * that is turned off grants nothing, as the granted-features pass reads it; otherwise the owner decides.
 */
function placeReleaseReason(source: GrantSource, character: Character, classes: readonly ClassData[]): string | undefined {
  if (source.optional && !character.optionalFeatureReplacements?.[source.feature]) return "feature is turned off";
  return ownerHeld(source, character, classes) ? undefined : "no longer granted";
}

/**
 * The reason a grant's pick is released, or undefined when the grant still applies. The grant applies while
 * any of its owners applies, so a shared id is released only when every owner has released it. The reason is
 * the first owner's.
 */
function releaseReason(owners: readonly GrantSource[], character: Character, classes: readonly ClassData[]): string | undefined {
  let reason: string | undefined;
  for (const owner of owners) {
    const ownerReason = placeReleaseReason(owner, character, classes);
    if (ownerReason === undefined) return undefined;
    reason ??= ownerReason;
  }
  return reason;
}

/**
 * Releases saved Proficiency Choice picks whose grant no longer applies, each with a review notice.
 * A pick is kept when the Compendium does not hold its grant (a missing or stale catalog), so a saved
 * pick is never lost for want of data. Returns the character unchanged when nothing is released.
 */
export function pruneInvalidProficiencyPicks(character: Character, compendium: Compendium): Character {
  const picks = character.proficiencyPicks;
  if (!picks || Object.keys(picks).length === 0) return character;

  const sources = grantSourcesIn(compendium);
  const classes = compendium.for().classes();
  const kept: Record<string, string[]> = {};
  const notices: string[] = [];
  for (const [id, names] of Object.entries(picks)) {
    const owners = sources.get(id);
    const reason = owners && releaseReason(owners, character, classes);
    if (!owners || !reason) {
      kept[id] = names;
    } else if (names.length > 0) {
      notices.push(`${names.join(", ")} removed from ${owners[0].feature}: ${reason}`);
    }
  }
  if (Object.keys(kept).length === Object.keys(picks).length) return character;

  return {
    ...character,
    proficiencyPicks: Object.keys(kept).length > 0 ? kept : undefined,
    needsReview: notices.length > 0 ? Array.from(new Set([...(character.needsReview ?? []), ...notices])) : character.needsReview,
  };
}
