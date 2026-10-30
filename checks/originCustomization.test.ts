import { ALL_BOOKS, ORIGIN_CUSTOMIZATION_BOOK } from "../src/constants/books.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, inMemoryCompendium, srdBaselineCompendium } from "./testUtils.ts";
import { applyAncestrySelection } from "../src/rules/ancestryEngine.ts";
import { changeRace, setChoiceRacialBonus, setLanguageSwap, setOriginAbilitySwap, setProficiencySwap } from "../src/rules/builderTransitions.ts";
import { effectiveScores } from "../src/rules/abilities.ts";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import { originAbilityTargets, originCustomizationAvailable, originCustomizationView } from "../src/rules/originCustomization.ts";
import { languageSwapViews, originCardHasRows, proficiencySheet, proficiencySwapViews } from "../src/rules/proficiencySheet.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import type { Character } from "../src/types/character.ts";
import type { OriginRuleRecord , ProficiencyGrant, RaceData, SubraceData } from "../src/types/dnd5e.ts";

// Origin Customization: the ability increases of a held race or subrace move, the Ability swap table
// lives in the Catalog, and TCE gates the whole rule. Every race, subrace and rule row here is invented.

const SOURCE = "TST";
const ACTIVE = [SOURCE, ORIGIN_CUSTOMIZATION_BOOK];
const WITHOUT_TCE = [SOURCE];

const DWARF = "Sample Dwarf";
const HILL = "Sample Hill";
const TWO_SLOT = "Sample Two Slot";
const HALF = "Sample Half";
const EVEN = "Sample Even";
const PLAIN = "Sample Plain";
const UNLIFTED = "Sample Unlifted";

const subrace = (name: string, abilityScoreIncrease: Record<string, number>[]): SubraceData => ({
  name,
  source: SOURCE,
  raceName: DWARF,
  raceSource: SOURCE,
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  description: "Placeholder description for the subrace.",
});

const race = (name: string, abilityScoreIncrease: Record<string, number>[], subraces: SubraceData[] = []): RaceData => ({
  name,
  source: SOURCE,
  size: ["Medium"],
  speed: { walk: 30 },
  abilityScoreIncrease,
  darkvision: null,
  traits: [],
  languages: ["Common"],
  subraces,
  description: "Placeholder description for the race.",
});

const records: RaceData[] = [
  race(DWARF, [{ con: 2 }], [subrace(HILL, [{ wis: 1 }])]),
  race(TWO_SLOT, [{ str: 2, cha: 1 }]),
  race(HALF, [{ cha: 2 }]),
  race(EVEN, [{ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }]),
  race(PLAIN, []),
  {
    ...race(UNLIFTED, []),
    grants: [
      { id: `${SOURCE}/Race/${UNLIFTED}@0#languages:fixed:Common`, kind: "fixed", category: "languages", names: ["Common"] },
      { id: `${SOURCE}/Race/${UNLIFTED}@0#skills:fixed:Perception`, kind: "fixed", category: "skills", names: ["Perception"] },
    ] satisfies ProficiencyGrant[],
  },
];

const rule: OriginRuleRecord = {
  name: "Sample Origin Customization",
  source: ORIGIN_CUSTOMIZATION_BOOK,
  proficiencySwaps: [{ from: "skill", to: ["skill"] }],
};

const compendium = inMemoryCompendium({ races: records, originRules: [rule] }, { integrated: true });
const catalogs = { compendium, activeBooks: ACTIVE };

/** A character holding the named race (and subrace), with its ability increases applied by the ancestry transition. */
function holding(name: string, subraceName?: string, overrides: Partial<Character> = {}): Character {
  const raceRecord = records.find((r) => r.name === name)!;
  const subraceRecord = subraceName ? raceRecord.subraces.find((s) => s.name === subraceName) : undefined;
  return applyAncestrySelection(makeChar(overrides), raceRecord, subraceRecord, catalogs);
}

/** The view slot whose race ability increase names the given default ability. */
function slotDefaulting(character: Character, ability: string) {
  const slot = originCustomizationView(character, catalogs)!.abilitySlots.find((s) => s.defaultAbility === ability);
  assert.ok(slot, `a slot defaults to ${ability}`);
  return slot;
}

