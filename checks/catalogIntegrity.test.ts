import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTestCatalog, makeChar } from "./testUtils.ts";
import {
  ALL_RESOURCE_BOOKS,
  BOOK_CATEGORIES,
  BOOK_CATEGORY_LABELS,
  DEFAULT_ACTIVE_BOOK_CODES,
} from "../src/constants/books.ts";
import { checkActiveBooksIntegrity } from "../src/rules/builderTransitions.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import type { SpellData, RaceData, ClassData } from "../src/types/dnd5e.ts";

test("catalog integrity: spells.json conforms to source isolation and variant schema", () => {
  const spells = loadTestCatalog<SpellData[]>("spells");
  assert.ok(Array.isArray(spells) && spells.length > 500, "Spells catalog should contain >500 items");

  for (const s of spells) {
    assert.ok(s.name, `Spell must have a name: ${JSON.stringify(s)}`);
    assert.ok(s.source, `Spell ${s.name} must have a source`);
    assert.ok(typeof s.level === "number" && s.level >= 0 && s.level <= 9, `Spell ${s.name} must have level 0-9`);

    // Verify native classes array
    assert.ok(Array.isArray(s.classes), `Spell ${s.name} must have classes array`);

    // Cross-book class isolation: Artificer (introduced in TCE/ERLW) must never leak into native PHB classes
    if (s.source === "PHB") {
      assert.equal(
        s.classes.includes("Artificer"),
        false,
        `PHB spell ${s.name} must not list Artificer in native classes; Artificer grant must be in classVariants`
      );
    }

    // Verify classVariants if present
    if (s.classVariants) {
      assert.ok(Array.isArray(s.classVariants), `classVariants on ${s.name} must be an array`);
      for (const cv of s.classVariants) {
        assert.ok(cv.name && cv.name.trim().length > 0, `classVariant on ${s.name} must have a name`);
        assert.ok(cv.definedInSource && cv.definedInSource.trim().length > 0, `classVariant on ${s.name} must have definedInSource`);
        assert.ok(cv.source && cv.source.trim().length > 0, `classVariant on ${s.name} must have source`);
      }
    }
  }

  // Spot-check known critical spells:
  const aid = spells.find((s) => s.name === "Aid" && s.source === "PHB");
  assert.ok(aid, "Aid must exist in PHB spells");
  assert.deepEqual(aid.classes, ["Cleric", "Paladin"]);
  assert.ok(aid.classVariants?.some((v) => v.name === "Bard" && v.definedInSource === "TCE"));
  assert.ok(aid.classVariants?.some((v) => v.name === "Ranger" && v.definedInSource === "TCE"));
  assert.ok(aid.classVariants?.some((v) => v.name === "Artificer" && v.definedInSource === "TCE"));

  const controlFlames = spells.find((s) => s.name === "Control Flames" && s.source === "XGE");
  assert.ok(controlFlames, "Control Flames must exist in XGE spells");
  assert.deepEqual(controlFlames.classes, ["Druid", "Sorcerer", "Wizard"]);
});

test("catalog integrity: races.json and classes.json have required rule fields", () => {
  const races = loadTestCatalog<RaceData[]>("races");
  assert.ok(Array.isArray(races) && races.length > 0, "Races catalog must not be empty");
  for (const r of races) {
    assert.ok(r.name && r.source, `Race must have name and source`);
    assert.ok(typeof r.speed?.walk === "number", `Race ${r.name} must have walk speed`);
    assert.ok(Array.isArray(r.traits), `Race ${r.name} must have traits array`);
  }

  const classes = loadTestCatalog<ClassData[]>("classes");
  assert.ok(Array.isArray(classes) && classes.length >= 12, "Classes catalog must have at least 12 classes");
  for (const c of classes) {
    assert.ok(c.name && c.source, `Class must have name and source`);
    assert.ok(c.hitDie, `Class ${c.name} must have hitDie`);
    assert.ok(Array.isArray(c.savingThrows), `Class ${c.name} must have savingThrows`);
  }
});

