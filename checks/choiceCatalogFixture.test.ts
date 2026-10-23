import test from "node:test";
import assert from "node:assert/strict";
import { createCompendium } from "../src/services/compendium.ts";
import { choiceCatalogBundle } from "./choiceCatalogFixture.ts";

// The fixture catalog is invented placeholder text with the real structure. Later tests build on it.

test("the fixture catalog's Totem Warrior features carry choices at levels 3, 6 and 14", () => {
  const compendium = createCompendium(choiceCatalogBundle());
  const totem = compendium
    .for(["PHB", "SCAG"])
    .classes()
    .find((c) => c.name === "Barbarian")
    ?.subclasses.find((sc) => sc.shortName === "Totem Warrior");
  assert.ok(totem, "the Totem Warrior subclass is in the catalog");

  for (const [name, level] of [
    ["Totem Spirit", 3],
    ["Aspect of the Beast", 6],
    ["Totemic Attunement", 14],
  ] as const) {
    const feature = totem.features.find((f) => f.name === name && f.level === level);
    assert.ok(feature?.choices, `${name} at ${level} carries choices`);
    assert.equal(feature.choices.pick, 1);
    assert.deepEqual(
      feature.choices.options?.map((o) => o.name),
      ["Bear", "Eagle", "Wolf", "Elk", "Tiger"],
    );
  }
});

test("the fixture's Elk and Tiger are SCAG options and the rest are PHB", () => {
  const compendium = createCompendium(choiceCatalogBundle());
  const totem = compendium
    .for(["PHB", "SCAG"])
    .classes()
    .find((c) => c.name === "Barbarian")
    ?.subclasses.find((sc) => sc.shortName === "Totem Warrior");
  const spirit = totem?.features.find((f) => f.name === "Totem Spirit");
  assert.deepEqual(
    spirit?.choices?.options?.map((o) => [o.name, o.source]),
    [["Bear", "PHB"], ["Eagle", "PHB"], ["Wolf", "PHB"], ["Elk", "SCAG"], ["Tiger", "SCAG"]],
  );
  assert.equal(spirit?.choices?.options?.[0].description, "Placeholder text for Bear at level 3.");
});
