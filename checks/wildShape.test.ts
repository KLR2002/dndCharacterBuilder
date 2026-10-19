import { test } from "node:test";
import assert from "node:assert/strict";
import { makeChar, loadTestCatalog } from "./testUtils.ts";
import {
  getWildShapeLimits,
  isBeastEligible,
  getBeastFilterReason,
  getWildShapeCharges,
  getRequiredWildShapeCharges,
} from "../src/rules/wildShape.ts";
import type { BeastData } from "../src/types/dnd5e.ts";

test("wildShape: non-druids and druid level 1 do not have Wild Shape", () => {
  const fighter = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 5 }],
  });
  const limitsFighter = getWildShapeLimits(fighter);
  assert.equal(limitsFighter.hasWildShape, false);
  assert.equal(limitsFighter.druidLevel, 0);

  const druid1 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 1 }],
  });
  const limitsDruid1 = getWildShapeLimits(druid1);
  assert.equal(limitsDruid1.hasWildShape, false);
  assert.equal(limitsDruid1.druidLevel, 1);
});

test("wildShape: standard Druid CR and movement scaling across levels", () => {
  // Level 2 standard druid: Max CR 1/4, no swim, no fly, duration 1 hr
  const druid2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Land" }],
  });
  const lim2 = getWildShapeLimits(druid2);
  assert.equal(lim2.hasWildShape, true);
  assert.equal(lim2.druidLevel, 2);
  assert.equal(lim2.isMoonDruid, false);
  assert.equal(lim2.maxCr, 0.25);
  assert.equal(lim2.maxCrDisplay, "1/4");
  assert.equal(lim2.canSwim, false);
  assert.equal(lim2.canFly, false);
  assert.equal(lim2.maxDurationHours, 1);
  assert.equal(lim2.canElemental, false);

  // Level 4 standard druid: Max CR 1/2, swim allowed, no fly, duration 2 hrs
  const druid4 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 4, subclassName: "Circle of the Land" }],
  });
  const lim4 = getWildShapeLimits(druid4);
  assert.equal(lim4.maxCr, 0.5);
  assert.equal(lim4.maxCrDisplay, "1/2");
  assert.equal(lim4.canSwim, true);
  assert.equal(lim4.canFly, false);
  assert.equal(lim4.maxDurationHours, 2);

  // Level 8 standard druid: Max CR 1, swim allowed, fly allowed, duration 4 hrs
  const druid8 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 8, subclassName: "Circle of the Land" }],
  });
  const lim8 = getWildShapeLimits(druid8);
  assert.equal(lim8.maxCr, 1.0);
  assert.equal(lim8.maxCrDisplay, "1");
  assert.equal(lim8.canSwim, true);
  assert.equal(lim8.canFly, true);
  assert.equal(lim8.maxDurationHours, 4);
  assert.equal(lim8.canElemental, false);
});