test("catalog integrity: beasts.json contains valid beasts, excludes swarms, and includes Circle of the Moon elementals", () => {
  const beasts = loadTestCatalog<any[]>("beasts");
  assert.ok(Array.isArray(beasts) && beasts.length >= 200, "Beasts catalog should contain >= 200 creatures");

  for (const b of beasts) {
    assert.ok(b.name, `Beast must have name: ${JSON.stringify(b)}`);
    assert.ok(b.source, `Beast ${b.name} must have source`);
    assert.ok(b.size, `Beast ${b.name} must have size`);
    assert.ok(b.type === "beast" || b.type === "elemental", `Beast ${b.name} must have type beast or elemental`);
    assert.ok(typeof b.cr === "string", `Beast ${b.name} must have cr string`);
    assert.ok(typeof b.crNumeric === "number" && b.crNumeric >= 0 && b.crNumeric <= 6, `Beast ${b.name} crNumeric must be 0-6`);
    assert.ok(typeof b.ac === "number", `Beast ${b.name} must have ac`);
    assert.ok(typeof b.hp?.average === "number", `Beast ${b.name} must have average hp`);
    assert.ok(typeof b.hp?.formula === "string", `Beast ${b.name} must have hp formula`);
    assert.ok(b.abilities && typeof b.abilities.str === "number", `Beast ${b.name} must have abilities`);

    // Strictly no swarms
    assert.equal(b.name.toLowerCase().startsWith("swarm of"), false, `Swarms must be excluded: ${b.name}`);
  }

  // Spot-check core Wild Shape forms
  const brownBear = beasts.find((b) => b.name === "Brown Bear" && b.source === "MM");
  assert.ok(brownBear, "Brown Bear must exist in MM beasts");
  assert.equal(brownBear.cr, "1");
  assert.equal(brownBear.hp.average, 34);
  assert.ok(brownBear.actions?.some((a: any) => a.name === "Bite" || a.name === "Claws"));

  const direWolf = beasts.find((b) => b.name === "Dire Wolf" && b.source === "MM");
  assert.ok(direWolf, "Dire Wolf must exist in MM beasts");
  assert.equal(direWolf.cr, "1");

  const badger = beasts.find((b) => b.name === "Badger" && b.source === "MM");
  assert.ok(badger, "Badger must exist in MM beasts");
  assert.equal(badger.cr, "0");

  const giantEagle = beasts.find((b) => b.name === "Giant Eagle" && b.source === "MM");
  assert.ok(giantEagle, "Giant Eagle must exist in MM beasts");
  assert.ok(giantEagle.speed.fly && giantEagle.speed.fly > 0, "Giant Eagle must have fly speed");

  const crocodile = beasts.find((b) => b.name === "Crocodile" && b.source === "MM");
  assert.ok(crocodile, "Crocodile must exist in MM beasts");
  assert.ok(crocodile.speed.swim && crocodile.speed.swim > 0, "Crocodile must have swim speed");

  const mammoth = beasts.find((b) => b.name === "Mammoth" && b.source === "MM");
  assert.ok(mammoth, "Mammoth must exist in MM beasts");
  assert.equal(mammoth.cr, "6");

  // Verify the four Circle of the Moon CR 5 elementals
  const elementals = ["Air Elemental", "Earth Elemental", "Fire Elemental", "Water Elemental"];
  for (const elName of elementals) {
    const el = beasts.find((b) => b.name === elName && b.source === "MM");
    assert.ok(el, `${elName} must exist in catalog`);
    assert.equal(el.type, "elemental");
    assert.equal(el.cr, "5");
    assert.equal(el.isElementalWildShape, true);
  }
});

test("books: Monster Manual (MM) is registered but inactive by default", () => {
  const mmBook = ALL_RESOURCE_BOOKS.find((b) => b.code === "MM");
  assert.ok(mmBook, "MM must be registered in ALL_RESOURCE_BOOKS");
  assert.equal(mmBook.isDefaultActive, false, "MM should not be active by default");
  assert.equal(
    DEFAULT_ACTIVE_BOOK_CODES.includes("MM"),
    false,
    "DEFAULT_ACTIVE_BOOK_CODES should not include MM"
  );
});

test("books: Plane Shift sourcebooks (PSA, PSI, PSK, PSZ, PSD, PSX) are registered and toggleable under 'other'", () => {
  const planeShiftCodes = ["PSA", "PSI", "PSK", "PSZ", "PSD", "PSX"];
  for (const code of planeShiftCodes) {
    const book = ALL_RESOURCE_BOOKS.find((b) => b.code === code);
    assert.ok(book, `Plane Shift book ${code} must be registered in ALL_RESOURCE_BOOKS`);
    assert.equal(book.category, "other");
    assert.equal(book.isDefaultActive, false);
    assert.equal(DEFAULT_ACTIVE_BOOK_CODES.includes(code), false);
  }
});

