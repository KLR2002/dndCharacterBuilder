import type { Character } from "../types/character.ts";
import type { ProficiencyGrant } from "../types/dnd5e.ts";
import type { Compendium } from "../services/compendium.ts";

/**
 * The reconciler's check on saved Proficiency Choice picks (ticket 05). It reads the Compendium and the
 * character directly rather than the granted-features pass, which reads the rule-choice module and so
 * cannot be imported from the reconciler. The check errs on the side of keeping a pick: it releases one
 * only when the Compendium names the grant and the character clearly no longer holds its owner.
 */

type GrantOwner =
  | { kind: "class"; className: string }
  | { kind: "subclass"; className: string; subclassName: string }
  | { kind: "feat"; featName: string };

interface GrantSource {
  /** The feature the grant is printed on, named in the review notice. */
  feature: string;
  /** The level the feature is gained at. Feats are gained with no level, so 0. */
  level: number;
  owner: GrantOwner;
}

/** Every Proficiency Grant id in the Compendium, with the feature that carries it. Unscoped by books. */
export function grantSourcesIn(compendium: Compendium): Map<string, GrantSource> {
  const listings = compendium.for();
  const sources = new Map<string, GrantSource>();
  const add = (grants: ProficiencyGrant[] | undefined, source: GrantSource) => {
    for (const grant of grants ?? []) sources.set(grant.id, source);
  };
  for (const cls of listings.classes()) {
    for (const feature of cls.features) {
      add(feature.grants, { feature: feature.name, level: feature.level, owner: { kind: "class", className: cls.name } });
    }
    for (const sub of cls.subclasses) {
      for (const feature of sub.features) {
        add(feature.grants, {
          feature: feature.name,
          level: feature.level,
          owner: { kind: "subclass", className: cls.name, subclassName: sub.name },
        });
      }
    }
  }
  for (const feat of listings.feats()) {
    add(feat.grants, { feature: feat.name, level: 0, owner: { kind: "feat", featName: feat.name } });
  }
  return sources;
}

/** Whether the character still holds the owner of a grant at the grant's level. Errs toward held. */
function ownerHeld(source: GrantSource, character: Character): boolean {
  const owner = source.owner;
  if (owner.kind === "feat") {
    const wanted = owner.featName.toLowerCase();
    return [...(character.asiSelections ?? []), ...(character.originFeats ?? [])].some(
      (selection) => selection.type === "feat" && selection.featName?.toLowerCase() === wanted,
    );
  }
  return character.classes.some((c) => {
    if (c.className.toLowerCase() !== owner.className.toLowerCase()) return false;
    if (c.level < source.level) return false;
    return owner.kind === "class" || (c.subclassName ?? "").toLowerCase() === owner.subclassName.toLowerCase();
  });
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
  const kept: Record<string, string[]> = {};
  const notices: string[] = [];
  for (const [id, names] of Object.entries(picks)) {
    const source = sources.get(id);
    if (!source || ownerHeld(source, character)) {
      kept[id] = names;
    } else if (names.length > 0) {
      notices.push(`${names.join(", ")} removed from ${source.feature}: no longer granted`);
    }
  }
  if (Object.keys(kept).length === Object.keys(picks).length) return character;

  return {
    ...character,
    proficiencyPicks: Object.keys(kept).length > 0 ? kept : undefined,
    needsReview: notices.length > 0 ? Array.from(new Set([...(character.needsReview ?? []), ...notices])) : character.needsReview,
  };
}
