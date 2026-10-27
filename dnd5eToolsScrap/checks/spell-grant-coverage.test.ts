import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spellCoverageGaps } from "../src/grants/spell-coverage.ts";
import { gapName } from "../src/grants/coverage.ts";
import { readsSpellGrants, spellGrantSentences } from "../src/parser/spell-grant-prose.ts";
import type { ReviewedFeature } from "../src/overrides/proficiency-grants.ts";
import { REVIEWED_NO_SPELL_GRANTS } from "../src/overrides/granted-spells.ts";
import type { TrackedData } from "../src/grants/subjects.ts";

// Every name and sentence in this file is invented.

function data(feats: Array<Record<string, unknown>>): TrackedData {
  return {
    classes: [],
    feats: feats.map((feat) => ({ name: "Sample Feat", source: "TST", description: "You move quietly.", ...feat })) as unknown as TrackedData["feats"],
  };
}

const KNOWN_FIXED = [{ ability: "wis", known: { _: ["sample spark"] } }];

test("a feat whose prose grants a cantrip and that has no spell grants is a gap, with only its grant sentences", () => {
  const gaps = spellCoverageGaps(data([{ description: "Your lantern warms you. You learn a sample cantrip of your choice. Your steps are quiet." }]), []);
  assert.deepEqual(gaps, [
    { owner: "Feat", feature: "Sample Feat", level: 0, sentences: ["You learn a sample cantrip of your choice"] },
  ]);
  assert.equal(gapName(gaps[0]!), "Feat / Sample Feat (level 0)");
});

test("a feat whose prose grants a spell is covered when it has a readable grant", () => {
  const gaps = spellCoverageGaps(
    data([
      {
        description: "You can cast the sample spell once without a spell slot.",
        additionalSpells: KNOWN_FIXED,
      },
    ]),
    [],
  );
  assert.deepEqual(gaps, []);
});

test("prose that only mentions casting a spell as a trigger is not a grant", () => {
  const gaps = spellCoverageGaps(
    data([{ description: "Whenever you cast a spell that deals sample damage, you gain a sample bonus." }]),
    [],
  );
  assert.deepEqual(gaps, []);
  assert.deepEqual(spellGrantSentences("Whenever you cast a spell that deals sample damage, you gain a sample bonus."), []);
});

test("a grant that names no casting ability is a gap, even with no prose", () => {
  const gaps = spellCoverageGaps(data([{ additionalSpells: [{ known: { _: ["sample spark"] } }] }]), []);
  assert.deepEqual(gaps, [{ owner: "Feat", feature: "Sample Feat", level: 0, sentences: [] }]);
  assert.equal(readsSpellGrants([{ known: { _: ["sample spark"] } }]), false);
});

test("a grant whose prepared group names a spell is covered, with or without a casting ability", () => {
  const grants = [{ prepared: { _: ["sample spark"], s2: ["sample flare"] } }, { ability: "int", prepared: { "3": { daily: { "1": ["sample glow"] } } } }];
  assert.equal(readsSpellGrants(grants), true);
  const gaps = spellCoverageGaps(data([{ description: "You always have one sample spell prepared.", additionalSpells: grants }]), []);
  assert.deepEqual(gaps, []);
});

test("a prepared group that picks only ritual spells is a gap, since the ritual book is not modelled", () => {
  const grants = [{ prepared: { "1": [{ choose: "level=1|components & miscellaneous=ritual", count: 2 }] } }];
  assert.equal(readsSpellGrants(grants), false);
  const gaps = spellCoverageGaps(data([{ description: "You learn two sample rituals.", additionalSpells: grants }]), []);
  assert.deepEqual(gaps.map(gapName), ["Feat / Sample Feat (level 0)"]);
});

test("a grant whose only pick is a ritual filter is a gap, since the ritual book is not modelled", () => {
  const grants = [
    {
      ability: "int",
      innate: { _: { daily: { "1": [{ choose: "level=1|class=Sample Caster|components & miscellaneous=ritual", count: 2 }] } } },
    },
  ];
  assert.equal(readsSpellGrants(grants), false);
  const gaps = spellCoverageGaps(data([{ description: "You have learned a number of sample spells that you can cast as rituals.", additionalSpells: grants }]), []);
  assert.deepEqual(gaps.map(gapName), ["Feat / Sample Feat (level 0)"]);
});

test("a feat marked as not modelled is covered by the mark", () => {
  const mark: ReviewedFeature = { owner: "Feat", feature: "Sample Feat", level: 0 };
  const gaps = spellCoverageGaps(data([{ description: "You learn a sample cantrip of your choice." }]), [mark]);
  assert.deepEqual(gaps, []);
});

test("a mark that names a feat the data does not contain is an error", () => {
  const mark: ReviewedFeature = { owner: "Feat", feature: "No Such Feat", level: 0 };
  assert.throws(() => spellCoverageGaps(data([{ description: "You move quietly." }]), [mark]), /matches no feature/);
});

test("a mark on a feat that has readable spell grants is an error", () => {
  const mark: ReviewedFeature = { owner: "Feat", feature: "Sample Feat", level: 0 };
  assert.throws(
    () => spellCoverageGaps(data([{ description: "You can cast the sample spell once.", additionalSpells: KNOWN_FIXED }]), [mark]),
    /has spell grants/,
  );
});

test("a feat whose prose grants a spell and that has an unreadable grant is a gap, not a covered feat", () => {
  const gaps = spellCoverageGaps(
    data([{ description: "You learn a sample spell.", additionalSpells: [{ known: { _: ["sample spark"] } }] }]),
    [],
  );
  assert.deepEqual(gaps.map(gapName), ["Feat / Sample Feat (level 0)"]);
});

test("the tracked data has no uncovered spell-granting feats", () => {
  const tracked: TrackedData = {
    classes: [],
    feats: JSON.parse(fs.readFileSync(new URL("../data/feats.json", import.meta.url), "utf8")),
  };
  const gaps = spellCoverageGaps(tracked, REVIEWED_NO_SPELL_GRANTS);
  assert.deepEqual(
    gaps.map((gap) => `${gapName(gap)}: ${gap.sentences.join(" | ")}`),
    [],
    "feats whose prose or grant structure is not read by the reader, with no reviewed mark",
  );
});
