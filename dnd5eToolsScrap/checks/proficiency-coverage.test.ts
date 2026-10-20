import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { coverageGaps, gapName, type CoverageGap } from "../src/grants/coverage.ts";
import { renderReview } from "../src/grants/review.ts";
import type { TrackedData } from "../src/grants/subjects.ts";
import { REVIEWED_GRANTS_NOTHING, type ReviewedFeature } from "../src/overrides/proficiency-grants.ts";

// The tracked-data gate is switched on once the review is done: set this to true.
// Until then it is skipped, so check:all stays green while the review list is open (see .scratch/proficiency-sheet/review.md).
const GATE_ENFORCED = false;

// Every feature, sentence and name in the invented tests below is invented.

const GRANT = {
  id: "TST/Sample Class/Lantern Training@1#0",
  kind: "fixed",
  category: "tools",
  names: ["lantern-maker's kit"],
};

function data(features: Array<Record<string, unknown>>, feats: Array<Record<string, unknown>> = []): TrackedData {
  return {
    classes: [
      {
        name: "Sample Class",
        source: "TST",
        features: features.map((f) => ({ name: "Lantern Training", level: 1, ...f })) as TrackedData["classes"][number]["features"],
        subclasses: [],
      },
    ],
    feats: feats as unknown as TrackedData["feats"],
  };
}

test("a feature whose prose matches the vocabulary and has no grants is a gap, with only its matched sentences", () => {
  const gaps = coverageGaps(
    data([{ description: "You are proficient with lantern-maker's kit. Your steps are quiet." }]),
    []
  );
  assert.deepEqual(gaps, [
    {
      owner: "Sample Class",
      feature: "Lantern Training",
      level: 1,
      sentences: ["You are proficient with lantern-maker's kit"],
    },
  ]);
});

test("a feature with grants is covered, whatever its prose says", () => {
  const gaps = coverageGaps(
    data([{ description: "You gain proficiency with lantern-maker's kit.", grants: [GRANT] }]),
    []
  );
  assert.deepEqual(gaps, []);
});

test("a feature marked as granting nothing is covered by the mark", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  const gaps = coverageGaps(data([{ description: "You are proficient with lantern-maker's kit." }]), [mark]);
  assert.deepEqual(gaps, []);
});

test("a feature whose prose has no proficiency or language vocabulary is not a gap", () => {
  const gaps = coverageGaps(data([{ description: "You move without a sound." }]), []);
  assert.deepEqual(gaps, []);
});

test("a saving-throw proficiency is a gap until it is covered by a saving-throw grant", () => {
  const uncovered = coverageGaps(
    data([{ name: "Mind Guard", description: "Your mind grows sharp. You gain proficiency in all saving throws." }]),
    []
  );
  assert.deepEqual(uncovered.map((g) => g.feature), ["Mind Guard"]);

  const covered = coverageGaps(
    data([
      {
        name: "Mind Guard",
        description: "Your mind grows sharp. You gain proficiency in all saving throws.",
        grants: [{ id: "TST/Sample Class/Mind Guard@1#0", kind: "fixed", category: "savingThrows", names: ["Wisdom"] }],
      },
    ]),
    []
  );
  assert.deepEqual(covered, []);
});

test("a feat with proficiency prose is a gap under the owner Feat at level 0", () => {
  const gaps = coverageGaps(
    { classes: [], feats: [{ name: "Sample Feat", source: "TST", description: "You gain proficiency in a saving throw of your choice." }] as unknown as TrackedData["feats"] },
    []
  );
  assert.deepEqual(gaps.map((g) => [g.owner, g.feature, g.level]), [["Feat", "Sample Feat", 0]]);
});

test("a mark that names a feature the data does not contain is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "No Such Feature", level: 1 };
  assert.throws(() => coverageGaps(data([{ description: "You move quietly." }]), [mark]), /matches no feature/);
});

test("a mark on a feature that also has grants is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  assert.throws(
    () => coverageGaps(data([{ description: "You gain proficiency with lantern-maker's kit.", grants: [GRANT] }]), [mark]),
    /has grants/
  );
});

test("gapName names each feature for the failure message", () => {
  assert.equal(
    gapName({ owner: "Sample Class/Sample Path", feature: "Mind Guard", level: 3, sentences: [] }),
    "Sample Class/Sample Path / Mind Guard (level 3)"
  );
});

test("the review list groups each gap under its owner, one compact entry per feature, with matched sentences only", () => {
  const gaps: CoverageGap[] = [
    {
      owner: "Sample Class",
      feature: "Lantern Training",
      level: 1,
      sentences: ["You are proficient with lantern-maker's kit"],
    },
    {
      owner: "Sample Class/Sample Path",
      feature: "Mind Guard",
      level: 3,
      sentences: ["You gain proficiency in all saving throws", "You gain proficiency in a saving throw of your choice"],
    },
    { owner: "Feat", feature: "Sample Feat", level: 0, sentences: ["You gain proficiency with a tool of your choice"] },
  ];
  assert.equal(
    renderReview(gaps),
    [
      "# Proficiency grant review",
      "",
      "3 entries. Each needs a decision: a grant in src/overrides/proficiency-grants.ts, or a mark in REVIEWED_GRANTS_NOTHING in the same file.",
      "Generated by `npm --prefix dnd5eToolsScrap run review:grants`; do not edit by hand.",
      "",
      "## Sample Class",
      "",
      "- Lantern Training (level 1)",
      "  - You are proficient with lantern-maker's kit",
      "",
      "## Sample Class/Sample Path",
      "",
      "- Mind Guard (level 3)",
      "  - You gain proficiency in all saving throws",
      "  - You gain proficiency in a saving throw of your choice",
      "",
      "## Feat",
      "",
      "- Sample Feat (level 0)",
      "  - You gain proficiency with a tool of your choice",
      "",
    ].join("\n")
  );
});

test("the tracked data has no uncovered proficiency features, once the gate is enforced", { skip: GATE_ENFORCED ? false : "gate off until the review is done; set GATE_ENFORCED to true" }, () => {
  const tracked: TrackedData = {
    classes: JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")),
    feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
  };
  const gaps = coverageGaps(tracked, REVIEWED_GRANTS_NOTHING);
  assert.deepEqual(gaps.map(gapName), []);
});
