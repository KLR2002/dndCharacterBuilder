import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describeStep } from "../scripts/lib/steps.mjs";
import {
  MAX_SWIPES,
  findMatches,
  findTarget,
  isVisible,
  playScreen,
  swipeUpArgs,
} from "../scripts/lib/native-steps.mjs";
import { centerOf, parseDump } from "../scripts/lib/uiautomator.mjs";

// The native step player (scripts/lib/native-steps.mjs): it plays a scenario's `tabs`, `open`, `modal` and
// `scrollTo` fields on a uiautomator dump, through the injected dump/tap/swipe, in the order the web check
// plays them. The fixtures are real dumps captured on the emulator: the character screen with its tab bar,
// the Stats screen with the "Take Rest" row, and the Stats screen scrolled down to the languages section with
// the "Add language" button. Matching semantics mirror Playwright's getByText/getByLabel.

type DumpNode = ReturnType<typeof parseDump>[number];

const charTabs = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-character-tabs.xml", import.meta.url)), "utf8"));
const statsRest = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-stats-rest.xml", import.meta.url)), "utf8"));
const statsLang = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-stats-languages.xml", import.meta.url)), "utf8"));

// The screen of the AVD: 720x1280 px, with the 48 px status bar on top and the 48 px gesture bar at the
// bottom (both read from the device; they stay 48 px under a density override).
const VIEW = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };

// A scripted world for playScreen: dump() serves the dumps in order (the last one repeats), tap/swipe/sleep
// record what the player did, and now() is the recorded clock.
function playerWorld(dumpSequence: DumpNode[][]) {
  const taps: { x: number; y: number }[] = [];
  const swipes: string[][] = [];
  const sleeps: number[] = [];
  let clock = 0;
  let dumpIndex = 0;
  return {
    taps,
    swipes,
    sleeps,
    view: VIEW,
    dump: () => dumpSequence[Math.min(dumpIndex++, dumpSequence.length - 1)],
    tap: (point: { x: number; y: number }) => void taps.push(point),
    swipe: (args: number[]) => void swipes.push(args.map(String)),
    sleep: async (ms: number) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  };
}

const play = (world: ReturnType<typeof playerWorld>, screen: Record<string, unknown>) =>
  playScreen({ screen: screen as never, ...world, timeoutMs: 1000, pollMs: 500 });

// --- Fixtures and matching semantics ---

test("the character fixture's tab bar gives the tab tap coordinates", () => {
  // In the fixture the tab row holds "Builder" at [80,187][157,220] and "Stats" at [241,187][297,220].
  const builder = findTarget(charTabs, { method: "getByText", arg: "Builder", options: { exact: true }, index: 0 });
  assert.ok(builder);
  assert.deepEqual(centerOf(builder), { x: 119, y: 204 });
  const stats = findTarget(charTabs, { method: "getByText", arg: "Stats", options: { exact: true }, index: 0 });
  assert.ok(stats);
  assert.deepEqual(centerOf(stats), { x: 269, y: 204 });
});

test("a string without exact is a case-insensitive substring, with exact a full-string match", () => {
  const sub = findTarget(statsRest, { method: "getByText", arg: "take rest", options: undefined, index: 0 });
  assert.equal(sub?.text, "Take Rest (Short / Long)");
  const exact = findTarget(statsRest, { method: "getByText", arg: "Take Rest (Short / Long)", options: { exact: true }, index: 0 });
  assert.equal(exact?.text, "Take Rest (Short / Long)");
  // "Take Rest" alone is a substring but not the full string, so exact does not match it.
  assert.equal(findTarget(statsRest, { method: "getByText", arg: "Take Rest", options: { exact: true }, index: 0 }), null);
});

test("a pattern step is tested against the element's text", () => {
  const call = describeStep({ tap: { pattern: "^Take Rest" } });
  assert.deepEqual(call, { method: "getByText", arg: /^Take Rest/, options: undefined, index: 0 });
  const node = findTarget(statsRest, call);
  assert.equal(node?.text, "Take Rest (Short / Long)");
  assert.deepEqual(node?.bounds, { x1: 80, y1: 298, x2: 346, y2: 364 });
});

