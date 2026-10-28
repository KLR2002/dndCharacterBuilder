import type { Character } from "../types/character.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { currentCompendium, type Compendium } from "../services/compendium.ts";
import { catalogListings } from "./catalogs.ts";
import type { AvailableRuleChoice, RuleChoiceOrigin } from "./choices/types.ts";
import type { ProficiencyCategory } from "../types/dnd5e.ts";
import type { FeatureInstance } from "./types.ts";
import { featuresOf, MULTICLASS_FEATURE, proficiencySheet } from "./proficiencySheet.ts";
import { weaponPickMarksMonkWeapon } from "./kenseiWeapons.ts";
import {
  clearProficiencyPick,
  isPickableCategory,
  pickCategories,
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
  if (grant.pool.kind === "anyOf") return "Tool or language";
  if (grant.pool.kind === "weapons" && grant.pool.attackType) {
    return grant.pool.attackType === "melee" ? "Melee weapon" : "Ranged weapon";
  }
  return DESCRIPTOR_OF_CATEGORY[grant.category];
}

/** Each descriptor in order, numbered when several share it ("Tool 1", "Tool 2"). A descriptor held once keeps its name. */
function numberedDescriptors(descriptors: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const descriptor of descriptors) counts.set(descriptor, (counts.get(descriptor) ?? 0) + 1);
  const seen = new Map<string, number>();
  return descriptors.map((descriptor) => {
    if ((counts.get(descriptor) ?? 0) < 2) return descriptor;
    const ordinal = (seen.get(descriptor) ?? 0) + 1;
    seen.set(descriptor, ordinal);
    return `${descriptor} ${ordinal}`;
  });
}

/**
 * The picker titles of one feature's Proficiency Choices, in grant order. A feature with a single choice
 * keeps its name. With several, each title adds what its grant picks ("Path of the Kensei: Melee weapon"),
 * and grants that still share a descriptor are numbered in grant order ("Tool 1", "Tool 2").
 */
export function pickerTitles(featureName: string, grants: readonly ChoiceProficiencyGrant[]): string[] {
  if (grants.length <= 1) return grants.map(() => featureName);
  return numberedDescriptors(grants.map(descriptorOf)).map((descriptor) => `${featureName}: ${descriptor}`);
}

/** The Proficiency Choice grants a feature offers a pick for: the pickable choices, in grant order. */
function pickableChoicesOf(feature: FeatureInstance): ChoiceProficiencyGrant[] {
  return (feature.grants ?? []).filter(
    (grant): grant is ChoiceProficiencyGrant => grant.kind === "choice" && isPickableCategory(grant.category),
  );
}

/**
 * Whether a name is held from a source other than this Proficiency Choice's own pick: the sheet is read with the
 * pick set aside. A weapon is held by its name or its category, as the sheet's weapon entries record it.
 */
export function heldByOtherSources(
  character: Character,
  grant: ChoiceProficiencyGrant,
  query: ProficiencyChoiceQuery = {},
): (name: string) => boolean {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks?.length ? query.activeBooks : undefined;
  const sheet = proficiencySheet(clearProficiencyPick(character, grant.id), { compendium, activeBooks });
  const held = new Set(pickCategories(grant).flatMap((category) => sheet[category]).map((entry) => entry.name.toLowerCase()));
  const heldWeapons = sheet.weapons.map((entry) => entry.name);
  return (name) => (grant.category === "weapons" ? weaponHeld(name, heldWeapons) : held.has(name.toLowerCase()));
}

/** One Proficiency Choice offer, with the feature and the grant it came from. */
interface ChoiceOfferEntry {
  offer: AvailableRuleChoice;
  feature: FeatureInstance;
  grant: ChoiceProficiencyGrant;
}

