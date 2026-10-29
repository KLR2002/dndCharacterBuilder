import * as fs from "node:fs";
import * as path from "node:path";
import { ToolsClient } from "./client.ts";
import { DEFAULT_CONFIG } from "./config.ts";
import { scrapeBackgrounds } from "./scrapers/backgrounds.ts";
import { scrapeBeasts } from "./scrapers/beasts.ts";
import { scrapeClasses } from "./scrapers/classes.ts";
import { scrapeFeats } from "./scrapers/feats.ts";
import { scrapeItems } from "./scrapers/items.ts";
import { scrapeOptions } from "./scrapers/options.ts";
import { scrapeRaces } from "./scrapers/races.ts";
import { scrapeSpells } from "./scrapers/spells.ts";
import { scrapeBooks } from "./scrapers/books.ts";
import { scrapeConditions } from "./scrapers/conditions.ts";
import { scrapeOriginRules } from "./scrapers/origin-rules.ts";
import { newProficiencyReport } from "./parser/proficiency-grants.ts";
import { newStartingEquipmentReport } from "./parser/starting-equipment.ts";

interface CliOptions {
  only: string[];
  noCache: boolean;
  outputDir: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    only: [],
    noCache: false,
    outputDir: DEFAULT_CONFIG.outputDir,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-cache") {
      options.noCache = true;
    } else if (arg === "--output" && args[i + 1]) {
      options.outputDir = path.resolve(process.cwd(), args[++i]);
    } else if (arg === "--only" && args[i + 1]) {
      options.only = args[++i].split(",").map((s: string) => s.trim().toLowerCase());
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
5e.tools Data Scraper (TypeScript)
==================================
Directly scrapes player data from https://2014.5e.tools/ and converts it into convenient JSON format.

Usage:
  npm run scrape [options]
  npx tsx src/index.ts [options]

Options:
  --only <list>       Comma-separated list of categories to scrape:
                      races, classes, feats, options, backgrounds, items, spells, beasts, books, conditions, originrules
                      Default: all
  --no-cache          Bypass local .cache directory and re-fetch from network
  --output <path>     Directory where formatted JSON files will be written
                      Default: ./data
  --help, -h          Show this help screen
`);
}

function saveJson(filePath: string, data: any): { count: number; bytes: number } {
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, json, "utf8");
  const stats = fs.statSync(filePath);
  return {
    count: Array.isArray(data) ? data.length : 1,
    bytes: stats.size,
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const startTime = Date.now();

  console.log("==================================================");
  console.log("  5e.tools Player Data Scraper & Formatter        ");
  console.log("==================================================");
  console.log(`Source:     ${DEFAULT_CONFIG.baseUrl}`);
  console.log(`Output:     ${opts.outputDir}`);
  console.log(`Cache:      ${opts.noCache ? "Disabled" : "Enabled (.cache/)"}`);
  console.log(
    `Categories: ${opts.only.length > 0 ? opts.only.join(", ") : "All (Races, Classes, Feats, Options, Backgrounds, Items, Spells, Beasts, Books, Conditions, Origin Rules)"}`
  );
  console.log("--------------------------------------------------");

  if (!fs.existsSync(opts.outputDir)) {
    fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  const client = new ToolsClient({
    useCache: !opts.noCache,
  });

  const shouldRun = (category: string) =>
    opts.only.length === 0 || opts.only.includes(category);

  const summary: Record<string, { count: number; size: string; file: string }> = {};
  const proficiency = newProficiencyReport();
  const startingEquipment = newStartingEquipmentReport();

  try {
    // 1. Races
    if (shouldRun("races")) {
      console.log("\n[1/7] Scraping Races & Subraces...");
      const races = await scrapeRaces(client, proficiency);
      const file = path.join(opts.outputDir, "races.json");
      const { count, bytes } = saveJson(file, races);
      const totalSubraces = races.reduce((acc, r) => acc + (r.subraces?.length || 0), 0);
      summary["Races"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} races (${totalSubraces} subraces) -> ${file} (${formatBytes(bytes)})`);
    }

    // 2. Classes
    if (shouldRun("classes")) {
      console.log("\n[2/7] Scraping Classes, Subclasses & Features...");
      const classes = await scrapeClasses(client, proficiency, startingEquipment);
      const file = path.join(opts.outputDir, "classes.json");
      const { count, bytes } = saveJson(file, classes);
      const totalSubclasses = classes.reduce((acc, c) => acc + (c.subclasses?.length || 0), 0);
      summary["Classes"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} classes (${totalSubclasses} subclasses) -> ${file} (${formatBytes(bytes)})`);
      if (startingEquipment.unrecognised.length > 0) {
        console.log(`  ! ${startingEquipment.unrecognised.length} starting equipment entries not recognised (kept in place as "unrecognised"):`);
        for (const issue of startingEquipment.unrecognised) {
          console.log(`  · ${issue.owner}: ${issue.message}`);
        }
      }
    }

    // 3. Feats
    if (shouldRun("feats")) {
      console.log("\n[3/7] Scraping Feats...");
      const feats = await scrapeFeats(client, proficiency);
      const file = path.join(opts.outputDir, "feats.json");
      const { count, bytes } = saveJson(file, feats);
      summary["Feats"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} feats -> ${file} (${formatBytes(bytes)})`);
    }

    // 4. Options & Features
    if (shouldRun("options") || shouldRun("options&features") || shouldRun("features")) {
      console.log("\n[4/7] Scraping Options & Features...");
      const options = await scrapeOptions(client);
      const file = path.join(opts.outputDir, "options_and_features.json");
      const { count, bytes } = saveJson(file, options);
      summary["Options & Features"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} options & features -> ${file} (${formatBytes(bytes)})`);
    }

    // 5. Backgrounds
    if (shouldRun("backgrounds")) {
      console.log("\n[5/7] Scraping Backgrounds...");
      const backgrounds = await scrapeBackgrounds(client, proficiency);
      const file = path.join(opts.outputDir, "backgrounds.json");
      const { count, bytes } = saveJson(file, backgrounds);
      summary["Backgrounds"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} backgrounds -> ${file} (${formatBytes(bytes)})`);
    }

    // 6. Items
    if (shouldRun("items")) {
      console.log("\n[6/7] Scraping Items...");
      const items = await scrapeItems(client);
      const file = path.join(opts.outputDir, "items.json");
      const { count, bytes } = saveJson(file, items);
      summary["Items"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} items -> ${file} (${formatBytes(bytes)})`);

      const candidatePaths = [
        path.resolve(process.cwd(), "../src/data/items.json"),
        path.resolve(process.cwd(), "src/data/items.json"),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(path.dirname(p))) {
          saveJson(p, items);
          console.log(`  ✓ Synced items to ${p}`);
          break;
        }
      }
    }

    // 7. Spells
    if (shouldRun("spells")) {
      console.log("\n[7/8] Scraping Spells...");
      const spells = await scrapeSpells(client);
      const file = path.join(opts.outputDir, "spells.json");
      const { count, bytes } = saveJson(file, spells);
      summary["Spells"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} spells -> ${file} (${formatBytes(bytes)})`);
    }

    // 8. Beasts & Elementals
    if (shouldRun("beasts") || shouldRun("wildshape")) {
      console.log("\n[8/9] Scraping Beasts & Wild Shape Elementals...");
      const beasts = await scrapeBeasts(client);
      const file = path.join(opts.outputDir, "beasts.json");
      const { count, bytes } = saveJson(file, beasts);
      summary["Beasts"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} beasts -> ${file} (${formatBytes(bytes)})`);
    }

    // 9. Books & Sourcebooks
    if (shouldRun("books")) {
      console.log("\n[9/9] Scraping Books & Sourcebooks...");
      const books = await scrapeBooks(client);
      const file = path.join(opts.outputDir, "books.json");
      const { count, bytes } = saveJson(file, books);
      summary["Books"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} books -> ${file} (${formatBytes(bytes)})`);

      // Sync to src/data/books.json if possible
      const candidatePaths = [
        path.resolve(process.cwd(), "../src/data/books.json"),
        path.resolve(process.cwd(), "src/data/books.json"),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(path.dirname(p))) {
          saveJson(p, books);
          console.log(`  ✓ Synced books to ${p}`);
          break;
        }
      }
    }

    // 10. Conditions & Diseases
    if (shouldRun("conditions") || shouldRun("diseases") || shouldRun("status")) {
      console.log("\n[10/10] Scraping Conditions & Statuses...");
      const conditions = await scrapeConditions(client);
      const file = path.join(opts.outputDir, "conditions.json");
      const { count, bytes } = saveJson(file, conditions);
      summary["Conditions"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} conditions -> ${file} (${formatBytes(bytes)})`);

      // Sync to src/data/conditions.json if possible
      const candidatePaths = [
        path.resolve(process.cwd(), "../src/data/conditions.json"),
        path.resolve(process.cwd(), "src/data/conditions.json"),
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(path.dirname(p))) {
          saveJson(p, conditions);
          console.log(`  ✓ Synced conditions to ${p}`);
          break;
        }
      }
    }

    // 11. Origin Rules: written to the data dir only. The SRD Baseline carries none, so nothing is synced to src/data.
    if (shouldRun("originrules")) {
      console.log("\n[11/11] Scraping Origin Rules (Customizing Your Origin)...");
      const originRules = await scrapeOriginRules(client);
      const file = path.join(opts.outputDir, "origin_rules.json");
      const { count, bytes } = saveJson(file, originRules);
      summary["Origin Rules"] = {
        count,
        size: formatBytes(bytes),
        file: path.relative(process.cwd(), file),
      };
      console.log(`  ✓ Saved ${count} origin rule records -> ${file} (${formatBytes(bytes)})`);
    }

    // Proficiency Grants: how many features carry grants, and which ones matched the vocabulary but did not parse.
    if (proficiency.covered > 0 || proficiency.unparsed.length > 0) {
      console.log(`\n  Proficiency grants: ${proficiency.covered} features covered, ${proficiency.unparsed.length} unparsed`);
      for (const entry of proficiency.unparsed) {
        console.log(`  · ${entry.owner} / ${entry.feature}@${entry.level}: ${entry.unparsed.join(" | ")}`);
      }
    }

    // Write summary index
    const summaryPath = path.join(opts.outputDir, "summary.json");
    saveJson(summaryPath, {
      scrapedAt: new Date().toISOString(),
      source: DEFAULT_CONFIG.baseUrl,
      categories: summary,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n==================================================");
    console.log(`  Completed in ${elapsed}s! Summary:`);
    console.log("==================================================");
    for (const [cat, info] of Object.entries(summary)) {
      console.log(`  • ${cat.padEnd(20)}: ${String(info.count).padStart(5)} items (${info.size}) -> ${info.file}`);
    }
    console.log(`  • Metadata summary: ${path.relative(process.cwd(), summaryPath)}`);
    console.log("==================================================");
  } catch (error: any) {
    console.error("\n❌ Scraping failed:", error.message || error);
    process.exit(1);
  }
}

main();