test("a label step matches the node's content-desc", () => {
  const call = describeStep({ tap: { label: "Add language" } });
  assert.deepEqual(call, { method: "getByLabel", arg: "Add language", options: undefined, index: 0 });
  const node = findTarget(statsLang, call);
  assert.ok(node);
  assert.equal(node.contentDesc, "Add language");
  // In the fixture the button sits at [624,1120][688,1184].
  assert.deepEqual(node.bounds, { x1: 624, y1: 1120, x2: 688, y2: 1184 });
  assert.deepEqual(centerOf(node), { x: 656, y: 1152 });
  // Label matching has the same exact/substring split, against content-desc.
  assert.ok(findTarget(statsLang, { method: "getByLabel", arg: "language", options: undefined, index: 0 }));
  assert.equal(findTarget(statsLang, { method: "getByLabel", arg: "add language", options: { exact: true }, index: 0 }), null);
});

test("index picks the nth match in dump order", () => {
  const nodes = parseDump(
    `<hierarchy><node text="Skills" bounds="[0,0][10,10]" /><node text="Other" bounds="[0,20][10,30]" /><node text="Skills" bounds="[0,40][10,50]" /></hierarchy>`,
  );
  assert.equal(findMatches(nodes, { method: "getByText", arg: "Skills", options: undefined, index: 0 }).length, 2);
  assert.deepEqual(findTarget(nodes, describeStep({ tap: { text: "Skills", index: 1 } }))?.bounds, { x1: 0, y1: 40, x2: 10, y2: 50 });
  assert.equal(findTarget(nodes, describeStep({ tap: { text: "Skills", index: 5 } })), null);
});

// --- Visibility and the swipe ---

test("visible means fully inside the screen and clear of the status and gesture bars", () => {
  // The fixture justifies the bar strips: no text node of the character screen starts above y=68, so the
  // app content clears the 48 px status bar, and the "Add language" button ends at y=1184, above the
  // gesture bar's 1280-48=1232.
  for (const node of charTabs) if (node.text) assert.ok(node.bounds && node.bounds.y1 >= VIEW.topBar, `"${node.text.slice(0, 20)}" starts at y=${node.bounds?.y1}`);
  const node = (bounds: DumpNode["bounds"]) => ({ text: "x", contentDesc: "", resourceId: "", className: "", clickable: false, scrollable: false, bounds });
  assert.equal(isVisible(node({ x1: 0, y1: 0, x2: 720, y2: 1280 }), VIEW), false); // the root container spans the screen
  assert.equal(isVisible(node({ x1: 80, y1: 187, x2: 157, y2: 220 }), VIEW), true); // a tab
  assert.equal(isVisible(node({ x1: 624, y1: 1120, x2: 688, y2: 1184 }), VIEW), true); // "Add language" in the fixture
  assert.equal(isVisible(node({ x1: 0, y1: 1240, x2: 720, y2: 1280 }), VIEW), false); // under the gesture bar
  assert.equal(isVisible(node({ x1: 0, y1: 10, x2: 720, y2: 60 }), VIEW), false); // in the status bar strip
  assert.equal(isVisible(node({ x1: 715, y1: 187, x2: 720, y2: 220 }), VIEW), true); // clipped at the right edge only
  assert.equal(isVisible(node(null), VIEW), false);
});

test("the swipe up runs mid-screen from 70% to 30% of the height over 300 ms", () => {
  assert.deepEqual(swipeUpArgs(VIEW), [360, 896, 360, 384, 300]);
});

// --- playScreen ---

