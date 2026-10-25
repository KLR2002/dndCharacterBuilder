import type { GrantSubject } from "../parser/proficiency-grants.ts";
import type { InitiativeBonus, ProficiencyGrant } from "../types/proficiency.ts";

/** The fields the enrichment tooling writes on a tracked feature or feat: its Proficiency Grants and Initiative Bonus. */
export interface GrantHolder {
  grants?: ProficiencyGrant[];
  initiativeBonus?: InitiativeBonus;
}

/** One tracked feature or feat, with the grant subject the scraper builds for it. */
export interface GrantRef {
  subject: GrantSubject;
  holder: GrantHolder;
}

/** A folded option of a feature's choice. Its grants are its own, applied while the parent's pick names it. */
export interface TrackedChoiceOption extends GrantHolder {
  name: string;
  description: string;
  source?: string;
  level?: number;
}

export interface TrackedFeature extends GrantHolder {
  name: string;
  level: number;
  description: string;
  choices?: { pick: number; options?: TrackedChoiceOption[] };
}

export interface TrackedClass extends GrantHolder {
  name: string;
  source: string;
  /** The starting tool texts the class record carries; its "Starting Proficiencies" grants are read from them. */
  toolProficiencies?: string[];
  features: TrackedFeature[];
  subclasses: Array<{ name: string; source: string; features: TrackedFeature[] }>;
}

export interface TrackedFeat extends GrantHolder {
  name: string;
  source: string;
  description: string;
}

export interface TrackedData {
  classes: TrackedClass[];
  feats: TrackedFeat[];
}

/**
 * Class features, then the subclass features of each class, in the order the
 * class scraper resolves them (src/scrapers/classes.ts). A class feature's
 * owner is the class; a subclass feature's owner is `Class/Subclass`.
 */
export function classFeatureRefs(classes: TrackedClass[]): GrantRef[] {
  const refs: GrantRef[] = [];
  forEachClassFeature(classes, (owner, feature) => {
    refs.push(ref({ ...owner, feature }));
    refs.push(...optionRefs(owner, feature));
  });
  return refs;
}

/** The class and subclass features, without their folded options, in the order of classFeatureRefs. */
export function classFeatureOnlyRefs(classes: TrackedClass[]): GrantRef[] {
  const refs: GrantRef[] = [];
  forEachClassFeature(classes, (owner, feature) => refs.push(ref({ ...owner, feature })));
  return refs;
}

function forEachClassFeature(
  classes: TrackedClass[],
  visit: (owner: { source: string; owner: string }, feature: TrackedFeature) => void
): void {
  for (const cls of classes) {
    for (const feature of cls.features) visit({ source: cls.source, owner: cls.name }, feature);
    for (const sub of cls.subclasses) {
      for (const feature of sub.features) visit({ source: sub.source, owner: `${cls.name}/${sub.name}` }, feature);
    }
  }
}

/** The grant refs of a feature's folded options, in option order. Each option is its own grant subject. */
function optionRefs(owner: { source: string; owner: string }, feature: TrackedFeature): GrantRef[] {
  return (feature.choices?.options ?? []).map((option) => ({
    subject: {
      source: owner.source,
      owner: owner.owner,
      feature: option.name,
      level: option.level ?? feature.level,
      description: option.description,
    },
    holder: option,
  }));
}

/** Feats are their own grant owner: owner "Feat", level 0 (src/scrapers/feats.ts). */
export function featRefs(feats: TrackedFeat[]): GrantRef[] {
  return feats.map((feat) => ({
    subject: { source: feat.source, owner: "Feat", feature: feat.name, level: 0, description: feat.description },
    holder: feat,
  }));
}

export function allRefs(data: TrackedData): GrantRef[] {
  return [...classFeatureRefs(data.classes), ...featRefs(data.feats)];
}

function ref(input: {
  source: string;
  owner: string;
  feature: TrackedFeature;
}): GrantRef {
  return {
    subject: {
      source: input.source,
      owner: input.owner,
      feature: input.feature.name,
      level: input.feature.level,
      description: input.feature.description,
    },
    holder: input.feature,
  };
}
