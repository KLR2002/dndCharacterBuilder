import type { ToolsClient } from "../../../dnd5eToolsScrap/src/types/models.ts";
import { scrapeBeasts } from "../../../dnd5eToolsScrap/src/scrapers/beasts.ts";
import type { ScraperProgressCallback } from "./browserClient.ts";
import { hasIntegratedCatalog, replaceSavedBeasts } from "../compendiumStorage.ts";
import { integrate } from "../compendium.ts";
import { updateSettings } from "../storage.ts";

/**
 * Adds the bestiary's beasts to the saved Integrated Catalog without a re-sync. Only the beasts change: the
 * Catalog Format and "Last synced" date stay as saved. The Compendium reads the new beasts at once, and Skip
 * Beasts turns off, only after the catalog is saved. Throws, and changes nothing, when there is no saved
 * Integrated Catalog, when the client throws, or when the bestiary yields no beasts.
 */
export async function downloadBeasts(client: ToolsClient, onProgress?: ScraperProgressCallback): Promise<void> {
  if (!(await hasIntegratedCatalog())) {
    throw new Error("Beasts can be downloaded only into an Integrated Catalog");
  }
  onProgress?.("Beasts", 1, 1);
  const beasts = await scrapeBeasts(client);
  if (beasts.length === 0) {
    throw new Error("The bestiary returned no beasts, so nothing was changed");
  }
  const saved = await replaceSavedBeasts(beasts as any);
  integrate(saved);
  await updateSettings({ skipBeasts: false });
  await updateSettings({ skipBeasts: false });
}
