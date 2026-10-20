import type { GrantSubject } from "../parser/proficiency-grants.ts";
import type { ProficiencyGrant } from "../types/proficiency.ts";

/** The one field the grant tooling writes on a tracked feature or feat. */
export interface GrantHolder {
  grants?: ProficiencyGrant[];
}

/** One tracked feature or feat, with the grant subject the scraper builds for it. */
export interface GrantRef {
  subject: GrantSubject;
  holder: GrantHolder;
}

export interface TrackedFeature extends GrantHolder {
  name: string;
  level: number;
  description: string;
}

export interface TrackedClass {
  name: string;
  source: string;
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
  for (const cls of classes) {
    for (const feature of cls.features) {
      refs.push(ref({ source: cls.source, owner: cls.name, feature }));
    }
    for (const sub of cls.subclasses) {
      for (const feature of sub.features) {
        refs.push(ref({ source: sub.source, owner: `${cls.name}/${sub.name}`, feature }));
      }
    }
  }
  return refs;
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
