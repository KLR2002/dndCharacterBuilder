import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { initiativeCoverageGaps } from "../src/grants/initiative-coverage.ts";
import { candidateSentences } from "../src/parser/initiative-bonuses.ts";
import { gapName } from "../src/grants/coverage.ts";
import type { ReviewedFeature } from "../src/overrides/proficiency-grants.ts";
import { REVIEWED_NO_INITIATIVE_BONUS } from "../src/overrides/initiative-bonuses.ts";
import type { TrackedData } from "../src/grants/subjects.ts";

// Every name and sentence in this file is invented.

function data(features: Array<Record<string, unknown>>, feats: Array<Record<string, unknown>> = []): TrackedData {
  return {
    classes: [
      {
        name: "Sample Class",
        source: "TST",
        features: features.map((f) => ({ name: "Lantern Sense", level: 1, ...f })) as TrackedData["classes"][number]["features"],
        subclasses: [],
      },
    ],
    feats: feats as unknown as TrackedData["feats"],
  };
}

test("a feature whose prose adds a number to initiative and has no Initiative Bonus is a gap, with only its candidate sentences", () => {
  const gaps = initiativeCoverageGaps(
    data([{ description: "Your lantern warms you. You add your Wisdom modifier to your initiative rolls. Your steps are quiet." }]),
    []
  );
  assert.deepEqual(gaps, [
    {
      owner: "Sample Class",
      feature: "Lantern Sense",
      level: 1,
      sentences: ["You add your Wisdom modifier to your initiative rolls"],
    },
  ]);
  assert.equal(gapName(gaps[0]!), "Sample Class / Lantern Sense (level 1)");
});

const BONUS = { kind: "ability", ability: "wis" } as const;

test("a feature with an Initiative Bonus is covered, whatever its prose says", () => {
  const gaps = initiativeCoverageGaps(
    data([{ description: "You add your Wisdom modifier to your initiative rolls.", initiativeBonus: BONUS }]),
    []
  );
  assert.deepEqual(gaps, []);
});

test("a feature marked as adding no Initiative Bonus is covered by the mark", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Sense", level: 1 };
  const gaps = initiativeCoverageGaps(
    data([{ description: "Each ally within 30 feet gains a +2 bonus to initiative rolls." }]),
    [mark]
  );
  assert.deepEqual(gaps, []);
});

test("a mark that names a feature the data does not contain is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "No Such Feature", level: 1 };
  assert.throws(() => initiativeCoverageGaps(data([{ description: "You move quietly." }]), [mark]), /matches no feature/);
});

test("a mark on a feature that has an Initiative Bonus is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Sense", level: 1 };
  assert.throws(
    () => initiativeCoverageGaps(data([{ description: "You add your Wisdom modifier to your initiative rolls.", initiativeBonus: BONUS }]), [mark]),
    /has an Initiative Bonus/
  );
});

test("advantage on initiative rolls, a shared initiative count and a roll trigger that regains a use are not gaps", () => {
  const gaps = initiativeCoverageGaps(
    data([
      { name: "Sample Edge", description: "You have advantage on initiative rolls." },
      { name: "Sample Companion", description: "In combat, the companion shares your initiative count, but it takes its turn immediately after yours." },
      { name: "Sample Surge", description: "When you roll initiative and have no uses left, you regain one use." },
    ]),
    []
  );
  assert.deepEqual(gaps, []);
});

test("a roll trigger that counts bells by a Proficiency Bonus, and grants no initiative bonus, is not a gap", () => {
  const sentence = "When you roll initiative and are not hushed, you can choose a number of bells equal to your Proficiency Bonus that you can hear.";
  const gaps = initiativeCoverageGaps(data([{ name: "Sample Muster", description: sentence }]), []);
  assert.deepEqual(gaps, []);
  assert.deepEqual(candidateSentences(sentence), []);
});

test("a race trait and a feat that add to initiative are gaps, and are covered by a bonus or a mark", () => {
  const races = [
    {
      name: "Sample Folk",
      source: "TST",
      traits: [{ name: "Sample Hop", description: "You can add your proficiency bonus to your initiative rolls." }],
      subraces: [],
    },
  ];
  const feats = [{ name: "Sample Alarm", source: "TST", description: "You gain a +3 bonus to initiative." }];
  const tracked = { classes: [], feats, races } as unknown as TrackedData;

  const gaps = initiativeCoverageGaps(tracked, []);
  assert.deepEqual(gaps.map(gapName), ["Feat / Sample Alarm (level 0)", "Sample Folk / Sample Hop (level 0)"]);
  assert.deepEqual(gaps[1]?.sentences, ["You can add your proficiency bonus to your initiative rolls"]);

  const covered = initiativeCoverageGaps(tracked, [
    { owner: "Feat", feature: "Sample Alarm", level: 0 },
    { owner: "Sample Folk", feature: "Sample Hop", level: 0 },
  ]);
  assert.deepEqual(covered, []);
});

// Every feature in the tracked data whose prose adds a number to initiative has a bonus or a reviewed mark.
test("the tracked data has no uncovered initiative features", () => {
  const tracked: TrackedData = {
    classes: JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")),
    feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
    races: JSON.parse(fs.readFileSync(new URL("../data/races.json", import.meta.url), "utf8")),
  };
  const gaps = initiativeCoverageGaps(tracked, REVIEWED_NO_INITIATIVE_BONUS);
  assert.deepEqual(
    gaps.map((gap) => `${gapName(gap)}: ${gap.sentences.join(" | ")}`),
    [],
    "features whose prose adds to initiative, with no Initiative Bonus and no reviewed mark"
  );
});