test("tabs are tapped in order, each followed by a 500 ms wait, then the 300 ms settle", async () => {
  const world = playerWorld([charTabs]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Builder", "Stats"], ready: /points remaining/i });
  assert.equal(result, null);
  assert.deepEqual(world.taps, [
    { x: 119, y: 204 },
    { x: 269, y: 204 },
  ]);
  assert.deepEqual(world.sleeps, [500, 500, 300]);
  assert.deepEqual(world.swipes, []);
});

test("a tab whose text never shows fails with a message naming the tab", async () => {
  const noTabs = parseDump(`<hierarchy><node text="Total Level: 1" bounds="[0,100][200,140]" /></hierarchy>`);
  const world = playerWorld([noTabs]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Stats"], ready: /total level/i });
  assert.match(String(result), /tab "Stats" did not show/);
  assert.deepEqual(world.taps, []);
});

const noNeedle = parseDump(`<hierarchy><node text="Total Level: 1" bounds="[0,100][200,140]" /></hierarchy>`);
const clippedNeedle = parseDump(
  `<hierarchy><node text="Total Level: 1" bounds="[0,100][200,140]" /><node text="Starting Equipment" bounds="[0,1250][400,1300]" /></hierarchy>`,
);
const withNeedle = parseDump(
  `<hierarchy><node text="Total Level: 1" bounds="[0,100][200,140]" /><node text="Starting Equipment" bounds="[52,900][400,950]" /></hierarchy>`,
);
const scrollScreen = { name: "t", route: "/x", ready: /total level/i, scrollTo: "Starting Equipment" };

test("scrollTo does not swipe when the needle is already visible", async () => {
  const world = playerWorld([withNeedle]);
  const result = await play(world, scrollScreen);
  assert.equal(result, null);
  assert.deepEqual(world.swipes, []);
});

test("scrollTo swipes until a dump shows the needle visible, then stops", async () => {
  // The ready wait takes the first dump; the scroll then sees two dumps without a visible needle (the
  // second has it only clipped under the gesture bar) before one with it visible.
  const world = playerWorld([noNeedle, clippedNeedle, noNeedle, withNeedle]);
  const result = await play(world, scrollScreen);
  assert.equal(result, null);
  assert.equal(world.swipes.length, 2);
  assert.deepEqual(world.swipes[0], ["360", "896", "360", "384", "300"]);
});

test("scrollTo gives up after the swipe bound and fails naming the needle", async () => {
  const world = playerWorld([noNeedle]);
  const result = await play(world, scrollScreen);
  assert.equal(world.swipes.length, MAX_SWIPES);
  assert.match(String(result), /scrollTo "Starting Equipment" did not become visible/);
});

test("scrollTo flips direction when a swipe moves nothing, so a needle above is reached", async () => {
  // The needle is visible only at the top of the content; the first two dumps show the bottom (the same
  // geometry, so the second swipe goes down) and the third shows the needle.
  const bottom = noNeedle;
  const top = parseDump(
    `<hierarchy><node text="Total Level: 1" bounds="[0,100][200,140]" /><node text="Starting Equipment" bounds="[52,300][400,350]" /></hierarchy>`,
  );
  const world = playerWorld([bottom, bottom, bottom, top]);
  const result = await play(world, scrollScreen);
  assert.equal(result, null);
  assert.deepEqual(world.swipes, [
    ["360", "896", "360", "384", "300"],
    ["360", "384", "360", "896", "300"],
  ]);
  assert.deepEqual(world.taps, []);
});

test("a modal is waited for as the ready text and is not tapped", async () => {
  const modalDump = parseDump(
    `<hierarchy><node text="Take Rest (Short / Long)" bounds="[80,298][346,364]" /><node text="Rest &amp; Recovery" bounds="[100,400][620,450]" /></hierarchy>`,
  );
  const world = playerWorld([statsRest, modalDump]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { pattern: "^Take Rest" } }], modal: "Rest & Recovery" });
  assert.equal(result, null);
  // Only the Take Rest row is tapped (its centre is 213,331); the dialog title at [100,400][620,450] (centre
  // 360,425) is waited for, never tapped. The settle wait is the modal's 500 ms.
  assert.deepEqual(world.taps, [{ x: 213, y: 331 }]);
  assert.deepEqual(world.sleeps, [500]);
});

test("a modal that never shows fails the scenario as the ready text", async () => {
  const world = playerWorld([statsRest]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { pattern: "^Take Rest" } }], modal: "Rest & Recovery" });
  assert.match(String(result), /ready text "Rest & Recovery" did not show/);
  assert.deepEqual(world.taps, [{ x: 213, y: 331 }]);
});

test("an open step whose target never shows fails with a message naming the step", async () => {
  const world = playerWorld([statsRest]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { text: "No Such Button", exact: true } }], ready: /take rest/i });
  assert.match(String(result), /open step \{"text":"No Such Button","exact":true\} did not show/);
  assert.deepEqual(world.taps, []);
});

