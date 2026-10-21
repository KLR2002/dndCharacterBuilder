import type { Character } from "../types/character.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { catalogListings } from "./catalogs.ts";
import type { AvailableRuleChoice, RuleChoiceOrigin } from "./choices/types.ts";
import type { ProficiencyCategory } from "../types/dnd5e.ts";
import type { FeatureInstance } from "./types.ts";
import { featuresOf, proficiencySheet } from "./proficiencySheet.ts";
import { weaponPickMarksMonkWeapon } from "./kenseiWeapons.ts";
import {
  clearProficiencyPick,
  isPickableCategory,
  poolNames,
  validPicks,
  weaponHeld,
  type ChoiceProficiencyGrant,
} from "./proficiencyPools.ts";

/**
 * The Proficiency Choices a character is offered: the tool and language choice grants on
 * the race, subrace, background, class, subclass and feat features the character holds. Each is offered as a Rule Choice with
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
  Race: "race",
  Subrace: "race",
  Background: "background",
  Class: "class",
  Subclass: "subclass",
  Feat: "feat",
};

const KNOWN_BOOKS = new Set(ALL_RESOURCE_BOOKS.map((book) => book.code.toUpperCase()));

const DESCRIPTOR_OF_CATEGORY: Record<ProficiencyCategory, string> = {
  skills: "Skill",
  tools: "Tool",
  languages: "Language",
  weapons: "Weapon",
  armor: "Armor",
  savingThrows: "Saving throw",
};

function descriptorOf(grant: ChoiceProficiencyGrant): string {
  if (grant.pool.kind === "weapons" && grant.pool.attackType) {
    return grant.pool.attackType === "melee" ? "Melee weapon" : "Ranged weapon";
  }
  return DESCRIPTOR_OF_CATEGORY[grant.category];
}

/**
 * The picker titles of one feature's Proficiency Choices, in grant order. A feature with a single choice
 * keeps its name. With several, each title adds what its grant picks ("Path of the Kensei: Melee weapon"),
 * and grants that still share a descriptor are numbered in grant order ("Tool 1", "Tool 2").
 */
export function pickerTitles(featureName: string, grants: readonly ChoiceProficiencyGrant[]): string[] {
  if (grants.length <= 1) return grants.map(() => featureName);
  const descriptors = grants.map(descriptorOf);
  const counts = new Map<string, number>();
  for (const descriptor of descriptors) counts.set(descriptor, (counts.get(descriptor) ?? 0) + 1);
  const seen = new Map<string, number>();
  return descriptors.map((descriptor) => {
    if ((counts.get(descriptor) ?? 0) < 2) return `${featureName}: ${descriptor}`;
    const ordinal = (seen.get(descriptor) ?? 0) + 1;
    seen.set(descriptor, ordinal);
    return `${featureName}: ${descriptor} ${ordinal}`;
  });
}

export function proficiencyChoiceOffers(character: Character, query: ProficiencyChoiceQuery = {}): AvailableRuleChoice[] {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks?.length ? query.activeBooks : undefined;
  const active = activeBooks ? new Set(activeBooks.map((book) => book.toUpperCase())) : undefined;
  const listings = catalogListings({ compendium, activeBooks });
  const items = listings.items();
  const features = featuresOf(character, listings);

  const offers: AvailableRuleChoice[] = [];
  for (const feature of features) {
    const origin = ORIGIN_OF[feature.origin];
    if (!origin) continue;
    const source = feature.source.toUpperCase();
    if (active && KNOWN_BOOKS.has(source) && !active.has(source)) continue;

    const choices = (feature.grants ?? []).filter(
      (grant): grant is ChoiceProficiencyGrant => grant.kind === "choice" && isPickableCategory(grant.category),
    );
    const titles = pickerTitles(feature.name, choices);
    for (const [index, grant] of choices.entries()) {
      // What the character holds from every other source, with this choice's own pick set aside.
      const sheet = proficiencySheet(clearProficiencyPick(character, grant.id), { compendium, activeBooks });
      const own = new Set(validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items).map((name) => name.toLowerCase()));
      const heldEntries = sheet[grant.category];
      const held = new Set(heldEntries.map((entry) => entry.name.toLowerCase()));
      // Weapons are held by name or by category, as the sheet's weapon entries record them.
      const heldWeapons = sheet.weapons.map((entry) => entry.name);
      const isHeld = (name: string) => (grant.category === "weapons" ? weaponHeld(name, heldWeapons) : held.has(name.toLowerCase()));
      // A weapon pick that also marks a Monk Weapon keeps the whole pool: a held weapon still gains that effect.
      const offersHeld = grant.category === "weapons" && weaponPickMarksMonkWeapon(feature);

      offers.push({
        id: grant.id,
        traitName: titles[index],
        choose: grant.count,
        level: feature.level ?? 0,
        effectLevel: feature.level ?? 0,
        source: feature.source,
        origin,
        pick: "proficiency",
        options: poolNames(grant, items)
          .filter((name) => offersHeld || own.has(name.toLowerCase()) || !isHeld(name))
          .map((name) => ({ name, description: "" })),
      });
    }
  }
  return offers;
}
