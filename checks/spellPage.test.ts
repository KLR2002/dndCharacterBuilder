import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { spellPage, type SpellPageRow } from "../src/rules/spellPage.ts";
import { swapSubclassSpell } from "../src/rules/characterSpells.ts";
import { integratedTestCompendium, makeChar } from "./testUtils.ts";
import type { Character } from "../src/types/character.ts";

const compendium = integratedTestCompendium();
const catalogs = { compendium, activeBooks: ALL_BOOKS };

function rowsOf(page: ReturnType<typeof spellPage>): SpellPageRow[] {
  return page.levels.flatMap((level) => level.rows);
}

function rowNamed(page: ReturnType<typeof spellPage>, name: string): SpellPageRow {
  const row = rowsOf(page).find((r) => r.name === name);
  assert.ok(row, `${name} is listed`);
  return row;
}

const cleric3Wizard3: Character = makeChar({
  baseAbilityScores: { str: 10, dex: 10, con: 14, int: 16, wis: 16, cha: 10 },
  classes: [
    { className: "Cleric", source: "PHB", level: 3, subclassName: "Life Domain", subclassSource: "PHB" },
    { className: "Wizard", source: "PHB", level: 3 },
  ],
  knownSpells: [
    { name: "Magic Missile", source: "PHB", className: "Wizard", ability: "int" },
    { name: "Identify", source: "PHB", className: "Wizard", ability: "int" },
  ],
});

test("a Cleric and a Wizard give two owner pills, and the Cleric page shows its domain spell locked", () => {
  const page = spellPage(cleric3Wizard3, catalogs);
  assert.equal(page.owners.length, 2);
  assert.equal(page.owner, page.owners[0].ownerKey);
  assert.equal(page.owners[0].selected, true);
  assert.equal(page.owners[1].selected, false);
  assert.match(page.owners[0].label, /^Cleric \(WIS DC \d+ \/ [+-]\d+\)$/);

  const bless = rowNamed(page, "Bless");
  assert.equal(bless.prepare, "locked");
  assert.equal(bless.canForget, false);
  assert.ok(bless.badges.some((b) => b.label === "Life Domain" && b.tone === "secondary"));
});

test("the Wizard page lists only Wizard spells and its counter reads the spellbook", () => {
  const wizardKey = spellPage(cleric3Wizard3, catalogs).owners[1].ownerKey;
  const page = spellPage(cleric3Wizard3, catalogs, wizardKey);
  assert.equal(page.owner, wizardKey);
  assert.equal(page.owners[1].selected, true);
  const names = rowsOf(page).map((r) => r.name);
  assert.ok(names.includes("Magic Missile"));
  assert.ok(!names.includes("Bless"), "the Cleric's spells are not on the Wizard page");
  assert.equal(page.header?.className, "Wizard");
  assert.equal(page.listSubtitle.endsWith("2 in spellbook"), true);
});

test("the prepared counter reads the always-prepared count and the owner's limit", () => {
  const cleric = spellPage(cleric3Wizard3, catalogs);
  assert.equal(cleric.prepared?.count, 0);
  assert.equal(cleric.prepared?.alwaysPrepared, 4);
  assert.match(cleric.prepared?.text ?? "", /^0 \/ \d+ prepared \(\+ 4 always prepared\)$/);

  const plain = makeChar({
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
  });
  const wizard = spellPage(plain, catalogs);
  assert.equal(wizard.prepared?.alwaysPrepared, 0);
  assert.match(wizard.prepared?.text ?? "", /^0 \/ \d+ Prepared$/);
});

test("an unknown owner key falls back to the first owner, and a character without a profile has no page", () => {
  const page = spellPage(cleric3Wizard3, catalogs, "no such owner");
  assert.equal(page.owner, page.owners[0].ownerKey);

  const bare = spellPage(makeChar(), catalogs);
  assert.equal(bare.owner, null);
  assert.equal(bare.header, null);
  assert.deepEqual(bare.levels, []);
});

