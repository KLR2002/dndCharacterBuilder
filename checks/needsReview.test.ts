import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dismissNotices } from "../src/rules/needsReview.ts";
import { migrateCharacter } from "../src/rules/migrateCharacter.ts";
import { loadTestCatalog, makeChar } from "./testUtils.ts";

const EMBER = "Sample Ember removed from Sample Initiate: feat no longer held";
const PULSE = "Sample Pulse removed from Sample Initiate: spell list changed";
const SPARK = "Sample Spark removed from Sample Lorekeeper: no longer offered";

describe("dismissNotices", () => {
  it("removes the named notice and keeps the others in their order", () => {
    assert.deepEqual(dismissNotices([EMBER, PULSE, SPARK], PULSE), [EMBER, SPARK]);
  });

  it("removes every notice when no notice is named", () => {
    assert.equal(dismissNotices([EMBER, PULSE]), undefined);
  });

  it("keeps the list when the text matches no notice", () => {
    assert.deepEqual(dismissNotices([EMBER, PULSE], "Sample Unknown removed"), [EMBER, PULSE]);
  });

  it("is undefined once the last notice is dismissed, as the character stores an empty list", () => {
    assert.equal(dismissNotices([EMBER], EMBER), undefined);
  });

  it("is undefined for a character with no list", () => {
    assert.equal(dismissNotices(undefined, EMBER), undefined);
  });

  it("does not change the list it is given", () => {
    const notices = [EMBER, PULSE];

    dismissNotices(notices, EMBER);

    assert.deepEqual(notices, [EMBER, PULSE]);
  });
});

describe("migration notices read as player text", () => {
  it("flags an ancestry choice that was never recorded in plain words", () => {
    const legacy = JSON.parse(
      JSON.stringify(
        makeChar({
          race: { name: "Half-Elf", source: "PHB", subraceName: "Drow Descent", subraceSource: "SCAG" },
          classes: [{ className: "Wizard", source: "PHB", level: 1 }],
        }),
      ),
    );
    delete legacy.ruleChoices;

    assert.deepEqual(migrateCharacter(legacy, loadTestCatalog("races")).needsReview, [
      "Your ancestry has a choice to make in the Builder.",
    ]);
  });

  it("flags skill picks whose source is ambiguous in plain words", () => {
    const legacy = JSON.parse(
      JSON.stringify(
        makeChar({
          classes: [
            { className: "Rogue", source: "PHB", level: 1 },
            { className: "Fighter", source: "PHB", level: 1 },
          ],
          chosenSkills: ["Stealth"],
        }),
      ),
    );
    delete legacy.skillChoices;

    assert.deepEqual(migrateCharacter(legacy).needsReview, [
      "Some skill picks could not be matched to a class or background. Check them in the Builder.",
    ]);
  });
});

describe("dismissed notices on reload", () => {
  it("stay dismissed after the character is saved and loaded again", () => {
    const saved = makeChar({ needsReview: [EMBER, PULSE] });
    const dismissed = { ...saved, needsReview: dismissNotices(saved.needsReview, EMBER) };

    const loaded = migrateCharacter(JSON.parse(JSON.stringify(dismissed)));

    assert.deepEqual(loaded.needsReview, [PULSE]);
  });
});
