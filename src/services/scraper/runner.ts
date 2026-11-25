import { BrowserToolsClient, type ScraperProgressCallback } from "./browserClient.ts";
import { scrapeRaces } from "../../../dnd5eToolsScrap/src/scrapers/races.ts";
import { scrapeClasses } from "../../../dnd5eToolsScrap/src/scrapers/classes.ts";
import { scrapeFeats } from "../../../dnd5eToolsScrap/src/scrapers/feats.ts";
import { scrapeOptions } from "../../../dnd5eToolsScrap/src/scrapers/options.ts";
import { scrapeBackgrounds } from "../../../dnd5eToolsScrap/src/scrapers/backgrounds.ts";
import { scrapeItems } from "../../../dnd5eToolsScrap/src/scrapers/items.ts";
import { scrapeSpells } from "../../../dnd5eToolsScrap/src/scrapers/spells.ts";
import { scrapeBeasts } from "../../../dnd5eToolsScrap/src/scrapers/beasts.ts";
import { scrapeBooks } from "../../../dnd5eToolsScrap/src/scrapers/books.ts";
import { scrapeConditions } from "../../../dnd5eToolsScrap/src/scrapers/conditions.ts";
import { scrapeOriginRules } from "../../../dnd5eToolsScrap/src/scrapers/origin-rules.ts";
import { REQUIRED_CATALOG_FORMAT, saveCompendiumData, type CompendiumCollections } from "../compendiumStorage.ts";
import { integrate } from "../compendium.ts";
import { loadSettings } from "../storage.ts";

/** The number of progress steps a sync reports: 11 with the bestiary, 10 without it. */
export function integrationStepTotal(includeBeasts: boolean): number {
  return includeBeasts ? 11 : 10;
}

/** Whether a sync that starts now fetches the bestiary. Reads the saved Skip Beasts setting. */
export async function readIncludeBeasts(): Promise<boolean> {
  return (await loadSettings()).skipBeasts !== true;
}

/**
 * Scrapes every category through the client and returns the collections. Nothing is integrated or saved here:
 * the in-app sync does both after this, and the live catalog build (`scripts/build-live-catalog.mjs`) stops here.
 * Without beasts the bestiary is never requested and `beasts` is empty.
 */
export async function collectIntegratedCatalog(
  client: BrowserToolsClient,
  onProgress?: ScraperProgressCallback,
  includeBeasts = true,
): Promise<CompendiumCollections> {
  const total = integrationStepTotal(includeBeasts);
  let step = 0;
  const report = (category: string) => onProgress?.(category, ++step, total);

  report("Races");
  const races = await scrapeRaces(client as any);

  report("Classes");
  const classes = await scrapeClasses(client as any);

  report("Feats");
  const feats = await scrapeFeats(client as any);

  report("Options & Features");
  const optionsAndFeatures = await scrapeOptions(client as any);

  report("Backgrounds");
  const backgrounds = await scrapeBackgrounds(client as any);

  report("Items");
  const items = await scrapeItems(client as any);

  report("Spells");
  const spells = await scrapeSpells(client as any);

  let beasts: unknown[] = [];
  if (includeBeasts) {
    report("Beasts");
    beasts = await scrapeBeasts(client as any);
  }

  report("Conditions");
  const conditions = await scrapeConditions(client as any);

  report("Books");
  const books = await scrapeBooks(client as any);

  report("Origin Rules");
  const originRules = await scrapeOriginRules(client as any);

  const compendium: CompendiumCollections = {
    hasIntegratedCatalog: true,
    catalogFormat: REQUIRED_CATALOG_FORMAT,
    integratedAt: new Date().toISOString(),
    races: races as any,
    classes: classes as any,
    feats: feats as any,
    optionsAndFeatures: optionsAndFeatures as any,
    backgrounds: backgrounds as any,
    items: items as any,
    spells: spells as any,
    beasts: beasts as any,
    conditions: conditions as any,
    books: books as any,
    originRules,
  };
  return compendium;
}

export async function runInAppIntegration(
  onProgress?: ScraperProgressCallback,
  options: { includeBeasts?: boolean } = {},
): Promise<CompendiumCollections> {
  const compendium = await collectIntegratedCatalog(new BrowserToolsClient(), onProgress, options.includeBeasts ?? true);
  integrate(compendium);
  await saveCompendiumData(compendium);
  return compendium;
}

/** The sync a user starts: the saved Skip Beasts setting is read here, when the sync starts, and passed in. */
export async function runSavedIntegration(onProgress?: ScraperProgressCallback): Promise<CompendiumCollections> {
  const includeBeasts = await readIncludeBeasts();
  return runInAppIntegration(onProgress, { includeBeasts });
}
