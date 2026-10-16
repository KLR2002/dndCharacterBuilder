import type { OptionFeatureData } from "../src/types/dnd5e.ts";
import type { Compendium } from "../src/services/compendium.ts";
import { inMemoryCompendium } from "./testUtils.ts";

// An invented catalog of Artificer Infusion records, in the shape the scraper emits them. Names and
// text are placeholders. Levels come from the prerequisite strings the scraper writes: a plain
// infusion with no level in its prerequisite is a 2nd-level infusion.

const SOURCE = "TCE";

function infusion(name: string, prerequisite: string | null, isUmbrella = false): OptionFeatureData {
  return {
    name,
    source: SOURCE,
    category: "Artificer Infusion",
    featureType: ["AI"],
    prerequisite,
    description: `Placeholder text for ${name}.`,
    ...(isUmbrella ? { isUmbrella: true } : {}),
  };
}

export const INFUSION_FIXTURE_RECORDS: OptionFeatureData[] = [
  infusion("Replicate Magic Item", null, true),
  infusion("Placeholder Alpha", null),
  infusion("Placeholder Bravo", "A placeholder item (requires attunement)"),
  infusion("Placeholder Charlie", "6th-level Artificer; A placeholder item"),
  infusion("Placeholder Delta", "10th-level Artificer; A placeholder item"),
  infusion("Placeholder Echo", "14th-level Artificer; A placeholder item"),
  // Replicate rows as the scraper names them: "Replicate Magic Item: <item as printed>".
  infusion("Replicate Magic Item: placeholder jug", "2nd-level Artificer"),
  infusion("Replicate Magic Item: placeholder bag", "2nd-level Artificer"),
  infusion("Replicate Magic Item: placeholder boots", "6th-level Artificer"),
  infusion("Replicate Magic Item: placeholder ring", "10th-level Artificer"),
  infusion("Replicate Magic Item: placeholder amulet", "14th-level Artificer"),
];

/** A catalog that carries the infusions. */
export function infusionCatalog(): Compendium {
  return inMemoryCompendium({ optionsAndFeatures: INFUSION_FIXTURE_RECORDS }, { integrated: true });
}

/** A catalog synced before infusions were scraped: it has no AI records at all. */
export function staleInfusionCatalog(): Compendium {
  const unrelated: OptionFeatureData = {
    name: "Placeholder Option",
    source: SOURCE,
    category: "Fighting Style (Fighter)",
    featureType: ["FS:F"],
    prerequisite: null,
    description: "Placeholder text.",
  };
  return inMemoryCompendium({ optionsAndFeatures: [unrelated] }, { integrated: true });
}