test("books: all 5 categories have books and valid labels", () => {
  assert.equal(BOOK_CATEGORIES.length, 5);
  for (const cat of BOOK_CATEGORIES) {
    assert.ok(BOOK_CATEGORY_LABELS[cat], `Category ${cat} must have a label`);
    const books = ALL_RESOURCE_BOOKS.filter((b) => b.category === cat);
    assert.ok(books.length > 0, `Category ${cat} must contain at least one book`);
  }
});

test("books: default active book codes matches focused official 2014 list", () => {
  const expectedFocused = [
    "PHB", "EEPC", "SCAG", "VGM", "XGE", "MTF", "TCE",
    "VRGR", "WBtW", "FTD", "MPMM", "LR", "TP", "OGA",
  ];
  assert.equal(DEFAULT_ACTIVE_BOOK_CODES.length, expectedFocused.length);
  for (const code of expectedFocused) {
    assert.ok(DEFAULT_ACTIVE_BOOK_CODES.includes(code), `${code} must be in DEFAULT_ACTIVE_BOOK_CODES`);
  }
  for (const book of ALL_RESOURCE_BOOKS) {
    assert.equal(
      DEFAULT_ACTIVE_BOOK_CODES.includes(book.code),
      book.isDefaultActive,
      `Default active status mismatch for ${book.code}`
    );
  }
});

test("books: official 2014 sourcebooks categorization matches specification", () => {
  const expectedCategories = {
    core: ["PHB", "MM", "DMG"],
    supplement: ["XGE", "TCE", "MPMM", "FTD", "BGG", "BMT", "EEPC", "VGM", "MTF"],
    setting: ["SCAG", "ERLW", "EGW", "GGR", "MOT", "VRGR", "AAG", "SCC", "SatO", "AI"],
    adventure: [
      "CoS", "ToA", "WDH", "WDMM", "IDRotF", "BGDIA", "WBtW", "SKT", "PotA",
      "OotA", "TftYP", "GoS", "PaBTSO", "DSotDQ", "KftGV", "JttRC", "CRCotN", "CM",
      "LMoP", "HoTDQ", "RoT", "DoIP", "VEoR", "QftIS",
    ],
    other: ["PSA", "PSI", "PSK", "PSZ", "PSD", "PSX", "TP", "LR", "OGA"],
  };

  for (const [category, codes] of Object.entries(expectedCategories)) {
    for (const code of codes) {
      const book = ALL_RESOURCE_BOOKS.find((b) => b.code === code);
      assert.ok(book, `Book ${code} must be registered in ALL_RESOURCE_BOOKS`);
      assert.equal(book.category, category, `Book ${code} must be in category ${category}`);
    }
  }
});

test("catalog integrity: books.json has exact 1:1 match with ALL_RESOURCE_BOOKS", () => {
  const booksCatalog = loadTestCatalog<{ id: string; name: string; source: string; group: string }[]>("books");
  assert.ok(Array.isArray(booksCatalog) && booksCatalog.length > 0, "books catalog must not be empty");
  assert.equal(ALL_RESOURCE_BOOKS.length, booksCatalog.length, "ALL_RESOURCE_BOOKS length must equal books.json length");

  const catalogCodes = new Set(booksCatalog.map((b) => b.source || b.id));
  const resourceCodes = new Set(ALL_RESOURCE_BOOKS.map((b) => b.code));

  for (const book of booksCatalog) {
    const code = book.source || book.id;
    assert.ok(
      resourceCodes.has(code),
      `Book ${code} (${book.name}) in src/data/books.json is missing in ALL_RESOURCE_BOOKS`
    );
  }

  for (const resource of ALL_RESOURCE_BOOKS) {
    assert.ok(
      catalogCodes.has(resource.code),
      `Resource book ${resource.code} (${resource.name}) in ALL_RESOURCE_BOOKS is missing in src/data/books.json`
    );
  }
});

