import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { addSpellsOffer, spellDetailText, spellPage, type SpellPageRow } from "../src/rules/spellPage.ts";
import { getEldritchBlastDamage } from "../src/rules/attacks.ts";
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

test("sorcery points start at Sorcerer 2, and Metamagic's allowance steps at 3, 10 and 17", () => {
  const sorcerer = (level: number) =>
    makeChar({
      baseAbilityScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
      classes: [{ className: "Sorcerer", source: "PHB", level }],
    });

  const two = spellPage(sorcerer(2), catalogs);
  assert.equal(two.sorceryPoints?.max, 2);
  assert.equal(two.metamagic, null);

  assert.equal(spellPage(sorcerer(3), catalogs).metamagic?.allowance, 2);
  assert.equal(spellPage(sorcerer(10), catalogs).metamagic?.allowance, 3);
  assert.equal(spellPage(sorcerer(17), catalogs).metamagic?.allowance, 4);
});

test("a Mystic Arcanum tier takes the Warlock's DC and attack bonus while another class's page is open", () => {
  const warlockCleric = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 10, wis: 16, cha: 18 },
    classes: [
      { className: "Warlock", source: "PHB", level: 11 },
      { className: "Cleric", source: "PHB", level: 1 },
    ],
    ruleChoices: [
      { id: "Warlock__Mystic Arcanum 11", trait: "Mystic Arcanum (6th Level)", picked: ["Circle of Death"], choose: 1, from: ["Circle of Death"], origin: "class" },
    ],
  });
  const all = spellPage(warlockCleric, catalogs);
  const warlockKey = all.owners.find((o) => o.label.startsWith("Warlock"))?.ownerKey;
  const clericKey = all.owners.find((o) => o.label.startsWith("Cleric"))?.ownerKey;
  assert.ok(warlockKey && clericKey, "both owners are listed");

  const warlock = spellPage(warlockCleric, catalogs, warlockKey).header;
  const page = spellPage(warlockCleric, catalogs, clericKey);
  assert.equal(page.owner, clericKey);
  const tier = page.mysticArcanum[0];
  assert.ok(tier, "the chosen tier is listed");
  assert.equal(tier.chosenSpellName, "Circle of Death");
  assert.equal(tier.dc, warlock?.spellSaveDc);
  assert.equal(tier.attackBonus, warlock?.spellAttackBonus);
});

test("used spell slots above the total are clamped, and the page exposes the open profile", () => {
  const wizard = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Wizard", source: "PHB", level: 3 }],
    usedSpellSlots: { 1: 99 },
  });
  const page = spellPage(wizard, catalogs);
  const first = page.slots?.find((s) => s.level === 1);
  assert.ok(first);
  assert.equal(first.used, first.total);
  assert.equal(first.remaining, 0);
  assert.equal(page.profile?.className, "Wizard");
});

test("the Book of Ancient Secrets offer leaves out inscribed rituals and spells above the book's level", () => {
  const warlock = makeChar({
    baseAbilityScores: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 },
    classes: [{ className: "Warlock", source: "PHB", level: 4 }],
    ruleChoices: [
      { id: "PHB__Warlock__Invocations 2", trait: "Eldritch Invocations (2nd Level)", picked: ["Book of Ancient Secrets"], choose: 2, from: ["Book of Ancient Secrets"], origin: "class" },
    ],
    ritualBook: [{ name: "Detect Magic", source: "PHB", level: 1, isStarting: true }],
  });
  const book = spellPage(warlock, catalogs).ritualBook;
  assert.ok(book, "the book is listed");
  assert.equal(book.maxLevel, 2);
  assert.equal(book.entries.length, 1);
  const offer = book.inscribeOffer;
  assert.ok(offer.length > 0, "there are rituals to inscribe");
  assert.ok(!offer.some((s) => s.name === "Detect Magic"), "an inscribed ritual is not offered");
  assert.ok(offer.every((s) => s.level >= 1 && s.level <= 2 && s.ritual === true), "only rituals up to the book's level");
});

test("a character without a class profile still reads the granted, locked and at-will cards", () => {
  const bare = spellPage(makeChar(), catalogs);
  assert.deepEqual(bare.grantedCards, []);
  assert.deepEqual(bare.lockedCards, []);
  assert.deepEqual(bare.atWillCards, []);
  assert.equal(bare.profile, null);
});