test("wildShape: Circle of the Moon scaling across levels and Elemental Wild Shape", () => {
  // Level 2 Moon druid: Max CR 1, no swim, no fly, duration 1 hr
  const moon2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Moon" }],
  });
  const lim2 = getWildShapeLimits(moon2);
  assert.equal(lim2.hasWildShape, true);
  assert.equal(lim2.isMoonDruid, true);
  assert.equal(lim2.maxCr, 1.0);
  assert.equal(lim2.maxCrDisplay, "1");
  assert.equal(lim2.canSwim, false);
  assert.equal(lim2.canFly, false);
  assert.equal(lim2.canElemental, false);

  // Level 4 Moon druid: Max CR 1, swim allowed, no fly
  const moon4 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 4, subclassName: "Circle of the Moon" }],
  });
  const lim4 = getWildShapeLimits(moon4);
  assert.equal(lim4.maxCr, 1.0);
  assert.equal(lim4.canSwim, true);
  assert.equal(lim4.canFly, false);

  // Level 6 Moon druid: Max CR 2 (floor(6/3)), swim allowed, no fly
  const moon6 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 6, subclassName: "Circle of the Moon" }],
  });
  const lim6 = getWildShapeLimits(moon6);
  assert.equal(lim6.maxCr, 2.0);
  assert.equal(lim6.maxCrDisplay, "2");
  assert.equal(lim6.canSwim, true);
  assert.equal(lim6.canFly, false);

  // Level 8 Moon druid: Max CR 2, fly allowed
  const moon8 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 8, subclassName: "Circle of the Moon" }],
  });
  const lim8 = getWildShapeLimits(moon8);
  assert.equal(lim8.maxCr, 2.0);
  assert.equal(lim8.canFly, true);

  // Level 9 Moon druid: Max CR 3 (floor(9/3))
  const moon9 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 9, subclassName: "Circle of the Moon" }],
  });
  assert.equal(getWildShapeLimits(moon9).maxCr, 3.0);

  // Level 10 Moon druid: Max CR 3, canElemental unlocked
  const moon10 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 10, subclassName: "Circle of the Moon" }],
  });
  const lim10 = getWildShapeLimits(moon10);
  assert.equal(lim10.canElemental, true);
  assert.equal(lim10.maxDurationHours, 5);

  // Level 18 Moon druid: Max CR 6 (floor(18/3))
  const moon18 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 18, subclassName: "Circle of the Moon" }],
  });
  assert.equal(getWildShapeLimits(moon18).maxCr, 6.0);
});

test("wildShape: isBeastEligible accurately checks level, movement speed, and CR", () => {
  const beasts = loadTestCatalog<BeastData[]>("beasts");
  const wolf = beasts.find((b) => b.name === "Wolf" && b.source === "MM")!;
  const giantPoisonousSnake = beasts.find((b) => b.name === "Giant Poisonous Snake" && b.source === "MM")!; // swim 30, CR 1/4
  const giantOwl = beasts.find((b) => b.name === "Giant Owl" && b.source === "MM")!; // fly 60, CR 1/4
  const brownBear = beasts.find((b) => b.name === "Brown Bear" && b.source === "MM")!; // CR 1
  const polarBear = beasts.find((b) => b.name === "Polar Bear" && b.source === "MM")!; // CR 2, swim 30
  const airElemental = beasts.find((b) => b.name === "Air Elemental" && b.source === "MM")!; // CR 5 elemental

  const druid2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2 }],
  });

  // Level 2 standard Druid:
  assert.equal(isBeastEligible(wolf, druid2), true, "Wolf should be eligible for level 2 druid");
  assert.equal(isBeastEligible(giantPoisonousSnake, druid2), false, "Giant Poisonous Snake has swim speed");
  assert.equal(isBeastEligible(giantOwl, druid2), false, "Giant Owl has fly speed");
  assert.equal(isBeastEligible(brownBear, druid2), false, "Brown Bear has CR 1 > 1/4");

  // Level 4 standard Druid:
  const druid4 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 4 }],
  });
  assert.equal(isBeastEligible(giantPoisonousSnake, druid4), true, "Swim allowed at level 4");
  assert.equal(isBeastEligible(giantOwl, druid4), false, "Fly still not allowed at level 4");

  // Level 8 standard Druid:
  const druid8 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 8 }],
  });
  assert.equal(isBeastEligible(giantOwl, druid8), true, "Fly allowed at level 8");
  assert.equal(isBeastEligible(brownBear, druid8), true, "CR 1 allowed at level 8");
  assert.equal(isBeastEligible(polarBear, druid8), false, "CR 2 not allowed for standard druid");

  // Level 2 Moon Druid:
  const moon2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Moon" }],
  });
  assert.equal(isBeastEligible(brownBear, moon2), true, "Brown Bear (CR 1, no fly/swim) allowed for Moon druid 2");
  assert.equal(isBeastEligible(giantPoisonousSnake, moon2), false, "Moon druid 2 still cannot take swim speed");
  assert.equal(isBeastEligible(polarBear, moon2), false, "CR 2 not allowed at level 2");

  // Level 6 Moon Druid:
  const moon6 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 6, subclassName: "Circle of the Moon" }],
  });
  assert.equal(isBeastEligible(polarBear, moon6), true, "Polar Bear (CR 2, swim) allowed for Moon druid 6");

  // Elemental Wild Shape:
  assert.equal(isBeastEligible(airElemental, moon6), false, "Elementals not allowed before level 10");
  const moon10 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 10, subclassName: "Circle of the Moon" }],
  });
  assert.equal(isBeastEligible(airElemental, moon10), true, "Air Elemental allowed for Moon druid 10");
  assert.equal(isBeastEligible(airElemental, druid8), false, "Non-moon druids cannot take elementals");
  // Book scoping is the Compendium's job; see checks/wildShapeSrdBeasts.test.ts.
});

