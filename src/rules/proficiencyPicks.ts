import type { Character } from "../types/character.ts";
import type { ClassData, ProficiencyGrant } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";
import { optionGrantApplies } from "./optionFeatureGrants.ts";
import { findClassData } from "./catalogs.ts";
import { STARTING_PROFICIENCIES, type ChoiceProficiencyGrant } from "./proficiencyPools.ts";

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
  | { kind: "subclass"; className: string; source: string; subclassName: string }
  | { kind: "feat"; featName: string };

interface GrantSource {
  /** The feature the grant is printed on, named in the review notice. */
  feature: string;
  /** The level the feature is gained at. Feats are gained with no level, so 0. */
  level: number;
  /** Whether the feature is an optional class feature, held only while it is turned on. */
  optional: boolean;
  owner: GrantOwner;
}

/** Every Proficiency Grant id in the Compendium, with the feature that carries it. Unscoped by books. */
function grantSourcesIn(compendium: Compendium): Map<string, GrantSource> {
  const listings = compendium.for();
  const sources = new Map<string, GrantSource>();
  const add = (grants: ProficiencyGrant[] | undefined, source: GrantSource) => {
    for (const grant of grants ?? []) sources.set(grant.id, source);
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
      for (const feature of sub.features) {
        add(feature.grants, {
          feature: feature.name,
          level: feature.level,
          optional: feature.isOptional === true,
          owner: { kind: "subclass", className: cls.name, source: cls.source, subclassName: sub.name },
        });
      }
    }
  }
  for (const feat of listings.feats()) {
    add(feat.grants, { feature: feat.name, level: 0, optional: false, owner: { kind: "feat", featName: feat.name } });
  }
  return sources;
}

/**
 * Whether the character still holds the owner of a grant at the grant's level. A class entry holds the
 * owner when it resolves to the owner's own catalog class (name and source). Errs toward held.
 */
function ownerHeld(source: GrantSource, character: Character, classes: readonly ClassData[]): boolean {
  const owner = source.owner;
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
    return optionGrantApplies(character, { className: c.className, subclassName: c.subclassName }, { name: source.feature, level: source.level });
  });
}

/**
 * The reason a grant's pick is released, or undefined when the grant still applies. An optional feature
 * that is turned off grants nothing, as the granted-features pass reads it; otherwise the owner decides.
 */
function releaseReason(source: GrantSource, character: Character, classes: readonly ClassData[]): string | undefined {
  if (source.optional && !character.optionalFeatureReplacements?.[source.feature]) return "feature is turned off";
  return ownerHeld(source, character, classes) ? undefined : "no longer granted";
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
    const source = sources.get(id);
    const reason = source && releaseReason(source, character, classes);
    if (!source || !reason) {
      kept[id] = names;
    } else if (names.length > 0) {
      notices.push(`${names.join(", ")} removed from ${source.feature}: ${reason}`);
    }
  }
  if (Object.keys(kept).length === Object.keys(picks).length) return character;

  return {
    ...character,
    proficiencyPicks: Object.keys(kept).length > 0 ? kept : undefined,
    needsReview: notices.length > 0 ? Array.from(new Set([...(character.needsReview ?? []), ...notices])) : character.needsReview,
  };
}
