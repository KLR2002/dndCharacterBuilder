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
import { saveCompendiumData, type CompendiumCollections } from "../compendiumStorage.ts";
import { integrate } from "../compendium.ts";

export async function runInAppIntegration(onProgress?: ScraperProgressCallback): Promise<CompendiumCollections> {
  const client = new BrowserToolsClient();
  const total = 10;

  onProgress?.("Races", 1, total);
  const races = await scrapeRaces(client as any);

  onProgress?.("Classes", 2, total);
  const classes = await scrapeClasses(client as any);

  onProgress?.("Feats", 3, total);
  const feats = await scrapeFeats(client as any);

  onProgress?.("Options & Features", 4, total);
  const optionsAndFeatures = await scrapeOptions(client as any);

  onProgress?.("Backgrounds", 5, total);
  const backgrounds = await scrapeBackgrounds(client as any);

  onProgress?.("Items", 6, total);
  const items = await scrapeItems(client as any);

  onProgress?.("Spells", 7, total);
  const spells = await scrapeSpells(client as any);

  onProgress?.("Beasts", 8, total);
  const beasts = await scrapeBeasts(client as any);

  onProgress?.("Conditions", 9, total);
  const conditions = await scrapeConditions(client as any);

  onProgress?.("Books", 10, total);
  const books = await scrapeBooks(client as any);

  const compendium: CompendiumCollections = {
    hasIntegratedCatalog: true,
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
  };

  integrate(compendium);
  await saveCompendiumData(compendium);
  return compendium;
}
