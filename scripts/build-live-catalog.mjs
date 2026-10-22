// Builds the Integrated Catalog the way the in-app sync does (same scrapers, same raw GitHub mirror client)
// and writes it as JSON to .cache/live-catalog/catalog.json, a gitignored folder. Run with: npm run catalog:live
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserToolsClient, RAW_MIRROR_BASE_URL } from "../src/services/scraper/browserClient.ts";
import { collectIntegratedCatalog } from "../src/services/scraper/runner.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".cache", "live-catalog");
const outFile = join(outDir, "catalog.json");

function describeFailure(error) {
  const cause = error?.cause?.code ?? error?.cause?.message ?? error?.message ?? String(error);
  return `${cause}`;
}

let catalog;
try {
  catalog = await collectIntegratedCatalog(new BrowserToolsClient(), (category, step, total) => {
    console.log(`[${step}/${total}] ${category}`);
  });
} catch (error) {
  console.error(
    [
      `Could not build the live catalog: the network is unavailable or the mirror cannot be read.`,
      `  mirror: ${RAW_MIRROR_BASE_URL}`,
      `  cause:  ${describeFailure(error)}`,
      `No file was written. Connect to the internet and run npm run catalog:live again.`,
    ].join("\n"),
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const tmpFile = `${outFile}.tmp`;
writeFileSync(tmpFile, JSON.stringify(catalog));
renameSync(tmpFile, outFile);

const counts = ["races", "classes", "feats", "backgrounds", "optionsAndFeatures", "spells"]
  .map((key) => `${key} ${catalog[key]?.length ?? 0}`)
  .join(", ");
console.log(`Wrote ${outFile}`);
console.log(`Catalog format ${catalog.catalogFormat}: ${counts}`);
