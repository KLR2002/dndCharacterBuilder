import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { coverageGaps, expertiseGaps, gapName, type CoverageGap } from "../src/grants/coverage.ts";
import { describeGrant, notesSection, renderDecisionReview } from "../src/grants/review.ts";
import type { TrackedData } from "../src/grants/subjects.ts";
import { REVIEWED_GRANTS_NOTHING, REVIEWED_NOT_A_SKILL_GRANT, type ReviewedFeature } from "../src/overrides/proficiency-grants.ts";

// The tracked-data gate is on: every matching feature is covered by grants or marked as granting nothing.
const GATE_ENFORCED = true;

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

// Two tracked classes with one name, one per source, each with a feature of the same name and level.
// A mark names that feature by owner, feature and level only, so it covers both copies.
function twoSourceData(grantedInSecond: boolean): TrackedData {
  const feature = (grants: unknown[] = []) => ({
    name: "Lantern Training",
    level: 1,
    description: "You are proficient with lantern-maker's kit. Your steps are quiet.",
    ...(grants.length > 0 ? { grants } : {}),
  });
  return {
    classes: [
      { name: "Sample Class", source: "AAA", features: [feature()], subclasses: [] },
      { name: "Sample Class", source: "BBB", features: [feature(grantedInSecond ? [GRANT] : [])], subclasses: [] },
    ],
    feats: [],
  } as unknown as TrackedData;
}

test("two tracked classes with one name from different sources are read without throwing, and a shared gap is reported once", () => {
  const gaps = coverageGaps(twoSourceData(false), []);
  assert.deepEqual(gaps.map(gapName), ["Sample Class / Lantern Training (level 1)"]);
});

test("a gap on one copy is reported even when the other copy has grants", () => {
  const gaps = coverageGaps(twoSourceData(true), []);
  assert.deepEqual(gaps.map(gapName), ["Sample Class / Lantern Training (level 1)"]);
});

test("a mark naming the shared feature covers every copy of it", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  assert.deepEqual(coverageGaps(twoSourceData(false), [mark]), []);
});

test("a mark naming the shared feature fails when any copy has grants, so a stale mark cannot hide a gap", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  assert.throws(() => coverageGaps(twoSourceData(true), [mark]), /has grants/);
});

test("gapName names each feature for the failure message", () => {
  assert.equal(
    gapName({ owner: "Sample Class/Sample Path", feature: "Mind Guard", level: 3, sentences: [] }),
    "Sample Class/Sample Path / Mind Guard (level 3)"
  );
});

test("the review records each grant and each mark per owner, then the open entries with matched sentences, then the notes", () => {
  const gaps: CoverageGap[] = [
    { owner: "Sample Class", feature: "Quiet Step", level: 2, sentences: ["You are proficient with a sample kit"] },
  ];
  assert.equal(
    renderDecisionReview({
      grants: [
        {
          owner: "Sample Class",
          feature: "Lantern Training",
          level: 1,
          grants: [{ kind: "fixed", category: "tools", names: ["lantern-maker's kit"] }],
        },
        {
          owner: "Feat",
          feature: "Sample Feat",
          level: 0,
          grants: [{ kind: "choice", category: "languages", count: 2, pool: { kind: "any" } }],
        },
      ],
      marks: [{ owner: "Sample Class/Sample Path", feature: "Mind Guard", level: 3 }],
      open: gaps,
      notes: "## Notes for the user\n\n- A note for the user.",
    }),
    [
      "# Proficiency grant review",
      "",
      "2 grants added, 1 marked as granting nothing, 1 still open.",
      "Generated by `npm --prefix dnd5eToolsScrap run review:grants`; do not edit by hand. Grants come from src/overrides/proficiency-grants.ts, marks from REVIEWED_GRANTS_NOTHING in the same file.",
      "",
      "## Grants added",
      "",
      "### Sample Class",
      "",
      "- Lantern Training (level 1): tools: lantern-maker's kit",
      "",
      "### Feat",
      "",
      "- Sample Feat (level 0): languages: choose 2 of any",
      "",
      "## Marked as granting nothing",
      "",
      "### Sample Class/Sample Path",
      "",
      "- Mind Guard (level 3)",
      "",
      "## Still open",
      "",
      "### Sample Class",
      "",
      "- Quiet Step (level 2)",
      "  - You are proficient with a sample kit",
      "",
      "## Notes for the user",
      "",
      "- A note for the user.",
      "",
    ].join("\n")
  );
});

