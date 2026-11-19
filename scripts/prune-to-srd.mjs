import fs from "node:fs";
import path from "node:path";
import { applySrdNames, pruneClasses } from "./srdBaseline.ts";

const scrapDataDir = path.resolve("dnd5eToolsScrap/data");
const cacheDir = path.resolve("dnd5eToolsScrap/.cache");
const srcDataDir = path.resolve("src/data");

console.log("Pruning data to strictly 2014 SRD 5.1 baseline...");

// The baseline's records by file. They are written together at the end, once the SRD names are applied.
const baseline = {};

// 1. Classes
const classesRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "classes.json"), "utf8"));
const srdClasses = pruneClasses(classesRaw);

baseline["classes.json"] = srdClasses;
console.log(`✓ Saved ${srdClasses.length} SRD classes with 1 archetype each`);

// 2. Races
const racesRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "races.json"), "utf8"));
const srdRaceNames = ["Dragonborn", "Dwarf", "Elf", "Gnome", "Half-Elf", "Half-Orc", "Halfling", "Human", "Tiefling"];
const srdSubraceNames = {
  Dwarf: ["Hill", "Hill Dwarf"],
  Elf: ["High", "High Elf"],
  Gnome: ["Rock", "Rock Gnome"],
  Halfling: ["Lightfoot", "Lightfoot Halfling"],
};

const srdRaces = racesRaw
  .filter((r) => r.source === "PHB" && srdRaceNames.includes(r.name))
  .map((r) => {
    let subraces = [];
    if (srdSubraceNames[r.name]) {
      const targets = srdSubraceNames[r.name].map((t) => t.toLowerCase());
      subraces = (r.subraces || [])
        .filter((sr) => {
          const srName = sr.name.toLowerCase();
          return targets.some((t) => srName === t || srName.startsWith(t) || t.startsWith(srName));
        })
        .map((sr) => ({ ...sr, source: "SRD" }));
    }
    let abilityScoreIncrease = r.abilityScoreIncrease;
    if (r.name === "Human") {
      abilityScoreIncrease = [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }];
    }
    return {
      ...r,
      source: "SRD",
      abilityScoreIncrease,
      subraces,
    };
  });

baseline["races.json"] = srdRaces;
console.log(`✓ Saved ${srdRaces.length} SRD races`);

// 3. Backgrounds
const backgroundsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "backgrounds.json"), "utf8"));
const srdBackgrounds = backgroundsRaw
  .filter((b) => b.name === "Acolyte" && b.source === "PHB")
  .map((b) => ({ ...b, source: "SRD" }));

baseline["backgrounds.json"] = srdBackgrounds;
console.log(`✓ Saved ${srdBackgrounds.length} SRD backgrounds (Acolyte)`);

// 4. Feats
const featsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "feats.json"), "utf8"));
const srdFeats = featsRaw
  .filter((f) => f.name === "Grappler" && f.source === "PHB")
  .map((f) => ({ ...f, source: "SRD" }));

baseline["feats.json"] = srdFeats;
console.log(`✓ Saved ${srdFeats.length} SRD feats (Grappler)`);

// 5. Spells
// Load raw PHB spells cache to identify exact srd: true spells
const rawPhbSpells = JSON.parse(fs.readFileSync(path.join(cacheDir, "data_spells_spells-phb.json.json"), "utf8")).spell;
const srdSpellNameSet = new Set(
  rawPhbSpells.filter((s) => s.srd === true || s.srd === "5.1" || s.srd).map((s) => s.name.toLowerCase())
);

const spellsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "spells.json"), "utf8"));
const srdSpells = spellsRaw
  .filter((s) => s.source === "PHB" && srdSpellNameSet.has(s.name.toLowerCase()))
  .map((s) => ({
    ...s,
    source: "SRD",
    classVariants: undefined, // No non-SRD class variants
  }));

baseline["spells.json"] = srdSpells;
console.log(`✓ Saved ${srdSpells.length} SRD spells`);

// 6. Items
// Check raw items cache for srd: true
const rawItems = JSON.parse(fs.readFileSync(path.join(cacheDir, "data_items.json.json"), "utf8")).item;
const rawBaseItems = JSON.parse(fs.readFileSync(path.join(cacheDir, "data_items-base.json.json"), "utf8")).baseitem;
const srdItemNameSet = new Set([
  ...rawItems.filter((i) => i.srd === true || i.srd).map((i) => i.name.toLowerCase()),
  ...rawBaseItems.filter((i) => i.source === "PHB" || i.srd).map((i) => i.name.toLowerCase()),
]);

const itemsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "items.json"), "utf8"));
const srdItems = itemsRaw
  .filter((i) => srdItemNameSet.has(i.name.toLowerCase()))
  .map((i) => ({ ...i, source: "SRD" }));

baseline["items.json"] = srdItems;
console.log(`✓ Saved ${srdItems.length} SRD items`);

// 7. Beasts
const beastsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "beasts.json"), "utf8"));
// SRD beasts: source MM beasts that are in SRD or MM
const srdBeasts = beastsRaw
  .filter((b) => b.source === "MM")
  .map((b) => ({ ...b, source: "SRD" }));

baseline["beasts.json"] = srdBeasts;
console.log(`✓ Saved ${srdBeasts.length} SRD beasts`);

// 8. Conditions
const conditionsRaw = JSON.parse(
  fs.existsSync(path.join(scrapDataDir, "conditions.json"))
    ? fs.readFileSync(path.join(scrapDataDir, "conditions.json"), "utf8")
    : fs.readFileSync(path.join(srcDataDir, "conditions.json"), "utf8")
);
const srdConditions = conditionsRaw.map((c) => ({ ...c, source: "SRD" }));
baseline["conditions.json"] = srdConditions;
console.log(`✓ Saved ${srdConditions.length} SRD conditions`);

// 9. Options and features
const optionsRaw = JSON.parse(fs.readFileSync(path.join(scrapDataDir, "options_and_features.json"), "utf8"));
const srdOptions = optionsRaw
  .filter((o) => o.source === "PHB")
  .map((o) => ({ ...o, source: "SRD" }));
baseline["options_and_features.json"] = srdOptions;
console.log(`✓ Saved ${srdOptions.length} SRD options and features`);

// 10. Books
const srdBooks = [
  {
    id: "SRD",
    name: "System Reference Document 5.1",
    source: "SRD",
    group: "core",
  },
];
baseline["books.json"] = srdBooks;

// The SRD names apply to every file at once, so a reference in one file follows a record renamed in another.
for (const [file, records] of Object.entries(applySrdNames(baseline))) {
  fs.writeFileSync(path.join(srcDataDir, file), JSON.stringify(records, null, 2), "utf8");
}
console.log(`✓ Saved ${Object.keys(baseline).length} baseline files with SRD names applied`);

// 11. Summary
const summary = {
  scrapedAt: new Date().toISOString(),
  source: "System Reference Document 5.1 (OGL / Creative Commons)",
  categories: {
    Classes: { count: srdClasses.length },
    Races: { count: srdRaces.length },
    Backgrounds: { count: srdBackgrounds.length },
    Feats: { count: srdFeats.length },
    Spells: { count: srdSpells.length },
    Items: { count: srdItems.length },
    Beasts: { count: srdBeasts.length },
    Conditions: { count: srdConditions.length },
    Options: { count: srdOptions.length },
    Books: { count: srdBooks.length },
  },
};
fs.writeFileSync(path.join(srcDataDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
console.log("✓ SRD baseline generation complete!");