test("the rule is offered only with TCE active, rule rows in the Catalog, and a held race", () => {
  assert.equal(originCustomizationAvailable(holding(DWARF), catalogs), true);
  assert.equal(originCustomizationAvailable(holding(DWARF), { compendium, activeBooks: ALL_BOOKS }), true);
  assert.equal(originCustomizationAvailable(holding(DWARF), { compendium, activeBooks: WITHOUT_TCE }), false);

  const noRows = inMemoryCompendium({ races: records, originRules: [] }, { integrated: true });
  assert.equal(originCustomizationAvailable(holding(DWARF), { compendium: noRows, activeBooks: ACTIVE }), false);

  assert.equal(originCustomizationAvailable(holding(PLAIN), catalogs), true);
  assert.equal(originCustomizationAvailable(makeChar(), catalogs), false);
});

test("a race with no ability increase still offers its language and skill swaps, and no ability slots", () => {
  const unlifted = holding(UNLIFTED);
  assert.equal(originCustomizationAvailable(unlifted, catalogs), true);
  assert.deepEqual(originCustomizationView(unlifted, catalogs), { abilitySlots: [] });
  assert.deepEqual(languageSwapViews(unlifted, catalogs).map((row) => row.original), ["Common"]);
  assert.deepEqual(proficiencySwapViews(unlifted, catalogs).map((row) => row.original), ["Perception"]);

  const [language] = languageSwapViews(unlifted, catalogs);
  const withLanguage = setLanguageSwap(unlifted, language.id, "Dwarvish", catalogs);
  assert.ok(proficiencySheet(withLanguage, catalogs).languages.map((entry) => entry.name).includes("Dwarvish"));

  const [skill] = proficiencySwapViews(withLanguage, catalogs);
  const withSkill = setProficiencySwap(withLanguage, skill.id, "Insight", catalogs);
  assert.ok(proficiencySheet(withSkill, catalogs).skills.map((entry) => entry.name).includes("Insight"));

  assert.equal(setOriginAbilitySwap(withSkill, "unknown-slot", "dex", catalogs), withSkill);
  assert.deepEqual(withSkill.racialAbilityBonuses, unlifted.racialAbilityBonuses);
});

test("with TCE off or no race held, a race with no ability increase offers no swap of any kind", () => {
  const unlifted = holding(UNLIFTED);
  assert.equal(originCustomizationAvailable(unlifted, { compendium, activeBooks: WITHOUT_TCE }), false);
  assert.deepEqual(languageSwapViews(unlifted, { compendium, activeBooks: WITHOUT_TCE }), []);
  assert.deepEqual(proficiencySwapViews(unlifted, { compendium, activeBooks: WITHOUT_TCE }), []);
  assert.equal(originCustomizationView(unlifted, { compendium, activeBooks: WITHOUT_TCE }), undefined);

  assert.equal(originCustomizationAvailable(makeChar(), catalogs), false);
  assert.equal(originCustomizationView(makeChar(), catalogs), undefined);
  assert.deepEqual(languageSwapViews(makeChar(), catalogs), []);
});

test("the card has rows when it has an ability slot, a language row or a proficiency row, and none otherwise", () => {
  const unlifted = holding(UNLIFTED);
  assert.equal(
    originCardHasRows(originCustomizationView(unlifted, catalogs), languageSwapViews(unlifted, catalogs), proficiencySwapViews(unlifted, catalogs)),
    true,
  );
  assert.equal(originCardHasRows(undefined, [], []), false);
  assert.equal(originCardHasRows({ abilitySlots: [] }, [], []), false);
  assert.equal(originCardHasRows(originCustomizationView(holding(DWARF), catalogs), [], []), true);
});

test("the SRD Baseline never offers the rule", () => {
  const srdChar = makeChar({ race: { name: "Dwarf", source: "SRD" }, racialAbilityBonuses: { con: 2 } });
  assert.equal(originCustomizationAvailable(srdChar, { compendium: srdBaselineCompendium(), activeBooks: ALL_BOOKS }), false);
});

test("the card lists each increase of a single-entry race with its amount and default target", () => {
  const view = originCustomizationView(holding(TWO_SLOT), catalogs)!;
  assert.deepEqual(
    view.abilitySlots.map(({ defaultAbility, amount, target }) => ({ defaultAbility, amount, target })),
    [
      { defaultAbility: "str", amount: 2, target: "str" },
      { defaultAbility: "cha", amount: 1, target: "cha" },
    ],
  );
});