test("expect is not evaluated: a screen that would fail it still plays", async () => {
  const withNotice = parseDump(
    `<hierarchy><node text="Hit Points" bounds="[0,100][200,140]" /><node text="4 to review" bounds="[10,600][200,650]" /></hierarchy>`,
  );
  const world = playerWorld([withNotice]);
  const result = await play(world, { name: "t", route: "/x", ready: /hit points/i, expect: { absentMatching: [/ to review$/] } });
  assert.equal(result, null);
});

// --- Revealing off-screen targets: the dump names its scrollers, and a swipe inside one scrolls it ---

// The scrollers of the character screen, as the dump reports them: the subtab bar (a HorizontalScrollView
// at [32,284][688,392]) and the content (a ScrollView at [0,252][720,1232], ending at the gesture bar).
const HBAR = `<node text="" class="android.widget.HorizontalScrollView" scrollable="true" bounds="[32,284][688,392]" />`;
const CONTENT = `<node text="" class="android.widget.ScrollView" scrollable="true" bounds="[0,252][720,1232]" />`;

test("a tab clipped off the tab bar is revealed by horizontal swipes on the tab bars only", async () => {
  const before = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const after = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Class" bounds="[585,320][650,356]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([before, after]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Ready Here" });
  assert.equal(result, null);
  // The Class subtab at [585,320][650,356] is tapped once revealed; the swipes went left inside the tab
  // bar (y fixed at 338, x from 590 to 130), twice per poll, never in the vertical content scroller.
  assert.deepEqual(world.taps, [{ x: 618, y: 338 }]);
  assert.deepEqual(world.swipes, [
    ["590", "338", "130", "338", "300"],
    ["590", "338", "130", "338", "300"],
  ]);
});

test("the reveal direction flips when a swipe moves nothing, so a tab on the other side is found", async () => {
  const a = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const b = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Class" bounds="[585,320][650,356]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  // The first dump scrolls nowhere (the bar is at its left end), so the second swipe goes right.
  const world = playerWorld([a, a, b]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Ready Here" });
  assert.equal(result, null);
  assert.deepEqual(world.taps, [{ x: 618, y: 338 }]);
  assert.deepEqual(world.swipes, [
    ["590", "338", "130", "338", "300"],
    ["590", "338", "130", "338", "300"],
    ["130", "338", "590", "338", "300"],
    ["130", "338", "590", "338", "300"],
  ]);
});

test("an open step below the fold is revealed by swiping the scrollers, then tapped", async () => {
  const top = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Hit Points" bounds="[0,100][200,140]" /></hierarchy>`);
  const bottom = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Hit Points" bounds="[0,100][200,140]" /><node text="" content-desc="Add language" bounds="[624,1120][688,1184]" /></hierarchy>`);
  const world = playerWorld([top, bottom]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { label: "Add language" } }], ready: "Hit Points" });
  assert.equal(result, null);
  assert.deepEqual(world.taps, [{ x: 656, y: 1152 }]);
  // One reveal round swiped both scrollers twice: the tab bar horizontally and the content vertically
  // (x fixed at 360, y from 1085 to 399 inside [0,252][720,1232]).
  const vertical = world.swipes.filter((s) => s[0] === s[2]);
  assert.deepEqual(vertical, [
    ["360", "1085", "360", "399", "300"],
    ["360", "1085", "360", "399", "300"],
  ]);
});

test("the ready text scrolled off is revealed by swiping the scrollers too", async () => {
  const top = parseDump(`<hierarchy>${CONTENT}<node text="Top" bounds="[0,100][100,140]" /></hierarchy>`);
  const scrolled = parseDump(`<hierarchy>${CONTENT}<node text="Deep Ready" bounds="[0,900][200,940]" /></hierarchy>`);
  const world = playerWorld([top, scrolled]);
  const result = await play(world, { name: "t", route: "/x", ready: "Deep Ready" });
  assert.equal(result, null);
  assert.ok(world.swipes.length >= 1);
});

test("a target that never appears fails after the ready timeout, swipes included", async () => {
  const withScrollers = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([withScrollers]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Nope"], ready: "Ready Here" });
  assert.match(String(result), /tab "Nope" did not show/);
  assert.ok(world.swipes.length > 0);
  assert.equal(world.taps.length, 0);
});
