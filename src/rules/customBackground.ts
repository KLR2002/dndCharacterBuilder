import type { Character } from "../types/character.ts";
import type { BackgroundData, ProficiencyGrant } from "../types/dnd5e.ts";
import type { FeatureInstance } from "./types.ts";
import type { ChoiceProficiencyGrant } from "./proficiencyPools.ts";

/**
 * A custom background: one the player names and builds, with no record in the Catalog. Its free picks are
 * the two skills of your choice, and two tools or languages in any combination. The SRD Baseline carries no
 * record to read them from, so they are declared here as Proficiency Choices, with ids by the Grant Id rule.
 * A leaf module: the granted-features pass, the sheet and the reconciler all read it.
 */

/** The id of a custom background's skill choice, under which its two skill picks are saved. */
export const CUSTOM_BACKGROUND_SKILLS_ID = "Custom/Background/Custom Background@0#skills:choice:any";

/** The id of a custom background's tool-or-language choice, under which its two picks are saved. */
export const CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID = "Custom/Background/Custom Background@0#languages:choice:any";

/** The tool-or-language choice: two picks from tools and languages together. */
export const CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT: ChoiceProficiencyGrant = {
  id: CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID,
  kind: "choice",
  category: "languages",
  count: 2,
  pool: { kind: "anyOf", categories: ["tools", "languages"] },
};

export const CUSTOM_BACKGROUND_GRANTS: ProficiencyGrant[] = [
  {
    id: CUSTOM_BACKGROUND_SKILLS_ID,
    kind: "choice",
    category: "skills",
    count: 2,
    pool: { kind: "any" },
  },
  CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_GRANT,
];

/** Whether the character's background is a custom one, built in the Builder or flagged as custom. */
export function isCustomBackground(background: Character["background"] | undefined): boolean {
  return Boolean(background && (background.isCustom || background.source === "Custom"));
}

/**
 * Whether the background carries the custom flag an earlier version wrote, whatever its source. Only the Features
 * tab's legacy branch asks this: it keeps a flagged background's placeholder feature, which a background with
 * source "Custom" and no borrowed feature does not get. Everything else asks isCustomBackground.
 */
export function hasCustomFlag(background: Character["background"] | undefined): boolean {
  return Boolean(background?.isCustom);
}

/** The feature a custom background's Proficiency Choices sit on. Undefined for any other background. */
export function customBackgroundFeature(character: Character): FeatureInstance | undefined {
  if (!isCustomBackground(character.background)) return undefined;
  return {
    id: JSON.stringify(["Background", "Custom", "Custom Background", 0]),
    name: "Custom Background",
    source: "Custom",
    description: "",
    origin: "Background",
    level: 0,
    grants: CUSTOM_BACKGROUND_GRANTS,
  };
}

/** The name of the catalog's own "Custom Background" entry: a placeholder the custom background form replaces. */
const CATALOG_CUSTOM_BACKGROUND_NAME = "Custom Background";

/** The backgrounds the Builder offers: the catalog's own "Custom Background" entry, and its placeholder feature, are left out. */
export function withoutCatalogCustomBackground<T extends { name: string }>(backgrounds: T[]): T[] {
  return backgrounds.filter((background) => background.name !== CATALOG_CUSTOM_BACKGROUND_NAME);
}

/** A background feature a custom background can borrow. */
export interface BorrowableFeature {
  /** Unique within a list: the source, background name and feature name. */
  key: string;
  /** The row label: the feature name, then the background it comes from. */
  label: string;
  name: string;
  description: string;
  background: string;
}

/**
 * The features a custom background can borrow from the given backgrounds, one per background feature, sorted by
 * label. The catalog's own "Custom Background" entry is left out, with its placeholder feature.
 */
export function borrowableFeatures(backgrounds: BackgroundData[]): BorrowableFeature[] {
  return withoutCatalogCustomBackground(backgrounds)
    .flatMap((background) =>
      background.feature
        ? [
            {
              key: JSON.stringify([background.source, background.name, background.feature.name]),
              label: `${background.feature.name} (${background.name})`,
              name: background.feature.name,
              description: background.feature.description,
              background: background.name,
            },
          ]
        : [],
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}