test("a fixed increase moves to another ability and effective scores show the move", () => {
  const dwarf = holding(DWARF);
  const slot = slotDefaulting(dwarf, "con");
  const moved = setOriginAbilitySwap(dwarf, slot.id, "dex", catalogs);

  assert.deepEqual(moved.originAbilitySwaps, { [slot.id]: "dex" });
  const scores = effectiveScores(moved).scores;
  assert.equal(scores.dex, 12);
  assert.equal(scores.con, 10);
});

test("a two-increase race moves one increase and keeps the other on its ability", () => {
  const moved = setOriginAbilitySwap(holding(TWO_SLOT), slotDefaulting(holding(TWO_SLOT), "str").id, "int", catalogs);
  const scores = effectiveScores(moved).scores;
  assert.equal(scores.int, 12);
  assert.equal(scores.str, 10);
  assert.equal(scores.cha, 11);
});

test("a fixed increase beside chosen picks moves while the picks stay where they are", () => {
  const half = setChoiceRacialBonus(holding(HALF), [
    { key: "dex", amount: 1 },
    { key: "con", amount: 1 },
  ]);
  const withPicks = reconcile(half, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(withPicks.racialAbilityBonuses, { cha: 2, dex: 1, con: 1 });

  const moved = setOriginAbilitySwap(withPicks, slotDefaulting(withPicks, "cha").id, "wis", catalogs);
  assert.deepEqual(moved.racialAbilityBonuses, { wis: 2, dex: 1, con: 1 });
  assert.deepEqual(moved.racialChoiceBonus, [
    { key: "dex", amount: 1 },
    { key: "con", amount: 1 },
  ]);
});

test("a target already taken by a chosen pick is blocked", () => {
  const withPicks = reconcile(
    setChoiceRacialBonus(holding(HALF), [
      { key: "dex", amount: 1 },
      { key: "con", amount: 1 },
    ]),
    compendium,
    { activeBooks: ACTIVE },
  );
  const cha = slotDefaulting(withPicks, "cha");
  assert.ok(cha.blocked.includes("dex"), "the view blocks the picked ability");
  assert.equal(setOriginAbilitySwap(withPicks, cha.id, "dex", catalogs), withPicks);
});

test("a target another increase already lands on is blocked", () => {
  const twoSlot = holding(TWO_SLOT);
  const str = slotDefaulting(twoSlot, "str");
  assert.ok(str.blocked.includes("cha"), "the view blocks the other increase's ability");
  assert.equal(setOriginAbilitySwap(twoSlot, str.id, "cha", catalogs), twoSlot);
});

test("a target whose base score plus the increase exceeds 20 is blocked, and 20 exactly is allowed", () => {
  const withDex = (dex: number) =>
    holding(DWARF, undefined, {
      baseAbilityScores: { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 },
    });

  const capped = withDex(19);
  const cappedSlot = slotDefaulting(capped, "con");
  assert.ok(cappedSlot.blocked.includes("dex"));
  assert.equal(setOriginAbilitySwap(capped, cappedSlot.id, "dex", catalogs), capped);

  const atCap = withDex(18);
  const moved = setOriginAbilitySwap(atCap, slotDefaulting(atCap, "con").id, "dex", catalogs);
  assert.equal(effectiveScores(moved).scores.dex, 20);
});

test("a race whose increases already cover all six abilities offers no ability part", () => {
  const even = holding(EVEN);
  assert.equal(originCustomizationAvailable(even, catalogs), true);
  assert.deepEqual(originCustomizationView(even, catalogs)?.abilitySlots, []);
  assert.equal(setOriginAbilitySwap(even, "unknown-slot", "dex", catalogs), even);
});

test("with TCE off the saved swap is kept and effective scores equal the race's own increases", () => {
  const moved = setOriginAbilitySwap(holding(DWARF), slotDefaulting(holding(DWARF), "con").id, "dex", catalogs);
  const off = reconcileForActiveBooks(moved, compendium, WITHOUT_TCE);

  assert.deepEqual(off.originAbilitySwaps, moved.originAbilitySwaps);
  assert.deepEqual(off.racialAbilityBonuses, { con: 2 });
  const scores = effectiveScores(off).scores;
  assert.equal(scores.con, 12);
  assert.equal(scores.dex, 10);

  const back = reconcileForActiveBooks(off, compendium, ACTIVE);
  assert.deepEqual(back.racialAbilityBonuses, { dex: 2 });
});

test("a race change releases the saved swaps with a notice", () => {
  const moved = setOriginAbilitySwap(holding(DWARF), slotDefaulting(holding(DWARF), "con").id, "dex", catalogs);
  const changed = changeRace(moved, compendium, ACTIVE);

  assert.equal(changed.originAbilitySwaps, undefined);
  assert.deepEqual(changed.needsReview, ["Ability swap to Dexterity removed: ancestry no longer grants it"]);
});

test("a change to another race with the same increase ability releases the swap too", () => {
  const moved = setOriginAbilitySwap(holding(DWARF), slotDefaulting(holding(DWARF), "con").id, "dex", catalogs);
  const other = applyAncestrySelection(moved, records.find((r) => r.name === PLAIN)!, undefined, catalogs);

  assert.equal(other.originAbilitySwaps, undefined);
  assert.equal(other.needsReview?.length, 1);
});

test("a swap equal to the race's own increase is not stored", () => {
  const dwarf = holding(DWARF);
  const slot = slotDefaulting(dwarf, "con");
  const moved = setOriginAbilitySwap(dwarf, slot.id, "dex", catalogs);
  const restored = setOriginAbilitySwap(moved, slot.id, "con", catalogs);

  assert.equal(restored.originAbilitySwaps, undefined);
  assert.deepEqual(restored.racialAbilityBonuses, { con: 2 });
});

test("reconciling a swapped character again changes nothing", () => {
  const moved = setOriginAbilitySwap(holding(DWARF), slotDefaulting(holding(DWARF), "con").id, "dex", catalogs);
  const once = reconcile(moved, compendium, { activeBooks: ACTIVE });
  const twice = reconcile(once, compendium, { activeBooks: ACTIVE });

  assert.deepEqual(twice, once);
  assert.equal(reconcileForActiveBooks(once, compendium, ACTIVE), once);
});

test("a save made before the swap field existed loads and reconciles unchanged", () => {
  const saved = holding(DWARF);
  const { originAbilitySwaps: _absent, ...older } = saved;
  const loaded = migrateCharacter(older, undefined, [], ACTIVE);

  assert.equal(loaded.originAbilitySwaps, undefined);
  assert.deepEqual(reconcileForActiveBooks(loaded, compendium, ACTIVE), loaded);
});

test("no swap is applied without the rule, and the transition leaves the character as it is", () => {
  const dwarf = holding(DWARF);
  const slot = slotDefaulting(dwarf, "con");
  assert.equal(setOriginAbilitySwap(dwarf, slot.id, "dex", { compendium, activeBooks: WITHOUT_TCE }), dwarf);
});

test("a held race keeps its own increases when its book is off, though a same-named race of an active book exists", () => {
  const TWIN = "Sample Twin";
  const OTHER_BOOK = "TST2";
  const twins: RaceData[] = [
    { ...race(TWIN, [{ dex: 1 }]), source: SOURCE },
    { ...race(TWIN, [{ cha: 2 }]), source: OTHER_BOOK },
  ];
  const twinCatalog = inMemoryCompendium({ races: twins }, { integrated: true });
  const held = applyAncestrySelection(makeChar(), twins[1], undefined, { compendium: twinCatalog, activeBooks: ALL_BOOKS });
  assert.deepEqual(held.racialAbilityBonuses, { cha: 2 });

  const off = reconcileForActiveBooks(held, twinCatalog, [SOURCE]);
  assert.deepEqual(off.racialAbilityBonuses, { cha: 2 });
  assert.equal(off.needsReview, undefined);
});

test("a slot moves back to its own default when another slot holds that default too", () => {
  const IMP = "Sample Imp";
  const IMP_KIN = "Sample Imp Kin";
  const imp = race(IMP, [{ cha: 2 }], [{ ...subrace(IMP_KIN, [{ cha: 1 }]), raceName: IMP }]);
  const impCatalog = inMemoryCompendium({ races: [imp], originRules: [rule] }, { integrated: true });
  const impCatalogs = { compendium: impCatalog, activeBooks: ACTIVE };
  const held = applyAncestrySelection(makeChar(), imp, imp.subraces[0], impCatalogs);

  const [raceSlot] = originCustomizationView(held, impCatalogs)!.abilitySlots;
  const moved = setOriginAbilitySwap(held, raceSlot.id, "str", impCatalogs);
  assert.deepEqual(moved.originAbilitySwaps, { [raceSlot.id]: "str" });

  const back = setOriginAbilitySwap(moved, raceSlot.id, "cha", impCatalogs);
  assert.equal(back.originAbilitySwaps, undefined);
  assert.deepEqual(back.racialAbilityBonuses, { cha: 3 });
});

test("a slot may not return to its default while another slot has swapped onto that ability", () => {
  const dwarf = holding(DWARF, HILL);
  const conSlot = slotDefaulting(dwarf, "con");
  const wisSlot = slotDefaulting(dwarf, "wis");
  const moved = setOriginAbilitySwap(dwarf, conSlot.id, "cha", catalogs);
  const both = setOriginAbilitySwap(moved, wisSlot.id, "con", catalogs);
  assert.deepEqual(both.originAbilitySwaps, { [conSlot.id]: "cha", [wisSlot.id]: "con" });

  const conView = slotDefaulting(both, "con");
  assert.ok(conView.blocked.includes("con"), "the view blocks the CON slot's return while the WIS slot holds CON");

  const back = setOriginAbilitySwap(both, conSlot.id, "con", catalogs);
  assert.equal(back, both, "the transition leaves the character unchanged");
  assert.deepEqual(back.originAbilitySwaps, { [conSlot.id]: "cha", [wisSlot.id]: "con" });
  assert.equal(back.needsReview, undefined, "no notice is added");
});

test("two saved swaps sharing one target are both dropped, each with a notice, and reconcile terminates", () => {
  const dwarf = holding(DWARF, HILL);
  const conSlot = slotDefaulting(dwarf, "con");
  const wisSlot = slotDefaulting(dwarf, "wis");
  const edited: Character = { ...dwarf, originAbilitySwaps: { [conSlot.id]: "dex", [wisSlot.id]: "dex" } };

  const reconciled = reconcile(edited, compendium, { activeBooks: ACTIVE });
  assert.equal(reconciled.originAbilitySwaps, undefined);
  assert.deepEqual(reconciled.needsReview, ["Ability swap to Dexterity removed: another increase already uses it"]);
  assert.equal(reconciled.racialAbilityBonuses?.dex, undefined);
  assert.deepEqual(reconciled.racialAbilityBonuses, { con: 2, wis: 1 });
});

test("a swap dropped by collision returns its slot's default, which then collides with a later swap, and reconcile terminates", () => {
  const dwarf = holding(DWARF, HILL);
  const conSlot = slotDefaulting(dwarf, "con");
  const wisSlot = slotDefaulting(dwarf, "wis");
  const edited: Character = {
    ...dwarf,
    racialChoiceBonus: [{ key: "dex", amount: 1 }],
    originAbilitySwaps: { [conSlot.id]: "dex", [wisSlot.id]: "con" },
  };

  const reconciled = reconcile(edited, compendium, { activeBooks: ACTIVE });
  assert.equal(reconciled.originAbilitySwaps, undefined);
  assert.deepEqual(reconciled.needsReview, [
    "Ability swap to Dexterity removed: another increase already uses it",
    "Ability swap to Constitution removed: another increase already uses it",
  ]);
  assert.deepEqual(reconciled.racialAbilityBonuses, { con: 2, wis: 1, dex: 1 });
});

test("a slot whose base score is 19 or more moves away and back to its own default", () => {
  const capped = holding(DWARF, undefined, { baseAbilityScores: { str: 10, dex: 10, con: 19, int: 10, wis: 10, cha: 10 } });
  const away = setOriginAbilitySwap(capped, slotDefaulting(capped, "con").id, "dex", catalogs);
  assert.equal(effectiveScores(away).scores.dex, 12);

  const back = setOriginAbilitySwap(away, slotDefaulting(away, "con").id, "con", catalogs);
  assert.equal(back.originAbilitySwaps, undefined);
  assert.equal(effectiveScores(back).scores.con, 21);
});

test("a race increase swapped onto the score a new subrace increase lands on is dropped with a notice", () => {
  const STRONG = "Sample Strong";
  const STRONG_KIN = "Sample Strong Kin";
  const strong = race(STRONG, [{ con: 2 }], [{ ...subrace(STRONG_KIN, [{ str: 2 }]), raceName: STRONG }]);
  const strongCatalogs = { compendium: inMemoryCompendium({ races: [strong], originRules: [rule] }, { integrated: true }), activeBooks: ACTIVE };
  const plain = applyAncestrySelection(makeChar(), strong, undefined, strongCatalogs);
  const moved = setOriginAbilitySwap(plain, originCustomizationView(plain, strongCatalogs)!.abilitySlots[0].id, "str", strongCatalogs);
  assert.deepEqual(moved.originAbilitySwaps && Object.values(moved.originAbilitySwaps), ["str"]);

  const changed = applyAncestrySelection(moved, strong, strong.subraces[0], strongCatalogs);

  assert.equal(changed.originAbilitySwaps, undefined);
  assert.deepEqual(changed.racialAbilityBonuses, { con: 2, str: 2 });
  assert.deepEqual(changed.needsReview, ["Ability swap to Strength removed: another increase already uses it"]);
});

test("a subrace increase is swapped like a race increase, and changing the subrace releases its swap with a notice", () => {
  const STRONG = "Sample Strong";
  const STRONG_KIN = "Sample Strong Kin";
  const strong = race(STRONG, [{ con: 2 }], [{ ...subrace(STRONG_KIN, [{ str: 2 }]), raceName: STRONG }]);
  const strongCatalogs = { compendium: inMemoryCompendium({ races: [strong], originRules: [rule] }, { integrated: true }), activeBooks: ACTIVE };
  const held = applyAncestrySelection(makeChar(), strong, strong.subraces[0], strongCatalogs);
  const subSlot = originCustomizationView(held, strongCatalogs)!.abilitySlots.find((slot) => slot.id.startsWith("subrace|"))!;
  assert.equal(subSlot.defaultAbility, "str");

  const moved = setOriginAbilitySwap(held, subSlot.id, "dex", strongCatalogs);
  assert.deepEqual(moved.racialAbilityBonuses, { con: 2, dex: 2 });
  assert.equal(setOriginAbilitySwap(held, subSlot.id, "con", strongCatalogs), held, "a race increase's ability is taken");

  const unsubraced = applyAncestrySelection(moved, strong, undefined, strongCatalogs);
  assert.equal(unsubraced.originAbilitySwaps, undefined);
  assert.deepEqual(unsubraced.racialAbilityBonuses, { con: 2 });
  assert.deepEqual(unsubraced.needsReview, ["Ability swap to Dexterity removed: ancestry no longer grants it"]);
});

test("a Choice ASI pick may not take an ability an Origin Customization increase lands on, while the rule is available", () => {
  const half = holding(HALF);
  assert.deepEqual(originAbilityTargets(half, catalogs), ["cha"]);

  const moved = setOriginAbilitySwap(half, slotDefaulting(half, "cha").id, "str", catalogs);
  assert.deepEqual(originAbilityTargets(moved, catalogs), ["str"]);
  assert.deepEqual(originAbilityTargets(half, { compendium, activeBooks: WITHOUT_TCE }), []);
  assert.deepEqual(originAbilityTargets(holding(PLAIN), catalogs), []);
});

test("a held race missing from the catalog keeps its saved ability swap until the race is found again", () => {
  const dwarf = holding(DWARF);
  const moved = setOriginAbilitySwap(dwarf, slotDefaulting(dwarf, "con").id, "dex", catalogs);
  const withoutDwarf = inMemoryCompendium({ races: records.filter((r) => r.name !== DWARF), originRules: [rule] }, { integrated: true });

  const absent = reconcile(moved, withoutDwarf, { activeBooks: ACTIVE });
  assert.deepEqual(absent, moved);

  const back = reconcile(absent, compendium, { activeBooks: ACTIVE });
  assert.deepEqual(back.originAbilitySwaps, moved.originAbilitySwaps);
  assert.deepEqual(back.racialAbilityBonuses, { dex: 2 });
});