test("wildShape: getBeastFilterReason returns human-readable lock explanations", () => {
  const beasts = loadTestCatalog<BeastData[]>("beasts");
  const giantPoisonousSnake = beasts.find((b) => b.name === "Giant Poisonous Snake" && b.source === "MM")!;
  const giantOwl = beasts.find((b) => b.name === "Giant Owl" && b.source === "MM")!;
  const brownBear = beasts.find((b) => b.name === "Brown Bear" && b.source === "MM")!;
  const polarBear = beasts.find((b) => b.name === "Polar Bear" && b.source === "MM")!;
  const airElemental = beasts.find((b) => b.name === "Air Elemental" && b.source === "MM")!;

  const druid2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2 }],
  });

  assert.equal(getBeastFilterReason(giantPoisonousSnake, druid2), "Requires Druid Level 4 (Swimming Speed)");
  assert.equal(getBeastFilterReason(giantOwl, druid2), "Requires Druid Level 8 (Flying Speed)");
  assert.equal(getBeastFilterReason(brownBear, druid2), "Requires Druid Level 8 (CR 1)");
  assert.equal(getBeastFilterReason(polarBear, druid2), "Requires Circle of the Moon (CR > 1)");
  assert.equal(getBeastFilterReason(airElemental, druid2), "Requires Circle of the Moon (Level 10)");

  const moon2 = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2, subclassName: "Circle of the Moon" }],
  });
  assert.equal(getBeastFilterReason(polarBear, moon2), "Requires Druid Level 6 (CR 2)");
});

test("wildShape: getWildShapeCharges returns default 2 charges for uninitialized druids and respects existing counter", () => {
  const freshDruid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2 }],
  });
  // Uninitialized resourceCounters
  assert.equal(getWildShapeCharges(freshDruid), 2);

  const usedDruid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 2 }],
    resourceCounters: {
      wild_shape: {
        id: "wild_shape",
        name: "Wild Shape",
        current: 1,
        max: 2,
        resetOn: "short",
      },
    },
  });
  assert.equal(getWildShapeCharges(usedDruid), 1);

  const nonDruid = makeChar({
    classes: [{ className: "Fighter", source: "PHB", level: 5 }],
  });
  assert.equal(getWildShapeCharges(nonDruid), 0);

  const archdruid = makeChar({
    classes: [{ className: "Druid", source: "PHB", level: 20 }],
  });
  assert.equal(getWildShapeCharges(archdruid), 999);
});

test("wildShape: getRequiredWildShapeCharges returns 2 for elementals and 1 for beasts", () => {
  const beasts = loadTestCatalog<BeastData[]>("beasts");
  const wolf = beasts.find((b) => b.name === "Wolf" && b.source === "MM")!;
  const airElemental = beasts.find((b) => b.name === "Air Elemental" && b.source === "MM")!;

  assert.equal(getRequiredWildShapeCharges(wolf), 1);
  assert.equal(getRequiredWildShapeCharges(airElemental), 2);
});