test("books: category bulk enablement and disablement logic", () => {
  let currentActive = ["PHB"];

  // Enable all adventures
  const adventureBooks = ALL_RESOURCE_BOOKS.filter((b) => b.category === "adventure");
  const enabledSet = new Set(currentActive);
  adventureBooks.forEach((b) => enabledSet.add(b.code));
  currentActive = Array.from(enabledSet);

  for (const adv of adventureBooks) {
    assert.ok(currentActive.includes(adv.code), `Adventure ${adv.code} should now be active`);
  }

  // Disable all adventures
  const disabledSet = new Set(currentActive);
  adventureBooks.forEach((b) => disabledSet.delete(b.code));
  currentActive = Array.from(disabledSet);

  for (const adv of adventureBooks) {
    assert.ok(!currentActive.includes(adv.code), `Adventure ${adv.code} should now be disabled`);
  }
  assert.ok(currentActive.includes("PHB"), "PHB should still be active");
});

test("books: checkActiveBooksIntegrity warns when character feature is from disabled book", () => {
  // 1. Character with subclass from XGE
  const hexbladeWarlock = makeChar({
    classes: [
      {
        className: "Warlock",
        source: "PHB",
        level: 3,
        subclassName: "The Hexblade",
        subclassSource: "XGE",
      },
    ],
  });

  // When XGE is disabled
  const warningsWithoutXge = checkActiveBooksIntegrity(hexbladeWarlock, ["PHB", "TCE"]);
  assert.ok(
    warningsWithoutXge.some((w) => w.includes("Hexblade") && w.includes("XGE")),
    `Expected subclass warning for Hexblade, got: ${JSON.stringify(warningsWithoutXge)}`
  );

  // When XGE is enabled
  const warningsWithXge = checkActiveBooksIntegrity(hexbladeWarlock, ["PHB", "TCE", "XGE"]);
  assert.equal(
    warningsWithXge.some((w) => w.includes("Hexblade")),
    false,
    "Should not warn when XGE is active"
  );

  // 2. Character with race from MPMM and feat from FTD
  const dragonbornHero = makeChar({
    race: {
      name: "Goliath",
      source: "MPMM",
    },
    asiSelections: [
      {
        level: 4,
        type: "feat",
        featName: "Gift of the Metallic Dragon",
        featSource: "FTD",
      },
    ],
  });

  const warningsDisabled = checkActiveBooksIntegrity(dragonbornHero, ["PHB"]);
  assert.ok(
    warningsDisabled.some((w) => w.includes("Goliath") && w.includes("MPMM")),
    "Should warn about Goliath from MPMM"
  );
  assert.ok(
    warningsDisabled.some((w) => w.includes("Gift of the Metallic Dragon") && w.includes("FTD")),
    "Should warn about feat from FTD"
  );
});

test("books: a feat a background grants is not from a disabled sourcebook, while a feat of a disabled book still is", () => {
  const backgroundFeat = makeChar({
    originFeats: [{ level: 1, type: "feat", featName: "Sample Feat", featSource: BACKGROUND_FEAT_SOURCE }],
  });
  assert.deepEqual(checkActiveBooksIntegrity(backgroundFeat, ["PHB"]), []);

  const bookFeat = makeChar({
    originFeats: [{ level: 1, type: "feat", featName: "Sample Feat", featSource: "TST" }],
  });
  assert.ok(
    checkActiveBooksIntegrity(bookFeat, ["PHB"]).some((w) => w.includes("Sample Feat") && w.includes("TST")),
    "a feat of a disabled book still warns"
  );
});

test("books: SRD records are never warned under DEFAULT_ACTIVE_BOOK_CODES, while a disabled book still warns", () => {
  const srdHero = makeChar({
    race: { name: "Dwarf", source: "SRD" },
    classes: [{ className: "Barbarian", source: "SRD", level: 3 }],
    background: { name: "Acolyte", source: "SRD" },
    originFeats: [{ level: 1, type: "feat", featName: "Grappler", featSource: "SRD" }],
    knownSpells: [{ name: "Detect Magic", source: "SRD", ownerKey: "Cleric__SRD" }],
  });
  assert.deepEqual(checkActiveBooksIntegrity(srdHero, DEFAULT_ACTIVE_BOOK_CODES), []);

  const disabledRace = makeChar({ race: { name: "Sample Folk", source: "MM" } });
  assert.ok(
    checkActiveBooksIntegrity(disabledRace, DEFAULT_ACTIVE_BOOK_CODES).some((w) => w.includes("Sample Folk") && w.includes("MM")),
    "a race of a book that is switched off still warns"
  );
});


