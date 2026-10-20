import type { Character } from "../types/character.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { catalogListings } from "./catalogs.ts";
import { grantedFeatures } from "./grantedFeatures.ts";
import type { AvailableRuleChoice, RuleChoiceOrigin } from "./choices/types.ts";
import type { FeatureInstance } from "./types.ts";
import { proficiencySheet } from "./proficiencySheet.ts";
import {
  clearProficiencyPick,
  isPickableCategory,
  poolNames,
  validPicks,
  weaponHeld,
} from "./proficiencyPools.ts";

/**
 * The Proficiency Choices a character is offered (ticket 05): the tool and language choice grants on
 * the class, subclass and feat features the character holds. Each is offered as a Rule Choice with
 * `pick: "proficiency"`, keyed by its grant id. The options are the pool less what the character holds
 * from any other source; the character's own picks always stay selectable.
 */

export interface ProficiencyChoiceQuery {
  /** Defaults to the process-wide current Compendium. */
  compendium?: Compendium;
  /** Scopes the offers to these books. Omitted or empty means every book. */
  activeBooks?: string[];
}

const ORIGIN_OF: Partial<Record<FeatureInstance["origin"], RuleChoiceOrigin>> = {
  Class: "class",
  Subclass: "subclass",
  Feat: "feat",
};

const KNOWN_BOOKS = new Set(ALL_RESOURCE_BOOKS.map((book) => book.code.toUpperCase()));

export function proficiencyChoiceOffers(character: Character, query: ProficiencyChoiceQuery = {}): AvailableRuleChoice[] {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks?.length ? query.activeBooks : undefined;
  const active = activeBooks ? new Set(activeBooks.map((book) => book.toUpperCase())) : undefined;
  const listings = catalogListings({ compendium, activeBooks });
  const items = listings.items();
  const features = grantedFeatures(character, {
    races: listings.races(),
    classes: listings.classes(),
    backgrounds: listings.backgrounds(),
    feats: listings.feats(),
  });

  const offers: AvailableRuleChoice[] = [];
  for (const feature of features) {
    const origin = ORIGIN_OF[feature.origin];
    if (!origin) continue;
    const source = feature.source.toUpperCase();
    if (active && KNOWN_BOOKS.has(source) && !active.has(source)) continue;

    for (const grant of feature.grants ?? []) {
      if (grant.kind !== "choice" || !isPickableCategory(grant.category)) continue;

      // What the character holds from every other source, with this choice's own pick set aside.
      const sheet = proficiencySheet(clearProficiencyPick(character, grant.id), { compendium, activeBooks });
      const own = new Set(validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items).map((name) => name.toLowerCase()));
      const heldEntries = sheet[grant.category];
      const held = new Set(heldEntries.map((entry) => entry.name.toLowerCase()));
      // Weapons are held by name or by category, as the sheet's weapon entries record them.
      const heldWeapons = sheet.weapons.map((entry) => entry.name);
      const isHeld = (name: string) => (grant.category === "weapons" ? weaponHeld(name, heldWeapons) : held.has(name.toLowerCase()));

      offers.push({
        id: grant.id,
        traitName: feature.name,
        choose: grant.count,
        level: feature.level ?? 0,
        effectLevel: feature.level ?? 0,
        source: feature.source,
        origin,
        pick: "proficiency",
        options: poolNames(grant, items)
          .filter((name) => own.has(name.toLowerCase()) || !isHeld(name))
          .map((name) => ({ name, description: "" })),
      });
    }
  }
  return offers;
}