function eldritchWarlock(cha: number, invocations: string[]): Character {
  return makeChar({
    baseAbilityScores: { str: 8, dex: 10, con: 12, int: 10, wis: 10, cha },
    classes: [{ className: "Warlock", source: "PHB", level: 2 }],
    ruleChoices: [
      {
        id: "PHB__Warlock__Invocations 2",
        trait: "Eldritch Invocations (2nd Level)",
        picked: invocations,
        choose: 2,
        origin: "class",
        from: [],
      },
    ],
    knownSpells: [{ name: "Eldritch Blast", ability: "cha", className: "Warlock", source: "PHB" }],
  });
}

test("Agonizing Blast puts the damage text in the Eldritch Blast row subtitle, with one badge", () => {
  const row = rowNamed(spellPage(eldritchWarlock(8, ["Agonizing Blast"]), catalogs), "Eldritch Blast");
  assert.ok(row.subtitle.endsWith(" • 1d10 - 1 force"), row.subtitle);
  assert.deepEqual(
    row.badges.filter((b) => b.label === "Agonizing Blast"),
    [{ label: "Agonizing Blast", tone: "accent" }],
  );
  assert.ok(!row.badges.some((b) => b.label.includes("dmg")));
});

test("Charisma 16 with Agonizing Blast reads 1d10 + 3 force on the row", () => {
  const row = rowNamed(spellPage(eldritchWarlock(16, ["Agonizing Blast"]), catalogs), "Eldritch Blast");
  assert.ok(row.subtitle.endsWith(" • 1d10 + 3 force"), row.subtitle);
});

test("without Agonizing Blast the Eldritch Blast row has no damage text and no badge", () => {
  const row = rowNamed(spellPage(eldritchWarlock(16, ["Armor of Shadows"]), catalogs), "Eldritch Blast");
  assert.ok(!row.subtitle.includes("force"), row.subtitle);
  assert.ok(!row.badges.some((b) => b.label === "Agonizing Blast"));
});

test("spellDetailText gives the Eldritch Blast damage line only with Agonizing Blast", () => {
  const spell = compendium.findSpell("Eldritch Blast");
  assert.ok(spell, "Eldritch Blast is in the compendium");

  const detail = spellDetailText(spell, eldritchWarlock(8, ["Agonizing Blast"]));
  assert.equal(detail.title, "Eldritch Blast");
  assert.ok(detail.content.includes("• Damage: 1d10 - 1 force"), detail.content);

  const plain = spellDetailText(spell, eldritchWarlock(8, ["Armor of Shadows"]));
  assert.ok(!plain.content.includes("Damage:"), plain.content);
  assert.ok(!plain.subtitle.includes("force"), plain.subtitle);
});

test("the Actions-tab Eldritch Blast damage reads the same formula", () => {
  assert.equal(getEldritchBlastDamage(eldritchWarlock(8, ["Agonizing Blast"])), "1d10 - 1 force");
  assert.equal(getEldritchBlastDamage(eldritchWarlock(16, ["Agonizing Blast"])), "1d10 + 3 force");
});

test("addSpellsOffer lists an Eldritch Knight's learnable spells with its known ones, its restricted schools and its known names", () => {
  const knight = makeChar({
    baseAbilityScores: { str: 15, dex: 14, con: 14, int: 16, wis: 10, cha: 10 },
    classes: [{ className: "Fighter", source: "PHB", level: 3, subclassName: "Eldritch Knight", subclassSource: "PHB" }],
    knownSpells: [
      { name: "Magic Missile", source: "PHB", className: "Fighter", ability: "int" },
      { name: "Identify", source: "PHB", className: "Fighter", ability: "int" },
    ],
  });
  const ownerKey = spellPage(knight, catalogs).owner;
  assert.ok(ownerKey, "the Knight has an owner");
  const offer = addSpellsOffer(knight, ownerKey, catalogs);

  assert.ok(offer.restrictedSchools.length > 0, "the Knight's learnable spells are school-restricted");
  assert.deepEqual(offer.knownNames.sort(), ["Identify", "Magic Missile"]);
  const names = offer.spells.map((s) => s.name);
  assert.ok(names.includes("Magic Missile"), "a known spell is listed");
  assert.ok(names.includes("Identify"), "a known spell is listed");
  assert.equal(new Set(names).size, names.length, "no spell is listed twice");
  const levels = offer.spells.map((s) => s.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), "sorted by level");

  assert.deepEqual(addSpellsOffer(knight, "no such owner", catalogs), { spells: [], restrictedSchools: [], knownNames: [] });
});