function choiceOfferEntries(character: Character, query: ProficiencyChoiceQuery): ChoiceOfferEntry[] {
  const compendium = query.compendium ?? currentCompendium();
  const activeBooks = query.activeBooks?.length ? query.activeBooks : undefined;
  const active = activeBooks ? new Set(activeBooks.map((book) => book.toUpperCase())) : undefined;
  const listings = catalogListings({ compendium, activeBooks });
  const items = listings.items();
  const features = featuresOf(character, listings, activeBooks);

  const offered = features.flatMap((feature) => {
    const origin = ORIGIN_OF[feature.origin];
    if (!origin) return [];
    const source = feature.source.toUpperCase();
    if (active && KNOWN_BOOKS.has(source) && !active.has(source)) return [];
    return [{ feature, origin, choices: pickableChoicesOf(feature) }];
  });

  // The Race tab shows a race's and its subrace's picks together, so each is titled by what it picks, numbered across both.
  const raceGrants = offered.filter(({ origin }) => origin === "race").flatMap(({ choices }) => choices);
  const raceTitles = numberedDescriptors(raceGrants.map(descriptorOf));
  const raceTitleOf = new Map(raceGrants.map((grant, index) => [grant, raceTitles[index]]));

  const entries: ChoiceOfferEntry[] = [];
  for (const { feature, origin, choices } of offered) {
    // A later class's multiclass pick is titled after its class, so the picker names whose skill it is.
    const titles =
      origin === "race"
        ? choices.map((grant) => raceTitleOf.get(grant) ?? descriptorOf(grant))
        : isMulticlassFeature(feature)
          ? choices.map((grant) => `${feature.className} multiclass: ${descriptorOf(grant)}`)
          : pickerTitles(feature.name, choices);
    for (const [index, grant] of choices.entries()) {
      const isHeld = heldByOtherSources(character, grant, { compendium, activeBooks });
      const own = new Set(validPicks(grant, character.proficiencyPicks?.[grant.id] ?? [], items).map((name) => name.toLowerCase()));
      // A weapon pick that also marks a Monk Weapon keeps the whole pool: a held weapon still gains that effect.
      const offersHeld = grant.category === "weapons" && weaponPickMarksMonkWeapon(feature);

      entries.push({
        grant,
        feature,
        offer: {
          id: grant.id,
          traitName: titles[index],
          choose: grant.count,
          level: feature.level ?? 0,
          effectLevel: feature.level ?? 0,
          source: feature.source,
          categories: pickCategories(grant),
          origin,
          pick: "proficiency",
          options: poolNames(grant, items)
            .filter((name) => offersHeld || own.has(name.toLowerCase()) || !isHeld(name))
            .map((name) => ({ name, description: "" })),
        },
      });
    }
  }
  return entries;
}

export function proficiencyChoiceOffers(character: Character, query: ProficiencyChoiceQuery = {}): AvailableRuleChoice[] {
  return choiceOfferEntries(character, query).map((entry) => entry.offer);
}

/**
 * Whether every pick in a card of Proficiency Choice offers is a language pick alone, so the card can be named
 * for languages. A tool, skill, or tool-or-language pick makes it a card of proficiencies.
 */
export function picksOnlyLanguages(offers: readonly AvailableRuleChoice[]): boolean {
  return offers.every((offer) => offer.categories?.every((category) => category === "languages") === true);
}

/** A skill Proficiency Choice the Builder's Skills card shows. `expertise` is set when its grant gives Expertise. */
export type SkillPickOffer = AvailableRuleChoice & { expertise: boolean };

/** The origins whose skill picks the Class tab's Skills card holds. A race or background pick is shown on its own tab. */
const SKILL_CARD_ORIGINS: ReadonlySet<RuleChoiceOrigin> = new Set<RuleChoiceOrigin>(["class", "subclass", "feat"]);

/**
 * The skill Proficiency Choices the Class tab's Skills card holds: a class's, subclass's or feat's skill pick, and a
 * later class's multiclass skill pick. Each is the offer `proficiencyChoiceOffers` gives it, titled for its source (the
 * feature's name, or "<Class> multiclass skill"), and marked when its grant gives Expertise.
 */
export function skillPickOffers(character: Character, query: ProficiencyChoiceQuery = {}): SkillPickOffer[] {
  return choiceOfferEntries(character, query)
    .filter(({ grant, offer }) => grant.category === "skills" && SKILL_CARD_ORIGINS.has(offer.origin))
    .map(({ offer, feature, grant }) => ({
      ...offer,
      traitName: skillPickTitle(feature, grant),
      expertise: grant.expertise === true,
    }));
}

function isMulticlassFeature(feature: FeatureInstance): boolean {
  return feature.origin === "Class" && feature.name === MULTICLASS_FEATURE;
}

/** The title of a skill pick: its source, numbered when its feature carries more than one skill pick. */
function skillPickTitle(feature: FeatureInstance, grant: ChoiceProficiencyGrant): string {
  if (isMulticlassFeature(feature)) return `${feature.className} multiclass skill`;
  const skillPicks = (feature.grants ?? []).filter(
    (other): other is ChoiceProficiencyGrant => other.kind === "choice" && other.category === "skills",
  );
  return skillPicks.length > 1 ? `${feature.name}: Skill ${skillPicks.indexOf(grant) + 1}` : feature.name;
}
