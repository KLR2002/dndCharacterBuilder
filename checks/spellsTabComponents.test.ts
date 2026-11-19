import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The Spells tab reads rules only through the Spell Page and the Ledger's write functions. Its components
// render the view they are given and report through callbacks: they never read the character context or write the character.

const TAB = fileURLToPath(new URL("../src/components/tabs/SpellsTab.tsx", import.meta.url));
const SPELLS_DIR = fileURLToPath(new URL("../src/components/spells/", import.meta.url));

/** The Ledger's write functions the Spells tab may import from characterSpells. */
const LEDGER_WRITES = new Set([
  "toggleSpellSlot",
  "togglePactSlot",
  "spendSorceryPoints",
  "toggleMysticArcanumCast",
  "toggleMetamagic",
  "toggleInnateSpellUse",
  "inscribeRitual",
  "removeInscribedRitual",
  "swapSubclassSpell",
  "resetSubclassSpellSwap",
  "togglePrepared",
  "learnSpell",
  "forgetSpell",
]);

const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/g;

/** Imports that break the rule: a value import from src/rules/ other than the Spell Page or a Ledger write, or a catalog lookup module. */
function importViolations(source: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(IMPORT)) {
    const [, typeOnly, clause, path] = match;
    if (path.includes("services/dataService")) violations.push(`imports ${path}`);
    if (!path.includes("/rules/") || typeOnly) continue;
    const module = path.split("/").pop();
    const braces = clause.match(/\{([\s\S]*)\}/);
    const specifiers = braces ? braces[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (module === "spellPage") continue;
    if (module === "characterSpells") {
      for (const spec of specifiers) {
        if (spec.startsWith("type ")) continue;
        const name = spec.split(/\s+as\s+/)[0];
        if (!LEDGER_WRITES.has(name)) violations.push(`imports ${name} from ${path}`);
      }
      continue;
    }
    for (const spec of specifiers) {
      if (!spec.startsWith("type ")) violations.push(`imports ${spec} from ${path}`);
    }
    if (specifiers.length === 0) violations.push(`imports ${clause} from ${path}`);
  }
  return violations;
}

const spellsFiles = readdirSync(SPELLS_DIR)
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  .map((f) => SPELLS_DIR + f);

test("the Spells tab and its components import rules only through the Spell Page and the Ledger's writes", () => {
  assert.ok(spellsFiles.length > 0, "the spells components folder has files");
  for (const file of [TAB, ...spellsFiles]) {
    assert.deepEqual(importViolations(readFileSync(file, "utf8")), [], file);
  }
});

test("no Spells component reads the character context: the tab passes the page and callbacks down", () => {
  for (const file of spellsFiles) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /CharacterContext|\buseCharacters?\b/, file);
  }
});
