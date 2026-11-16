import test from "node:test";
import assert from "node:assert/strict";
import {
  compareDice,
  dieLabels,
  chipsOf,
  fatalCount,
  findRollButton,
  findNodeById,
  formatResultLine,
  inputTextArg,
  optionsSwipeArgs,
  parseChip,
  parseLabel,
  parseRollArgs,
  resolveMode,
  revealSwipe,
  scrollerOf,
  uncoveredTapPoint,
  usage,
} from "../scripts/lib/android-roll.mjs";
import { parseDumpOutput, visibleBounds } from "../scripts/lib/uiautomator.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The pure helpers of `npm run android:roll` (scripts/lib/android-roll.mjs): the argument parser, the
// escaping of an expression for `adb shell input text`, the die label and die chip parsers, the
// label-to-chip comparison per mode (match, a face mismatch, a dropped die, the cap, a subtracted chip,
// no labels in Off), the settle rule, the Roll button lookup, the FATAL count and the output line. The
// dumps are built from the same node shape the device writes and read through parseDumpOutput.

const PKG = "io.github.klr2002.cb5e";

// One <node> of a dump. Children are passed as the already-built XML of the nodes inside it.
function node(attrs: Record<string, string>, children = ""): string {
  const text = attrs.text ?? "";
  const desc = attrs["content-desc"] ?? "";
  const id = attrs["resource-id"] ? ` resource-id="${PKG}:id/${attrs["resource-id"]}"` : "";
  const clickable = attrs.clickable ?? "false";
  const bounds = attrs.bounds ?? "[0,0][10,10]";
  return `<node text="${text}" content-desc="${desc}"${id} class="android.view.View" clickable="${clickable}" bounds="${bounds}">${children}</node>`;
}

