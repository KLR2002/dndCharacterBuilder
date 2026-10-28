import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A race's or subrace's spells come from the Catalog (ADR 0017), so no race spell is named in the rules folder. This guard fails
// if the rules folder names a race spell's trait title, or tests for a race or subrace name, whichever way it is written.
// High Elf and half-elf descent are the one isolated special case (their cantrip migration), so they are not named here.

const RULES_DIR = fileURLToPath(new URL("../src/rules/", import.meta.url));

const SPELL_TRAIT_TITLES = [
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

/** The race and subrace names a rules file tests with `includes`. Tiefling is not here: a feat prerequisite reads it. */
const RACE_NAME_MATCHERS = /includes\(\s*"(drow|dark elf|firbolg|githyanki|githzerai|svirfneblin|deep gnome|forest gnome|triton|aasimar|genasi)"/i;

function ruleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ruleFiles(path + "/");
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("the rules folder names no race spell trait title", () => {
  const files = ruleFiles(RULES_DIR);
  assert.ok(files.length > 0, "the guard found no rule files to read");
  const offending = files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return SPELL_TRAIT_TITLES.filter((title) => text.includes(title)).map((title) => `${file}: ${title}`);
  });
  assert.deepEqual(offending, []);
});

test("the rules folder tests for no race or subrace name", () => {
  const offending = ruleFiles(RULES_DIR).flatMap((file) => {
    const match = readFileSync(file, "utf8").match(RACE_NAME_MATCHERS);
    return match ? [`${file}: ${match[0]}`] : [];
  });
  assert.deepEqual(offending, []);
});
