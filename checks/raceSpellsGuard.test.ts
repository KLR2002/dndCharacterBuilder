import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// The race spell table is gone: a race's or subrace's spells come from the Catalog (ADR 0017). This guard fails if the rules
// folder names the table's former entries again, whether as the trait titles the table gave or as the race names it matched.
// High Elf and half-elf descent stay as the one isolated special case (ticket 07 moves them), so they are not named here.

const RULES_DIR = fileURLToPath(new URL("../src/rules/", import.meta.url));

const FORMER_TITLES = [
  "Svirfneblin Magic",
  "Infernal Legacy",
  "Drow Magic",
  "Githyanki Psionics",
  "Githzerai Psionics",
  "Natural Illusionist",
  "Firbolg Magic",
  "Control Air and Water",
  "Celestial Legacy",
  "Fire Genasi Magic",
  "Water Genasi Magic",
];

/** The table's matchers: a race or subrace name the table tested with `includes`. Tiefling is not here: a feat prerequisite reads it. */
const FORMER_RACE_MATCHERS = /includes\(\s*"(drow|dark elf|firbolg|githyanki|githzerai|svirfneblin|deep gnome|forest gnome|triton|aasimar|genasi)"/i;

function ruleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ruleFiles(path + "/");
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("the rules folder names none of the race table's former trait titles", () => {
  const files = ruleFiles(RULES_DIR);
  assert.ok(files.length > 0, "the guard found no rule files to read");
  const offending = files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return FORMER_TITLES.filter((title) => text.includes(title)).map((title) => `${file}: ${title}`);
  });
  assert.deepEqual(offending, []);
});

test("the rules folder tests for no race or subrace name the table matched", () => {
  const offending = ruleFiles(RULES_DIR).flatMap((file) => {
    const match = readFileSync(file, "utf8").match(FORMER_RACE_MATCHERS);
    return match ? [`${file}: ${match[0]}`] : [];
  });
  assert.deepEqual(offending, []);
});