test("a Warlock's Pact of the Tome rows carry the Pact badge, cannot be forgotten, and at-will invocations open level 0", () => {
  const warlock = makeChar({
    baseAbilityScores: { str: 8, dex: 10, con: 12, int: 10, wis: 10, cha: 16 },
    classes: [{ className: "Warlock", source: "PHB", level: 3 }],
    ruleChoices: [
      { id: "PHB__Warlock__Pact Boon", trait: "Pact Boon", picked: ["Pact of the Tome"], choose: 1, origin: "class", from: [] },
      { id: "Warlock__Pact of the Tome__Cantrips", trait: "Pact of the Tome Cantrips", picked: ["Guidance"], choose: 1, origin: "class", from: [] },
      { id: "PHB__Warlock__Invocations 2", trait: "Eldritch Invocations (2nd Level)", picked: ["Armor of Shadows"], choose: 1, origin: "class", from: [] },
    ],
    knownSpells: [
      { name: "Eldritch Blast", ability: "cha", className: "Warlock", source: "PHB" },
      { name: "Guidance", ownerKey: "Warlock__Tome", ability: "cha", className: "Warlock", source: "PHB" },
    ],
  });
  const page = spellPage(warlock, catalogs);

  const guidance = rowNamed(page, "Guidance");
  assert.ok(guidance.badges.some((b) => b.label === "[Pact of the Tome]"));
  assert.equal(guidance.canForget, false);
  assert.equal(guidance.prepare, "none");

  const eldritchBlast = rowNamed(page, "Eldritch Blast");
  assert.equal(eldritchBlast.canForget, true);

  assert.equal(page.levels[0].title, "CANTRIPS & AT-WILL");
  const mageArmor = rowNamed(page, "Mage Armor");
  assert.equal(mageArmor.level, 0);
  assert.equal(mageArmor.canForget, false);
  assert.ok(mageArmor.badges.some((b) => b.label === "At Will - Invocation"));
});

test("an Eldritch Knight's out-of-school spell carries Any school, and an in-school one does not", () => {
  const knight = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Eldritch Knight", subclassSource: "PHB" }],
    knownSpells: [
      { name: "Magic Missile", source: "PHB", className: "Fighter", ability: "int" },
      { name: "Identify", source: "PHB", className: "Fighter", ability: "int" },
    ],
  });
  const page = spellPage(knight, catalogs);
  assert.ok(rowNamed(page, "Identify").badges.some((b) => b.label === "Any school"));
  assert.ok(!rowNamed(page, "Magic Missile").badges.some((b) => b.label === "Any school"));

  const wizard = spellPage(
    makeChar({
      baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
      classes: [{ className: "Wizard", source: "PHB", level: 3 }],
      knownSpells: [{ name: "Identify", source: "PHB", className: "Wizard", ability: "int" }],
    }),
    catalogs,
  );
  assert.ok(!rowNamed(wizard, "Identify").badges.some((b) => b.label === "Any school"));
});

test("a replaceable Clockwork Soul spell offers a swap, and after a swap it offers a reset to the original", () => {
  const sorcerer = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
    classes: [{ className: "Sorcerer", source: "TCE", level: 3, subclassName: "Clockwork Soul", subclassSource: "TCE" }],
  });
  const before = spellPage(sorcerer, catalogs);
  const granted = rowsOf(before).find((r) => r.swap !== null);
  assert.ok(granted, "a Clockwork Soul spell is replaceable");
  assert.equal(granted.swap?.canSwap, true);
  assert.equal(granted.swap?.canReset, false);
  assert.equal(granted.swap?.originalName, granted.name);

  const swapped = swapSubclassSpell(sorcerer, granted.name, "Feather Fall");
  const after = spellPage(swapped, catalogs);
  const replaced = rowsOf(after).find((r) => r.name === "Feather Fall");
  assert.ok(replaced, "the replacement is listed");
  assert.equal(replaced.swap?.canReset, true);
  assert.equal(replaced.swap?.originalName, granted.name);
});