test("a grant is described in names, with its choice pool or weapon rule", () => {
  assert.equal(describeGrant({ kind: "fixed", category: "skills", names: ["Insight", "Medicine"] }), "skills: Insight, Medicine");
  assert.equal(
    describeGrant({ kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["Arcana", "Nature"] } }),
    "skills: choose 1 from Arcana, Nature"
  );
  assert.equal(
    describeGrant({
      kind: "choice",
      category: "weapons",
      count: 1,
      pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["two-handed"], plus: [], attackType: "melee" },
    }),
    "weapons: choose 1 from simple and martial weapons, without two-handed, melee only"
  );
});

test("the notes are the decisions file's notes section, from its heading to the end", () => {
  assert.equal(
    notesSection("# Decisions\n\n## Table\n\n| row |\n\n## Notes for the user (go into the final review.md)\n\n- One.\n- Two.\n"),
    "## Notes for the user (go into the final review.md)\n\n- One.\n- Two."
  );
  assert.throws(() => notesSection("# Decisions\n\nNo notes here.\n"), /Notes for the user/);
});

test("the tracked data has no uncovered proficiency features, once the gate is enforced", { skip: GATE_ENFORCED ? false : "gate off until the review is done; set GATE_ENFORCED to true" }, () => {
  const tracked: TrackedData = {
    classes: JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")),
    feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
  };
  const gaps = coverageGaps(tracked, REVIEWED_GRANTS_NOTHING);
  assert.deepEqual(gaps.map(gapName), []);
});

// Expertise gate: a feature whose text doubles the proficiency bonus needs an Expertise grant on a skill grant, or a review mark.

const DOUBLING_TEXT = "You gain proficiency in Acrobatics. Your proficiency bonus is doubled for any ability check you make that uses Acrobatics.";

const EXPERTISE_GRANT = {
  id: "TST/Sample Class/Lantern Training@1#skills:fixed:Acrobatics",
  kind: "fixed",
  category: "skills",
  names: ["Acrobatics"],
  expertise: true,
};

test("a feature whose text doubles the bonus, with no expertise grant or mark, is an expertise gap with its doubling sentence", () => {
  const gaps = expertiseGaps(data([{ description: DOUBLING_TEXT }]), []);
  assert.deepEqual(gaps, [
    {
      owner: "Sample Class",
      feature: "Lantern Training",
      level: 1,
      sentences: ["Your proficiency bonus is doubled for any ability check you make that uses Acrobatics"],
    },
  ]);
});

test("a skills grant marked expertise covers its feature", () => {
  assert.deepEqual(expertiseGaps(data([{ description: DOUBLING_TEXT, grants: [EXPERTISE_GRANT] }]), []), []);
});

test("a feature with no doubling sentence is not an expertise gap", () => {
  assert.deepEqual(expertiseGaps(data([{ description: "You move without a sound." }]), []), []);
});

test("a review mark covers a doubling feature that has other grants", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  const grants = [{ id: "TST/Sample Class/Lantern Training@1#tools:fixed:lantern-maker's kit", kind: "fixed", category: "tools", names: ["lantern-maker's kit"] }];
  assert.deepEqual(expertiseGaps(data([{ description: DOUBLING_TEXT, grants }]), [mark]), []);
});

test("a review mark on a feature whose skill grant is marked expertise is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  assert.throws(() => expertiseGaps(data([{ description: DOUBLING_TEXT, grants: [EXPERTISE_GRANT] }]), [mark]), /marked expertise/);
});

test("a review mark on a feature whose text doubles no proficiency bonus is an error", () => {
  const mark: ReviewedFeature = { owner: "Sample Class", feature: "Lantern Training", level: 1 };
  assert.throws(() => expertiseGaps(data([{ description: "You move without a sound." }]), [mark]), /doubles no proficiency bonus/);
});

test("an expertise grant on a grant that is not a skill grant is an error", () => {
  const grants = [{ id: "TST/Sample Class/Lantern Training@1#tools:fixed:x", kind: "fixed", category: "tools", names: ["lantern-maker's kit"], expertise: true }];
  assert.throws(() => expertiseGaps(data([{ description: DOUBLING_TEXT, grants }]), []), /not a skills grant/);
});

test("the tracked data has no unreviewed Expertise features", () => {
  const tracked: TrackedData = {
    classes: JSON.parse(fs.readFileSync(new URL("../data/classes.json", import.meta.url), "utf8")),
    feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
  };
  assert.deepEqual(expertiseGaps(tracked, REVIEWED_NOT_A_SKILL_GRANT).map(gapName), []);
});
