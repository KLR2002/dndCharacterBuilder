import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ALL_BOOKS } from "../src/constants/books.ts";
import { BACKGROUND_FEAT_SOURCE } from "../src/constants/rules.ts";
import { featFeatureRows } from "../src/rules/featFeatures.ts";
import type { FeatData } from "../src/types/dnd5e.ts";
import { inMemoryCompendium, makeChar } from "./testUtils.ts";

// The Features tab's feat rows. Every name and sentence is invented.

function feat(overrides: Partial<FeatData> & { name: string; source: string }): FeatData {
  return {
    prerequisite: null,
    abilityScoreIncrease: null,
    description: `${overrides.name} text.`,
    ...overrides,
  };
}

const compendium = inMemoryCompendium({
  feats: [
    feat({ name: "Sample Gift", source: "TST", description: "Sample gift text." }),
    feat({ name: "Sample Edge", source: "TST", description: "Sample edge text." }),
    feat({ name: "Sample Lineage Feat", source: "TST", description: "Sample lineage text." }),
    feat({ name: "Sample Twin", source: "TST", description: "Sample twin text from TST." }),
    feat({ name: "Sample Twin", source: "TST2", description: "Sample twin text from TST2." }),
    feat({ name: "Sample Bare", source: "TST", description: "" }),
  ],
});

const originFeat = (featName: string, featSource: string, level = 0) => ({ level, type: "feat" as const, featName, featSource });
const asiFeat = (featName: string, featSource: string, level: number) => ({ level, type: "feat" as const, featName, featSource });

describe("featFeatureRows", () => {
  test("a Variant Human's origin feat is listed at level 1 with its book and description, before a level 4 ASI feat", () => {
    const character = makeChar({
      originFeats: [originFeat("Sample Gift", "TST", 1)],
      asiSelections: [asiFeat("Sample Edge", "TST", 4)],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.deepEqual(
      rows.map((row) => [row.name, row.source, row.description]),
      [
        ["Sample Gift (Feat, Lvl 1)", "TST", "Sample gift text."],
        ["Sample Edge (Feat, Lvl 4)", "TST", "Sample edge text."],
      ],
    );
  });

  test("an origin feat saved with level 0 reads level 1", () => {
    const character = makeChar({ originFeats: [originFeat("Sample Gift", "TST", 0)] });
    assert.deepEqual(featFeatureRows(character, compendium, ALL_BOOKS).map((row) => row.name), ["Sample Gift (Feat, Lvl 1)"]);
  });

  test("a Custom Lineage feat is listed", () => {
    const character = makeChar({
      customLineage: true,
      originFeats: [originFeat("Sample Lineage Feat", "TST")],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.deepEqual(rows.map((row) => [row.name, row.description]), [["Sample Lineage Feat (Feat, Lvl 1)", "Sample lineage text."]]);
  });

  test("a background's feat shows the book of its record, choosing the background's book when two share the name", () => {
    const character = makeChar({
      background: { name: "Sample Scholar", source: "TST2" },
      originFeats: [originFeat("Sample Twin", BACKGROUND_FEAT_SOURCE)],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.deepEqual(rows.map((row) => [row.name, row.source, row.description]), [
      ["Sample Twin (Feat, Lvl 1)", "TST2", "Sample twin text from TST2."],
    ]);
  });

  test("a background's feat with no record is still listed, from the background", () => {
    const character = makeChar({
      background: { name: "Sample Scholar", source: "TST" },
      originFeats: [originFeat("Sample Unknown", BACKGROUND_FEAT_SOURCE)],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.deepEqual(rows.map((row) => [row.name, row.source, row.description]), [
      ["Sample Unknown (Feat, Lvl 1)", BACKGROUND_FEAT_SOURCE, "Feat benefits."],
    ]);
  });

  test("an ASI-only character's rows are unchanged, and an ability score increase is not listed", () => {
    const character = makeChar({
      asiSelections: [
        asiFeat("Sample Edge", "TST", 4),
        { level: 4, type: "asi", asi: { str: 2 } },
        asiFeat("Sample Bare", "TST", 8),
      ],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.deepEqual(rows, [
      { id: "feat_Sample Edge_4", name: "Sample Edge (Feat, Lvl 4)", source: "TST", description: "Sample edge text." },
      { id: "feat_Sample Bare_8", name: "Sample Bare (Feat, Lvl 8)", source: "TST", description: "Feat benefits." },
    ]);
  });

  test("a feat held in both lists gives two distinct ids", () => {
    const character = makeChar({
      originFeats: [originFeat("Sample Edge", "TST")],
      asiSelections: [asiFeat("Sample Edge", "TST", 4)],
    });
    const rows = featFeatureRows(character, compendium, ALL_BOOKS);
    assert.equal(rows.length, 2);
    assert.equal(new Set(rows.map((row) => row.id)).size, 2);
    assert.deepEqual(rows.map((row) => row.name), ["Sample Edge (Feat, Lvl 1)", "Sample Edge (Feat, Lvl 4)"]);
  });
});
