import test from "node:test";
import assert from "node:assert/strict";
import { compareToBaseline, parseTscOutput, toBaseline } from "../scripts/typecheck-ratchet.mjs";

// The type-check ratchet (scripts/typecheck-ratchet.mjs) runs tsc on tsconfig.checks.json and compares the
// errors with checks/fixtures/typecheckBaseline.json. These tests pin the comparison on invented errors.
// Line numbers are not part of an error's identity, so an edit above an old error keeps it baselined.

const SAMPLE_OUTPUT = [
  "checks/invented.test.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
  "checks/invented.test.ts(9,1): error TS18048: 'widget' is possibly 'undefined'.",
  "checks/invented.test.ts(20,1): error TS18048: 'widget' is possibly 'undefined'.",
  "checks/other.test.ts(4,12): error TS2345: Argument of type 'Gadget' is not assignable to parameter of type 'Gizmo'.",
  "  Property 'gizmoId' is missing in type 'Gadget'.",
  "",
].join("\n");

test("parses file, line, code and message, keeping indented detail lines", () => {
  const entries = parseTscOutput(SAMPLE_OUTPUT);
  assert.equal(entries.length, 4);
  assert.deepEqual(
    { file: entries[0].file, line: entries[0].line, code: entries[0].code, message: entries[0].message },
    {
      file: "checks/invented.test.ts",
      line: 3,
      code: "TS2322",
      message: "Type 'string' is not assignable to type 'number'.",
    },
  );
  assert.match(entries[3].detail, /gizmoId/);
});

test("errors recorded in the baseline pass even when their line numbers moved", () => {
  const baseline = toBaseline(parseTscOutput(SAMPLE_OUTPUT));
  const moved = SAMPLE_OUTPUT.replace("checks/invented.test.ts(9,1)", "checks/invented.test.ts(41,1)");
  const result = compareToBaseline(parseTscOutput(moved), baseline);
  assert.deepEqual(result.newErrors, []);
  assert.equal(result.resolved, 0);
});

test("an error that is not in the baseline is reported with its file and line", () => {
  const baseline = toBaseline(parseTscOutput(SAMPLE_OUTPUT));
  const withNew = `${SAMPLE_OUTPUT}checks/fresh.test.ts(12,5): error TS2741: Property 'name' is missing.\n`;
  const result = compareToBaseline(parseTscOutput(withNew), baseline);
  assert.equal(result.newErrors.length, 1);
  assert.equal(result.newErrors[0].file, "checks/fresh.test.ts");
  assert.equal(result.newErrors[0].line, 12);
  assert.equal(result.newErrors[0].code, "TS2741");
});

test("an extra occurrence of a baselined message counts as new", () => {
  const baseline = toBaseline(parseTscOutput(SAMPLE_OUTPUT));
  const extra = `${SAMPLE_OUTPUT}checks/invented.test.ts(77,1): error TS18048: 'widget' is possibly 'undefined'.\n`;
  const result = compareToBaseline(parseTscOutput(extra), baseline);
  assert.equal(result.newErrors.length, 1);
  assert.equal(result.newErrors[0].line, 77);
});

test("fixed errors are counted as resolved and never fail the check", () => {
  const baseline = toBaseline(parseTscOutput(SAMPLE_OUTPUT));
  const fewer = SAMPLE_OUTPUT.replace(/checks\/invented\.test\.ts\(20,1\).*\n/, "");
  const result = compareToBaseline(parseTscOutput(fewer), baseline);
  assert.deepEqual(result.newErrors, []);
  assert.equal(result.resolved, 1);
});

test("a baseline is written in a stable order, one entry per file, code and message", () => {
  const baseline = toBaseline(parseTscOutput(SAMPLE_OUTPUT));
  assert.equal(baseline.errors.length, 3);
  assert.deepEqual(
    baseline.errors.map((e) => e.file),
    ["checks/invented.test.ts", "checks/invented.test.ts", "checks/other.test.ts"],
  );
  const widget = baseline.errors.find((e) => e.message.includes("widget"));
  assert.ok(widget);
  assert.equal(widget.count, 2);
  assert.equal(Object.hasOwn(widget, "line"), false);
});
