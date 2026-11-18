import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The feat picking body lives in one component. The Level-Up Flow's ASI/Feat step renders it for the feat tab and keeps
// only its frame, the ASI tab and the summary line.

const STEP = fileURLToPath(new URL("../src/components/levelUpFlow/AsiFeatStep.tsx", import.meta.url));
const PICKER = fileURLToPath(new URL("../src/components/feats/FeatPicker.tsx", import.meta.url));

// Markup that belongs to the picker and must not stay in the step.
const PICKER_MARKUP = [
  "Search feats...",
  "accessibilityLabel={`Feat ${f.name}`}",
  "validateFeatPrerequisites",
  "accessibilityLabel={`${choice.traitName} ${opt.name}`}",
  "Ability Score Increase:",
];

test("the feat picker is a component the Level-Up step renders for its feat tab", () => {
  assert.ok(existsSync(PICKER), "src/components/feats/FeatPicker.tsx must exist");
  const step = readFileSync(STEP, "utf8");
  assert.match(step, /import \{[^}]*\bFeatPicker\b[^}]*\} from "\.\.\/feats\/FeatPicker";/);
  assert.match(step, /<FeatPicker/);
});

test("the Level-Up step holds no feat list, feat search or Increase Choice markup of its own", () => {
  const step = readFileSync(STEP, "utf8");
  for (const text of PICKER_MARKUP) {
    assert.ok(!step.includes(text), `AsiFeatStep.tsx still contains: ${text}`);
  }
});

test("the picker holds the feat list markup and reads prerequisites from the offered feats", () => {
  const picker = readFileSync(PICKER, "utf8");
  for (const text of PICKER_MARKUP) {
    if (text === "validateFeatPrerequisites") continue;
    assert.ok(picker.includes(text), `FeatPicker.tsx must contain: ${text}`);
  }
  assert.ok(!picker.includes("validateFeatPrerequisites"), "FeatPicker.tsx must read prerequisites from offered");
});
