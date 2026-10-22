import type { Character } from "../types/character.ts";
import type { ProficiencyGrant } from "../types/dnd5e.ts";
import type { FeatureInstance } from "./types.ts";

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

export const CUSTOM_BACKGROUND_GRANTS: ProficiencyGrant[] = [
  {
    id: CUSTOM_BACKGROUND_SKILLS_ID,
    kind: "choice",
    category: "skills",
    count: 2,
    pool: { kind: "any" },
  },
  {
    id: CUSTOM_BACKGROUND_TOOLS_OR_LANGUAGES_ID,
    kind: "choice",
    category: "languages",
    count: 2,
    pool: { kind: "anyOf", categories: ["tools", "languages"] },
  },
];

/** Whether the character's background is a custom one, built in the Builder or flagged as custom. */
export function isCustomBackground(background: Character["background"] | undefined): boolean {
  return Boolean(background && (background.isCustom || background.source === "Custom"));
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