function dump(...children: string[]): string {
  return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${children.join("")}</hierarchy>`;
}

function label(id: string, desc: string): string {
  return node({ "resource-id": id, "content-desc": desc, bounds: "[10,10][20,20]" });
}

// A die chip as the device lists it: a View with no listed children, its face and sides as Text nodes listed
// after it, inside its bounds (the way rollViews.tsx draws it). `x` places the chip, so chips do not overlap.
function chip(face: string, sides: string, x = 30): string {
  const box = `[${x},30][${x + 60},90]`;
  return (
    node({ "resource-id": "die-chip", bounds: box }) +
    node({ text: face, bounds: `[${x + 4},40][${x + 30},80]` }) +
    node({ text: sides, bounds: `[${x + 30},40][${x + 58},80]` })
  );
}

function card(...chips: string[]): string {
  return node({ "resource-id": "result-card", bounds: "[0,400][720,1200]" }, chips.join(""));
}

test("parseRollArgs reads the mode, the shots folder, --record and every expression", () => {
  const parsed = parseRollArgs(["--mode", "throw", "--shots", "/tmp/shots", "--record", "20d20", "a(d20)+d6"]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.mode, "throw");
  assert.equal(parsed.shots, "/tmp/shots");
  assert.equal(parsed.record, true);
  assert.deepEqual(parsed.expressions, ["20d20", "a(d20)+d6"]);
});

test("parseRollArgs keeps the current setting without --mode and rejects a bad argument", () => {
  const plain = parseRollArgs(["d20"]);
  assert.equal(plain.ok, true);
  assert.equal(plain.mode, null);
  assert.equal(plain.shots, null);
  assert.equal(plain.record, false);

  assert.equal(parseRollArgs(["--mode", "spin", "d20"]).ok, false, "an unknown mode");
  assert.equal(parseRollArgs(["--mode"]).ok, false, "--mode without a value");
  assert.equal(parseRollArgs(["--shots"]).ok, false, "--shots without a value");
  assert.equal(parseRollArgs(["--bogus", "d20"]).ok, false, "an unknown flag");
  assert.equal(parseRollArgs([]).ok, false, "no expression");
  assert.equal(parseRollArgs(["   "]).ok, false, "a blank expression");
});

test("parseRollArgs reports --help without requiring an expression", () => {
  const parsed = parseRollArgs(["--help"]);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.help, true);
  assert.match(usage(), /android:roll/);
  assert.match(usage(), /--mode throw\|tumble\|off/);
});

test("inputTextArg escapes the parentheses that the device shell treats specially", () => {
  assert.equal(inputTextArg("a(d20)+d6"), "a\\(d20\\)+d6");
  assert.equal(inputTextArg("a(d20)+d100+d6+d4+d8+d10+d12"), "a\\(d20\\)+d100+d6+d4+d8+d10+d12");
});

test("inputTextArg escapes a comma and writes a space as %s, which input text reads as a space", () => {
  assert.equal(inputTextArg("10d20,d6"), "10d20\\,d6");
  assert.equal(inputTextArg("d20 + 2"), "d20%s+%s2");
  assert.equal(inputTextArg("20d20"), "20d20", "plain letters and digits pass through");
});

test("parseLabel reads a die label, with and without the dropped suffix, and rejects other text", () => {
  assert.deepEqual(parseLabel("d20 showing 14"), { sides: 20, face: 14, dropped: false });
  assert.deepEqual(parseLabel("d20 showing 3, dropped"), { sides: 20, face: 3, dropped: true });
  assert.deepEqual(parseLabel("d100 showing 40"), { sides: 100, face: 40, dropped: false });
  assert.equal(parseLabel("Dismiss result"), null);
  assert.equal(parseLabel(""), null);
});

test("parseChip reads a chip's text, with a leading minus for a subtracted die", () => {
  assert.deepEqual(parseChip("14d20"), { sides: 20, face: 14, subtracted: false });
  assert.deepEqual(parseChip("−14d20"), { sides: 20, face: 14, subtracted: true });
  assert.deepEqual(parseChip("-4d6"), { sides: 6, face: 4, subtracted: true }, "an ASCII minus too");
  assert.equal(parseChip("Natural 20"), null);
});

test("compareDice matches labels and chips of a Throw batch", () => {
  const result = compareDice({
    mode: "throw",
    labels: [
      { index: 0, desc: "d20 showing 14" },
      { index: 1, desc: "d100 showing 40" },
    ],
    chips: [{ text: "14d20" }, { text: "40d100" }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.labelCount, 2);
  assert.equal(result.chipCount, 2);
  assert.deepEqual(result.mismatches, []);
});

test("compareDice names the label and chip of a face mismatch", () => {
  const result = compareDice({
    mode: "throw",
    labels: [
      { index: 0, desc: "d20 showing 14" },
      { index: 1, desc: "d6 showing 5" },
    ],
    chips: [{ text: "14d20" }, { text: "3d6" }],
  });
  assert.equal(result.ok, false);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.mismatches[0].index, 1);
  assert.equal(result.mismatches[0].label, "d6 showing 5");
  assert.equal(result.mismatches[0].chip, "3d6");
});

test("compareDice compares a dropped die by its face: the chip shows the same face", () => {
  const result = compareDice({
    mode: "throw",
    labels: [{ index: 0, desc: "d20 showing 3, dropped" }],
    chips: [{ text: "3d20" }],
  });
  assert.equal(result.ok, true);
});

test("compareDice caps the labels at 20 in Throw and at 10 in Tumble, and compares only the labelled chips", () => {
  const chips = Array.from({ length: 25 }, (_, i) => ({ text: `${(i % 20) + 1}d20` }));
  const throwLabels = Array.from({ length: 20 }, (_, i) => ({ index: i, desc: `d20 showing ${(i % 20) + 1}` }));
  const capped = compareDice({ mode: "throw", labels: throwLabels, chips });
  assert.equal(capped.ok, true, "25 chips with the 20 capped labels pass");
  assert.equal(capped.expected, 20);
  assert.equal(capped.chipCount, 25);

  const missing = compareDice({ mode: "throw", labels: throwLabels.slice(0, 19), chips });
  assert.equal(missing.ok, false, "one label short of the cap fails");

  const tumbleChips = Array.from({ length: 11 }, () => ({ text: "5d20" }));
  const tumbleLabels = Array.from({ length: 10 }, (_, i) => ({ index: i, desc: "d20 showing 5" }));
  const tumble = compareDice({ mode: "tumble", labels: tumbleLabels, chips: tumbleChips });
  assert.equal(tumble.ok, true, "11 chips with the 10 capped Tumble labels pass");
  assert.equal(tumble.expected, 10);
});

test("compareDice reads a subtracted chip by its face", () => {
  const result = compareDice({
    mode: "throw",
    labels: [
      { index: 0, desc: "d20 showing 14" },
      { index: 1, desc: "d6 showing 4" },
    ],
    chips: [{ text: "14d20" }, { text: "−4d6" }],
  });
  assert.equal(result.ok, true);
});

test("compareDice in Off passes with no labels and fails when labels are present", () => {
  assert.equal(compareDice({ mode: "off", labels: [], chips: [{ text: "14d20" }] }).ok, true);
  const labelled = compareDice({ mode: "off", labels: [{ index: 0, desc: "d20 showing 14" }], chips: [{ text: "14d20" }] });
  assert.equal(labelled.ok, false);
});

test("compareDice fails a label that is not a die label, and a chip that is not a chip", () => {
  const badLabel = compareDice({ mode: "throw", labels: [{ index: 0, desc: "Dismiss result" }], chips: [{ text: "14d20" }] });
  assert.equal(badLabel.ok, false);
  const badChip = compareDice({ mode: "throw", labels: [{ index: 0, desc: "d20 showing 14" }], chips: [{ text: "Natural 20" }] });
  assert.equal(badChip.ok, false);
});

test("dieLabels finds the labels of one mode by resource-id, in index order, and names the mode", () => {
  const nodes = parseDumpOutput(
    dump(
      label("throw-die-1", "d6 showing 2"),
      label("throw-die-0", "d20 showing 14"),
      node({ "resource-id": "throw-layer" }),
    ),
  );
  assert.ok(nodes);
  const found = dieLabels(nodes);
  assert.equal(found.kind, "throw");
  assert.deepEqual(found.labels, [
    { index: 0, desc: "d20 showing 14" },
    { index: 1, desc: "d6 showing 2" },
  ]);
  assert.equal(dieLabels(parseDumpOutput(dump(node({ "resource-id": "dice-button" })))).kind, null);
  const tumble = dieLabels(parseDumpOutput(dump(label("die-solid-0", "d20 showing 5"))));
  assert.equal(tumble.kind, "tumble");
});

test("chipsOf reads the chips inside result-card in order, joining each chip's text children", () => {
  const nodes = parseDumpOutput(dump(card(chip("14", "d20"), chip("−4", "d6", 120))));
  assert.ok(nodes);
  assert.deepEqual(chipsOf(nodes), [{ text: "14d20" }, { text: "−4d6" }]);
  assert.deepEqual(chipsOf(parseDumpOutput(dump(chip("9", "d8")))), [], "a chip outside result-card is not counted");
  // Text drawn under the card (listed before it) and inside the chip's box is not part of the chip.
  const under = node({ text: "Elowen", bounds: "[30,40][60,80]" });
  assert.deepEqual(chipsOf(parseDumpOutput(dump(under, card(chip("14", "d20"))))), [{ text: "14d20" }]);
});

test("chipsOf reads the recorded Throw batch on the emulator: one chip with its face and sides", () => {
  const nodes = parseDumpOutput(readFileSync(fileURLToPath(new URL("./fixtures/android-roll-result-throw.xml", import.meta.url)), "utf8"));
  assert.ok(nodes);
  assert.deepEqual(chipsOf(nodes), [{ text: "16d20" }]);
  assert.deepEqual(dieLabels(nodes).labels, [{ index: 0, desc: "d20 showing 16" }]);
  const found = compareDice({ mode: "throw", labels: dieLabels(nodes).labels, chips: chipsOf(nodes) });
  assert.equal(found.ok, true, JSON.stringify(found));
});

test("findRollButton picks the Roll button and never the Roll Expression field", () => {
  const nodes = parseDumpOutput(
    dump(
      node({ "content-desc": "Roll Expression", clickable: "true", bounds: "[0,100][700,160]" }),
      node({ "content-desc": "Roll 20d20", clickable: "true", bounds: "[500,200][700,260]" }),
    ),
  );
  assert.ok(nodes);
  assert.equal(findRollButton(nodes, "20d20")?.contentDesc, "Roll 20d20");
  assert.equal(findRollButton(nodes, "d6")?.contentDesc, "Roll 20d20", "a Roll button for another expression is still a Roll button");
  assert.equal(findRollButton(parseDumpOutput(dump(node({ "content-desc": "Roll Expression", clickable: "true" }))), "d6"), null);
});

test("findNodeById matches the resource-id, with or without the package prefix", () => {
  const nodes = parseDumpOutput(dump(node({ "resource-id": "dice-button", "content-desc": "Dice tray", clickable: "true" })));
  assert.ok(nodes);
  assert.equal(findNodeById(nodes, "dice-button")?.contentDesc, "Dice tray");
  assert.equal(findNodeById(nodes, "dice"), null);
});

test("fatalCount counts the FATAL EXCEPTION lines of a logcat dump", () => {
  assert.equal(fatalCount(""), 0);
  assert.equal(fatalCount("I/ReactNative: ok\n"), 0);
  assert.equal(fatalCount("E AndroidRuntime: FATAL EXCEPTION: main\nE AndroidRuntime: FATAL EXCEPTION: x\n"), 2);
});

test("formatResultLine prints one line per expression, with the counts, the FATALs and the shot", () => {
  const passed = formatResultLine({
    expression: "20d20",
    mode: "throw",
    result: { ok: true, labelCount: 20, chipCount: 20, mismatches: [] },
    fatal: 0,
    shot: "/tmp/shots/1-20d20.png",
  });
  assert.equal(passed, "20d20 [throw]: 20 labels = 20 chips, FATAL 0, shot /tmp/shots/1-20d20.png");

  const mismatch = formatResultLine({
    expression: "d6",
    mode: "tumble",
    result: { ok: false, labelCount: 1, chipCount: 1, mismatches: [{ index: 0, label: "d6 showing 5", chip: "3d6" }] },
    fatal: 0,
    shot: "/tmp/shots/2-d6.png",
  });
  assert.match(mismatch, /MISMATCH label 0 "d6 showing 5" vs chip 0 "3d6"/);

  const timedOut = formatResultLine({ expression: "d6", mode: null, result: { ok: false, error: "timed out after 40 s" }, fatal: 1, shot: null });
  assert.match(timedOut, /^d6 \[current\]: timed out after 40 s, FATAL 1/);
});

test("optionsSwipeArgs swipes up mid-width and 96 px clear of the top and bottom edges", () => {
  assert.deepEqual(optionsSwipeArgs({ width: 720, height: 1280, topBar: 48, bottomBar: 48 }), [360, 1184, 360, 96, 300]);
});

test("resolveMode uses the requested mode, else the mode the labels show, else Off", () => {
  assert.equal(resolveMode("tumble", "throw"), "tumble");
  assert.equal(resolveMode(null, "tumble"), "tumble");
  assert.equal(resolveMode(null, null), "off");
});


// A real Options dump with the Throw option scrolled above the list: the node's bounds are inverted, so it is
// not on screen, and the reveal swipe must move the content down.
test("the reveal swipe for a Throw option scrolled above the Options list goes down", () => {
  const nodes = parseDumpOutput(readFileSync(fileURLToPath(new URL("./fixtures/android-roll-options-clipped.xml", import.meta.url)), "utf8"));
  assert.ok(nodes);
  const view = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };
  const node = findNodeById(nodes, "dice-animation-throw");
  assert.ok(node);
  assert.equal(visibleBounds(node, view), null, "the clipped node is not on screen");
  const scroller = scrollerOf(nodes);
  assert.deepEqual(scroller?.bounds, { x1: 0, y1: 156, x2: 720, y2: 1236 });
  // The gap is 156 - 146 = 10 px plus REVEAL_MARGIN_PX: 130 px of content movement, down.
  const reveal = revealSwipe(node, scroller);
  assert.deepEqual(reveal, { direction: "down", distance: 130 });
  // The swipe runs inside the list, from its top edge plus SCROLL_PAD_PX for that distance.
  assert.deepEqual(optionsSwipeArgs(view, reveal.direction, scroller, reveal.distance), [360, 164, 360, 294, 300]);
});

test("the reveal swipe goes up for a node below the list, and in steps when the node is not listed yet", () => {
  const view = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };
  const scroller = { bounds: { x1: 0, y1: 156, x2: 720, y2: 1236 } };
  assert.deepEqual(revealSwipe({ bounds: { x1: 10, y1: 1300, x2: 90, y2: 1340 } }, scroller), { direction: "up", distance: 184 });
  assert.deepEqual(revealSwipe(null, scroller), { direction: "up", distance: 400 });
  assert.deepEqual(optionsSwipeArgs(view, "up", scroller, 400), [360, 1184, 360, 784, 300]);
  assert.deepEqual(optionsSwipeArgs(view), [360, 1184, 360, 96, 300], "without a scroller the whole screen span");
});

// Taps are z-ordered: a clickable node listed before the target is drawn below it, so it does not cover it.
test("uncoveredTapPoint: a clickable listed before the target does not cover it, one listed after does", () => {
  const view = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };
  const below = node({ "content-desc": "Backdrop", clickable: "true", bounds: "[0,0][720,1280]" });
  const target = node({ "content-desc": "Roll Expression", clickable: "true", bounds: "[40,600][680,700]" });
  const above = node({ "content-desc": "Overlay", clickable: "true", bounds: "[300,600][400,700]" });
  const beneath = parseDumpOutput(dump(below, target));
  assert.ok(beneath);
  assert.deepEqual(uncoveredTapPoint(beneath[1], view, beneath), { x: 360, y: 650 });
  const covered = parseDumpOutput(dump(target, above));
  assert.ok(covered);
  const point = uncoveredTapPoint(covered[0], view, covered);
  assert.ok(point, "a grid point outside the overlay exists");
  assert.ok(!(point.x >= 300 && point.x <= 400 && point.y >= 600 && point.y <= 700), "the tap avoids the overlay");
});

test("uncoveredTapPoint on the recorded tray: the Roll Expression field is tapped at its centre", () => {
  const nodes = parseDumpOutput(readFileSync(fileURLToPath(new URL("./fixtures/android-roll-tray.xml", import.meta.url)), "utf8"));
  assert.ok(nodes);
  const field = nodes.find((candidate) => candidate.contentDesc === "Roll Expression");
  assert.ok(field);
  assert.deepEqual(uncoveredTapPoint(field, { width: 720, height: 1280, topBar: 48, bottomBar: 48 }, nodes), { x: 361, y: 678 });
});

test("uncoveredTapPoint on the recorded Home screen: the dice button is tapped on a point no later node covers", () => {
  const nodes = parseDumpOutput(readFileSync(fileURLToPath(new URL("./fixtures/android-roll-home.xml", import.meta.url)), "utf8"));
  assert.ok(nodes);
  const button = findNodeById(nodes, "dice-button");
  assert.ok(button);
  const point = uncoveredTapPoint(button, { width: 720, height: 1280, topBar: 48, bottomBar: 48 }, nodes);
  assert.ok(point);
  assert.ok(point.x >= 588 && point.x <= 691 && point.y >= 1104 && point.y <= 1207, "inside the button");
  const index = nodes.indexOf(button);
  const covering = nodes.filter(
    (n, j) => j > index && n.clickable && n.bounds && point.x >= n.bounds.x1 && point.x <= n.bounds.x2 && point.y >= n.bounds.y1 && point.y <= n.bounds.y2,
  );
  assert.deepEqual(covering, [], "no clickable node drawn over the button covers the point");
});

// The recorded tray with "d20d20d20" typed: the Roll button is listed with a leading comma in its label.
test("findRollButton finds the Roll button on the recorded typed tray, whose label leads with a comma", () => {
  const nodes = parseDumpOutput(readFileSync(fileURLToPath(new URL("./fixtures/android-roll-tray-typed.xml", import.meta.url)), "utf8"));
  assert.ok(nodes);
  const button = findRollButton(nodes, "d20d20d20");
  assert.equal(button?.contentDesc, ", Roll d20d20d20", "the label leads with an icon glyph and a comma");
  assert.deepEqual(button?.bounds, { x1: 39, y1: 1114, x2: 683, y2: 1210 });
  assert.equal(findRollButton(nodes, "d20")?.contentDesc, ", Roll d20d20d20", "the only Roll button is used when no title matches");
});
