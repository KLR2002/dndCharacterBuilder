import test from "node:test";
import assert from "node:assert/strict";
import { reconcile, reconcileForActiveBooks } from "../src/rules/characterReconciler.ts";
import type { BackgroundData, ClassData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, loadTestCatalog, makeChar } from "./testUtils.ts";

const classes = loadTestCatalog<ClassData[]>("classes");

// Invented background from a sourcebook that can be disabled. Its skill is granted by this book alone.
const TST_BOOK = "TST";
const SMUGGLER: BackgroundData = {
  name: "Test Smuggler",
  source: TST_BOOK,
  skillProficiencies: ["Investigation"],
  toolProficiencies: [],
  languages: [],
  startingEquipment: [],
  feature: null,
  characteristics: {},
  description: "",
};

// The integrated bundle makes the books scope the listings. The Rogue is PHB, the background is TST.
const catalog = () => inMemoryCompendium({ classes, backgrounds: [SMUGGLER] }, { integrated: true });
const PHB_ONLY = ["PHB"];
const PHB_AND_TST = ["PHB", TST_BOOK];

const smugglerRogue = (overrides: Parameters<typeof makeChar>[0] = {}) =>
  makeChar({
    background: { name: SMUGGLER.name, source: TST_BOOK },
    classes: [{ className: "Rogue", level: 1, source: "PHB" }],
    chosenSkills: ["Stealth"],
    chosenExpertise: ["Investigation", "Stealth"],
    ...overrides,
  });

test("a skill only a disabled book grants loses its Expertise mark, with a review notice", () => {
  const pruned = reconcile(smugglerRogue(), catalog(), { activeBooks: PHB_ONLY });
  assert.deepEqual(pruned.chosenExpertise, ["Stealth"]);
  assert.deepEqual(pruned.needsReview, [
    "Investigation Expertise removed: Investigation is no longer a proficient skill or tool",
  ]);
});

test("a skill whose book is still enabled keeps its Expertise mark", () => {
  const kept = reconcile(smugglerRogue(), catalog(), { activeBooks: PHB_AND_TST });
  assert.deepEqual(kept.chosenExpertise, ["Investigation", "Stealth"]);
  assert.equal(kept.needsReview, undefined);
});

test("without activeBooks the mark is kept, as before the books were scoped", () => {
  const kept = reconcile(smugglerRogue(), catalog());
  assert.deepEqual(kept.chosenExpertise, ["Investigation", "Stealth"]);
  assert.equal(kept.needsReview, undefined);
});

test("re-enabling the book does not bring the removed mark back", () => {
  const removed = reconcileForActiveBooks(smugglerRogue(), catalog(), PHB_ONLY);
  const reenabled = reconcileForActiveBooks(removed, catalog(), PHB_AND_TST);
  assert.deepEqual(reenabled.chosenExpertise, ["Stealth"]);
  assert.deepEqual(reenabled.needsReview, removed.needsReview, "no second notice either");
});

test("reconciling twice with the same books gives the same character", () => {
  const once = reconcileForActiveBooks(smugglerRogue(), catalog(), PHB_ONLY);
  const twice = reconcileForActiveBooks(once, catalog(), PHB_ONLY);
  assert.strictEqual(twice, once);
});

test("a skill an active source also grants keeps its mark when the book is disabled", () => {
  // The character also picked Investigation from an active source, so the sheet still holds it.
  const char = smugglerRogue({
    chosenSkills: ["Investigation", "Stealth"],
    chosenExpertise: ["Investigation"],
  });
  const pruned = reconcile(char, catalog(), { activeBooks: PHB_ONLY });
  assert.deepEqual(pruned.chosenExpertise, ["Investigation"]);
  assert.equal(pruned.needsReview, undefined);
});

test("reconcileForActiveBooks removes the same mark as reconcile with activeBooks", () => {
  const viaOption = reconcile(smugglerRogue(), catalog(), { activeBooks: PHB_ONLY });
  const viaFunction = reconcileForActiveBooks(smugglerRogue(), catalog(), PHB_ONLY);
  assert.deepEqual(viaFunction, viaOption);
  assert.deepEqual(viaFunction.chosenExpertise, ["Stealth"]);
});
