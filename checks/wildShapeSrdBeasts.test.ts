import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACTIVE_BOOK_CODES } from "../src/constants/books.ts";
import { isBeastEligible } from "../src/rules/wildShape.ts";
import type { Character } from "../src/types/character.ts";
import { integratedTestCompendium, makeChar, srdBaselineCompendium } from "./testUtils.ts";

// The Compendium decides which beasts exist (for the active books). Wild Shape only applies its own rules on top.
// The SRD Baseline has no Monster Manual, so the default Active Books never contain "SRD": eligibility must not re-gate by book.
function eligibleFor(character: Character) {
  const beasts = srdBaselineCompendium().for(DEFAULT_ACTIVE_BOOK_CODES).beasts();
  return beasts.filter((b) => isBeastEligible(b, character));
}

const ELEMENTALS = ["Air Elemental", "Earth Elemental", "Fire Elemental", "Water Elemental"];

test("wildShapeSrdBeasts: SRD Baseline gives a level 4 Druid a non-empty beast list", () => {
  const druid4 = makeChar({ classes: [{ className: "Druid", source: "PHB", level: 4 }] });
  const eligible = eligibleFor(druid4);
  const names = eligible.map((b) => b.name);

  assert.ok(eligible.length > 0, "level 4 Druid must have Wild Shape forms in SRD mode");
  assert.ok(names.includes("Black Bear"), "CR 1/2 beast must be eligible at level 4");
  assert.ok(names.includes("Ape"), "CR 1/2 beast must be eligible at level 4");
  assert.ok(names.includes("Wolf"), "CR 1/4 beast must be eligible at level 4");
  assert.ok(!names.includes("Brown Bear"), "CR 1 beast must stay locked below level 8");
  assert.ok(eligible.every((b) => b.crNumeric <= 0.5), "standard Druid level 4 is capped at CR 1/2");
  for (const elemental of ELEMENTALS) {
    assert.ok(!names.includes(elemental), `${elemental} must be locked for a non-Moon Druid`);
  }
});

test("wildShapeSrdBeasts: SRD Baseline level 2 Druid gets only CR 1/4 beasts without swim or fly", () => {
  const druid2 = makeChar({ classes: [{ className: "Druid", source: "PHB", level: 2 }] });
  const eligible = eligibleFor(druid2);
  const names = eligible.map((b) => b.name);

  assert.ok(names.includes("Wolf"), "CR 1/4 beast must be eligible at level 2");
  assert.ok(!names.includes("Black Bear"), "CR 1/2 beast must be locked at level 2");
  assert.ok(eligible.every((b) => b.crNumeric <= 0.25), "level 2 Druid is capped at CR 1/4");
  assert.ok(
    eligible.every((b) => !(b.speed?.swim && b.speed.swim > 0) && !(b.speed?.fly && b.speed.fly > 0)),
    "level 2 Druid cannot take swim or fly forms",
  );
});

test("wildShapeSrdBeasts: SRD Baseline Moon Druid level 10 gets the elementals", () => {
  const moon10 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 10, subclassName: "Circle of the Moon" }],
  });
  const names = eligibleFor(moon10).map((b) => b.name);

  for (const elemental of ELEMENTALS) {
    assert.ok(names.includes(elemental), `${elemental} must be eligible for a Moon Druid at level 10`);
  }
});

test("wildShapeSrdBeasts: a Fighter gets no Wild Shape forms", () => {
  const fighter = makeChar({ classes: [{ className: "Fighter", source: "PHB", level: 5 }] });
  assert.deepEqual(eligibleFor(fighter), []);
});

test("wildShapeSrdBeasts: the Compendium hides beasts from inactive books, Wild Shape does not re-gate", () => {
  const compendium = integratedTestCompendium();

  const withoutMm = compendium.for(["PHB"]).beasts();
  assert.ok(withoutMm.every((b) => b.source !== "MM"), "MM beasts must be hidden when MM is not active");

  const withMm = compendium.for(["PHB", "MM"]).beasts();
  assert.ok(withMm.some((b) => b.name === "Wolf" && b.source === "MM"), "MM beasts appear once MM is active");
});
