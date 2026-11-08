import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describeStep } from "../scripts/lib/steps.mjs";
import {
  MAX_SWIPES,
  REVEAL_MARGIN_PX,
  REVEAL_STEP_PX,
  REVEAL_SWIPE_MS,
  findMatches,
  findTarget,
  isVisible,
  playScreen,
  revealSwipeArgs,
  swipeDownArgs,
  swipeUpArgs,
} from "../scripts/lib/native-steps.mjs";
import { centerOf, hasPositiveArea, parseDump } from "../scripts/lib/uiautomator.mjs";

// The native step player (scripts/lib/native-steps.mjs): it plays a scenario's `tabs`, `open`, `modal` and
// `scrollTo` fields on a uiautomator dump, through the injected dump/tap/swipe, in the order the web check
// plays them. The fixtures are real dumps captured on the emulator: the character screen with its tab bar,
// the Stats screen with the "Take Rest" row, and the Stats screen scrolled down to the languages section with
// the "Add language" button. Matching semantics mirror Playwright's getByText/getByLabel.

type DumpNode = ReturnType<typeof parseDump>[number];

const charTabs = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-character-tabs.xml", import.meta.url)), "utf8"));
const statsRest = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-stats-rest.xml", import.meta.url)), "utf8"));
const statsLang = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-stats-languages.xml", import.meta.url)), "utf8"));
// The Builder > Class screen of the seeded character, dumped at the top of the page: the nodes below the
// fold ("Starting Equipment & Gold:", "Claimed") are listed with bounds whose top is below their bottom,
// i.e. clipped out under the gesture bar.
const classOffscreen = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-offscreen.xml", import.meta.url)), "utf8"));
// More real dumps captured on the emulator, all on the Builder screens at 720x1280: the Class tab scrolled
// so "Martial weapon" is only a clipped node below the gesture bar, the same page scrolled a bit further
// so it is on screen, the Class tab with "Fighting Styles" only clipped, and the Background tab's first
// page (with "Languages" below the fold) plus the same page scrolled so "Languages" is only clipped.
const martialClipped = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-martial-clipped.xml", import.meta.url)), "utf8"));
const martialOnscreen = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-martial-onscreen.xml", import.meta.url)), "utf8"));
const fightingClipped = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-fightingstyles-clipped.xml", import.meta.url)), "utf8"));
const backgroundFirst = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-background-firstpage.xml", import.meta.url)), "utf8"));
const backgroundClipped = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-background-languages-clipped.xml", import.meta.url)), "utf8"));
// Two more real dumps captured on the emulator, on the Builder > Class page of the fighter with picked
// equipment at 720x1280: the page scrolled far down (the state the previous scenario's scrollTo leaves
// behind — "Starting Equipment & Gold:" on screen, neither "Builder" nor "Class" in the dump at all,
// the subtab bar scrolled above the viewport, only the main tab bar and the content scroller left in
// the dump) and the same page swiped back to the top ("Class" on screen again).
const classScrolledDown = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-scrolled-down.xml", import.meta.url)), "utf8"));
const classScrolledTop = parseDump(readFileSync(fileURLToPath(new URL("./fixtures/uiautomator-class-scrolled-top.xml", import.meta.url)), "utf8"));

// The screen of the AVD: 720x1280 px, with the 48 px status bar on top and the 48 px gesture bar at the
// bottom (both read from the device; they stay 48 px under a density override).
const VIEW = { width: 720, height: 1280, topBar: 48, bottomBar: 48 };

// A scripted world for playScreen: dump() serves the dumps in order (the last one repeats), tap/swipe/sleep
// record what the player did, and now() is the recorded clock. With `frozen` the clock never advances, and
// `maxDumps` makes dump() throw once it is exceeded, so a loop that only ends on the clock fails instead of
// hanging.
function playerWorld(dumpSequence: DumpNode[][], options: { frozen?: boolean; maxDumps?: number } = {}) {
  const taps: { x: number; y: number }[] = [];
  const swipes: string[][] = [];
  const sleeps: number[] = [];
  let clock = 0;
  let dumpIndex = 0;
  const maxDumps = options.maxDumps ?? Number.POSITIVE_INFINITY;
  return {
    taps,
    swipes,
    sleeps,
    view: VIEW,
    dump: () => {
      if (dumpIndex >= maxDumps) throw new Error(`dump budget of ${maxDumps} exceeded`);
      return dumpSequence[Math.min(dumpIndex++, dumpSequence.length - 1)];
    },
    tap: (point: { x: number; y: number }) => void taps.push(point),
    swipe: (args: number[]) => void swipes.push(args.map(String)),
    sleep: async (ms: number) => {
      sleeps.push(ms);
      if (!options.frozen) clock += ms;
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

// --- Clipped bounds: a node scrolled out of the viewport is listed with an inverted box ---

const clippedEquipment = classOffscreen.find((node) => node.text === "Starting Equipment & Gold:");

test("on the off-screen fixture the clipped node has no positive area: not visible, not a tap target", () => {
  // Real dump: "Starting Equipment & Gold:" at [66,1271][408,1232] — the top is below the bottom.
  assert.ok(clippedEquipment);
  assert.deepEqual(clippedEquipment.bounds, { x1: 66, y1: 1271, x2: 408, y2: 1232 });
  assert.equal(isVisible(clippedEquipment, VIEW), false);
  assert.equal(
    findTarget(classOffscreen, { method: "getByText", arg: "Starting Equipment & Gold:", options: { exact: true }, index: 0 }, VIEW),
    null,
  );
  assert.equal(centerOf(clippedEquipment, VIEW), null);
  // The same for a horizontal clip (x2 <= x1).
  const node = (bounds: DumpNode["bounds"]) => ({ text: "x", contentDesc: "", resourceId: "", className: "", clickable: false, scrollable: false, bounds });
  const hClipped = node({ x1: 700, y1: 100, x2: 690, y2: 140 });
  assert.equal(isVisible(hClipped, VIEW), false);
  assert.equal(centerOf(hClipped, VIEW), null);
});

test("a partially visible node with positive area is a tap target at the centre of its visible part", () => {
  const node = (bounds: DumpNode["bounds"]) => ({ text: "x", contentDesc: "", resourceId: "", className: "", clickable: false, scrollable: false, bounds });
  // Crosses the gesture bar: [66,1200][408,1280], so its visible part ends at 1280-48=1232.
  const partial = node({ x1: 66, y1: 1200, x2: 408, y2: 1280 });
  assert.equal(isVisible(partial, VIEW), false); // not fully inside the screen
  assert.deepEqual(centerOf(partial, VIEW), { x: 237, y: 1216 }); // centre of the visible part only
  // Fully under the gesture bar: positive area but no visible part, so not a tap target.
  assert.equal(centerOf(node({ x1: 0, y1: 1240, x2: 720, y2: 1280 }), VIEW), null);
});

// --- playScreen ---

test("tabs are tapped in order, each followed by a 500 ms wait, then the 300 ms settle", async () => {
  const world = playerWorld([charTabs]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Builder", "Stats"], ready: /points remaining/i });
  assert.deepEqual(result, { error: null, warnings: [] });
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
  assert.match(result.error ?? "", /tab "Stats" did not show/);
  assert.deepEqual(result.warnings, []);
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
  assert.deepEqual(result, { error: null, warnings: [] });
  assert.deepEqual(world.swipes, []);
});

test("scrollTo swipes until a dump shows the needle visible, then stops", async () => {
  // The ready wait takes the first dump; the scroll then sees two dumps without a visible needle (the
  // second has it only clipped under the gesture bar) before one with it visible.
  const world = playerWorld([noNeedle, clippedNeedle, noNeedle, withNeedle]);
  const result = await play(world, scrollScreen);
  assert.equal(result.error, null);
  assert.deepEqual(result.warnings, []);
  assert.equal(world.swipes.length, 2);
  assert.deepEqual(world.swipes[0], ["360", "896", "360", "384", "300"]);
});

test("an absent scrollTo needle warns (naming scenario and needle) and does not fail, and the page is scrolled back to the top", async () => {
  // No dump ever shows the needle: after the bounded search the player warns instead of failing, and
  // swipes back to the top, where the web check's scrollIntoView leaves the page for an absent element.
  const world = playerWorld([noNeedle]);
  const result = await play(world, scrollScreen);
  assert.equal(result.error, null);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /scrollTo "Starting Equipment"/);
  assert.match(result.warnings[0], /scenario "t"/);
  assert.match(result.warnings[0], new RegExp(`${MAX_SWIPES} swipes`));
  // The search swipes plus the scroll back to the top; the last swipe is a mid-screen finger-down.
  assert.equal(world.swipes.length, MAX_SWIPES + 1);
  assert.deepEqual(world.swipes.at(-1), ["360", "384", "360", "896", "300"]);
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
  assert.equal(result.error, null);
  assert.deepEqual(world.swipes, [
    ["360", "896", "360", "384", "300"],
    ["360", "384", "360", "896", "300"],
  ]);
  assert.deepEqual(world.taps, []);
});

// The same fixture with the needle revealed: "Starting Equipment & Gold:" has real bounds inside the screen.
const classRevealed = classOffscreen.map((node) =>
  node.text === "Starting Equipment & Gold:" ? { ...node, bounds: { x1: 66, y1: 900, x2: 408, y2: 940 } } : node,
);

test("scrollTo swipes past a needle that is only clipped, and stops once its bounds are real and on screen", async () => {
  // The ready wait takes the first dump; the scroll then sees the off-screen fixture (needle only
  // clipped) before the revealed one.
  const world = playerWorld([classOffscreen, classOffscreen, classRevealed]);
  const result = await play(world, { name: "t", route: "/x", ready: /total level/i, scrollTo: "Starting Equipment" });
  assert.equal(result.error, null);
  assert.equal(world.swipes.length, 1);
  assert.deepEqual(world.swipes[0], ["360", "896", "360", "384", "300"]);
});

test("an open step whose target is only clipped swipes to reveal it, then taps the real centre", async () => {
  const world = playerWorld([classOffscreen, classOffscreen, classRevealed]);
  const result = await play(world, {
    name: "t",
    route: "/x",
    open: [{ tap: { text: "Starting Equipment & Gold:", exact: true } }],
    ready: /total level/i,
  });
  assert.equal(result.error, null);
  assert.ok(world.swipes.length > 0, "the reveal swipes run before the tap");
  // The tap lands on the revealed node's centre (237,920), not on the gesture bar.
  assert.deepEqual(world.taps, [{ x: 237, y: 920 }]);
});

test("a modal is waited for as the ready text and is not tapped", async () => {
  const modalDump = parseDump(
    `<hierarchy><node text="Take Rest (Short / Long)" bounds="[80,298][346,364]" /><node text="Rest &amp; Recovery" bounds="[100,400][620,450]" /></hierarchy>`,
  );
  const world = playerWorld([statsRest, modalDump]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { pattern: "^Take Rest" } }], modal: "Rest & Recovery" });
  assert.equal(result.error, null);
  // Only the Take Rest row is tapped (its centre is 213,331); the dialog title at [100,400][620,450] (centre
  // 360,425) is waited for, never tapped. The settle wait is the modal's 500 ms.
  assert.deepEqual(world.taps, [{ x: 213, y: 331 }]);
  assert.deepEqual(world.sleeps, [500]);
});

test("a modal that never shows fails the scenario as the ready text", async () => {
  const world = playerWorld([statsRest]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { pattern: "^Take Rest" } }], modal: "Rest & Recovery" });
  assert.match(result.error ?? "", /ready text "Rest & Recovery" did not show/);
  assert.deepEqual(world.taps, [{ x: 213, y: 331 }]);
});

test("an open step whose target never shows fails with a message naming the step", async () => {
  const world = playerWorld([statsRest]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { text: "No Such Button", exact: true } }], ready: /take rest/i });
  assert.match(result.error ?? "", /open step \{"text":"No Such Button","exact":true\} did not show/);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(world.taps, []);
});

test("expect is not evaluated: a screen that would fail it still plays", async () => {
  const withNotice = parseDump(
    `<hierarchy><node text="Hit Points" bounds="[0,100][200,140]" /><node text="4 to review" bounds="[10,600][200,650]" /></hierarchy>`,
  );
  const world = playerWorld([withNotice]);
  const result = await play(world, { name: "t", route: "/x", ready: /hit points/i, expect: { absentMatching: [/ to review$/] } });
  assert.deepEqual(result, { error: null, warnings: [] });
});

// --- Revealing off-screen targets: the dump names its scrollers, and a swipe inside one scrolls it ---

// The scrollers of the character screen, as the dump reports them: the subtab bar (a HorizontalScrollView
// at [32,284][688,392]) and the content (a ScrollView at [0,252][720,1232], ending at the gesture bar).
const HBAR = `<node text="" class="android.widget.HorizontalScrollView" scrollable="true" bounds="[32,284][688,392]" />`;
const CONTENT = `<node text="" class="android.widget.ScrollView" scrollable="true" bounds="[0,252][720,1232]" />`;

test("a tab the dump does not list at all is reached by a page swipe toward the top first, then a horizontal swipe in the tab bar", async () => {
  const before = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const after = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Class" bounds="[585,320][650,356]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([before, after]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Ready Here" });
  assert.equal(result.error, null);
  // The Class subtab at [585,320][650,356] is tapped once revealed. The dump lists no "Class" node, so
  // the page is swiped down first (vertical, toward the top, inside the content scroller, slow), and
  // the horizontal swipe in the tab bar follows (y fixed at 338, x from 624 to 96 over the slow
  // REVEAL_SWIPE_MS, clear of the edge back-gesture zone).
  assert.deepEqual(world.taps, [{ x: 618, y: 338 }]);
  assert.deepEqual(world.swipes, [
    ["360", "260", "360", "860", String(REVEAL_SWIPE_MS)],
    ["624", "338", "96", "338", String(REVEAL_SWIPE_MS)],
  ]);
});

test("the reveal direction flips when a swipe moves nothing, so a tab on the other side is found", async () => {
  const a = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const b = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Builder" bounds="[80,187][157,220]" /><node text="Class" bounds="[585,320][650,356]" /><node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  // The first dump scrolls nowhere (the bar is at its left end), so the second round goes the other way
  // on both axes: the page swipe flips to up and the bar swipe to right.
  const world = playerWorld([a, a, b]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Ready Here" });
  assert.equal(result.error, null);
  assert.deepEqual(world.taps, [{ x: 618, y: 338 }]);
  assert.deepEqual(world.swipes, [
    ["360", "260", "360", "860", String(REVEAL_SWIPE_MS)],
    ["624", "338", "96", "338", String(REVEAL_SWIPE_MS)],
    ["360", "1184", "360", "584", String(REVEAL_SWIPE_MS)],
    ["96", "338", "624", "338", String(REVEAL_SWIPE_MS)],
  ]);
});

test("an open step below the fold is revealed by swiping the vertical scroller, then tapped", async () => {
  const top = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Hit Points" bounds="[0,100][200,140]" /></hierarchy>`);
  const bottom = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Hit Points" bounds="[0,100][200,140]" /><node text="" content-desc="Add language" bounds="[624,1120][688,1184]" /></hierarchy>`);
  const world = playerWorld([top, bottom]);
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { label: "Add language" } }], ready: "Hit Points" });
  assert.equal(result.error, null);
  assert.deepEqual(world.taps, [{ x: 656, y: 1152 }]);
  // One reveal round swiped the content scroller once, a fixed slow step up inside [0,252][720,1232]
  // (x fixed at 360, y from 1184 to 584 over REVEAL_SWIPE_MS); the horizontal tab bar is not swiped.
  assert.deepEqual(world.swipes, [["360", "1184", "360", String(1184 - REVEAL_STEP_PX), String(REVEAL_SWIPE_MS)]]);
});

test("the ready text scrolled off is revealed by swiping the scrollers too", async () => {
  const top = parseDump(`<hierarchy>${CONTENT}<node text="Top" bounds="[0,100][100,140]" /></hierarchy>`);
  const scrolled = parseDump(`<hierarchy>${CONTENT}<node text="Deep Ready" bounds="[0,900][200,940]" /></hierarchy>`);
  const world = playerWorld([top, scrolled]);
  const result = await play(world, { name: "t", route: "/x", ready: "Deep Ready" });
  assert.equal(result.error, null);
  assert.ok(world.swipes.length >= 1);
});

test("a target that never appears fails at the swipe bound, not the clock", async () => {
  const withScrollers = parseDump(`<hierarchy>${HBAR}${CONTENT}<node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([withScrollers]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Nope"], ready: "Ready Here" });
  assert.match(result.error ?? "", /tab "Nope" did not show/);
  assert.match(result.error ?? "", new RegExp(`${MAX_SWIPES} swipes`));
  assert.equal(world.swipes.length, MAX_SWIPES);
  assert.equal(world.taps.length, 0);
});

test("a screen that has not rendered yet (no scrollers in the dump) is waited on the clock only, with no swipes", async () => {
  const loading = parseDump(`<hierarchy><node text="Loading" bounds="[0,100][100,140]" /></hierarchy>`);
  const world = playerWorld([loading]);
  const result = await play(world, { name: "t", route: "/x", ready: "Never There" });
  assert.match(result.error ?? "", /ready text "Never There" did not show within 1 s/);
  assert.deepEqual(world.swipes, []);
});

// --- The widened reveal: what the dump says steers the swipe, and the bound is a swipe count ---

test("on the real Class-tab fixtures \"Martial weapon\" is only a clipped node in one and on screen in the other", () => {
  const call = { method: "getByText", arg: "Martial weapon", options: { exact: true }, index: 0 } as const;
  // Real dump: "Martial weapon" at [166,1249][346,1232] — clipped under the gesture bar, inverted bounds.
  const clippedNode = findMatches(martialClipped, call)[0];
  assert.deepEqual(clippedNode.bounds, { x1: 166, y1: 1249, x2: 346, y2: 1232 });
  assert.equal(hasPositiveArea(clippedNode.bounds), false);
  assert.equal(isVisible(clippedNode, VIEW), false);
  assert.equal(findTarget(martialClipped, call, VIEW), null);
  // The same page scrolled a little further: "Martial weapon" at [166,1084][346,1120], fully on screen.
  const onNode = findTarget(martialOnscreen, call, VIEW);
  assert.ok(onNode);
  assert.deepEqual(onNode.bounds, { x1: 166, y1: 1084, x2: 346, y2: 1120 });
  assert.deepEqual(centerOf(onNode, VIEW), { x: 256, y: 1102 });
});

test("on the real fixtures \"Fighting Styles\" is clipped below the fold, and \"Languages\" is below the fold on the Background first page", () => {
  const fsCall = { method: "getByText", arg: "Fighting Styles", options: { exact: true }, index: 0 } as const;
  const fsNode = findMatches(fightingClipped, fsCall)[0];
  assert.deepEqual(fsNode.bounds, { x1: 66, y1: 1264, x2: 430, y2: 1232 });
  assert.equal(hasPositiveArea(fsNode.bounds), false);
  assert.equal(findTarget(fightingClipped, fsCall, VIEW), null);
  // The Background tab's first page does not even list "Languages" (it is below the fold), and scrolled
  // a little it is a clipped node at [66,1276][610,1232].
  const langCall = { method: "getByText", arg: "Languages", options: { exact: true }, index: 0 } as const;
  assert.equal(findMatches(backgroundFirst, langCall).length, 0);
  assert.equal(findTarget(backgroundFirst, langCall, VIEW), null);
  const langNode = findMatches(backgroundClipped, langCall)[0];
  assert.deepEqual(langNode.bounds, { x1: 66, y1: 1276, x2: 610, y2: 1232 });
  assert.equal(hasPositiveArea(langNode.bounds), false);
});

test("a clipped target steers the reveal swipe: below the fold means finger up, by the gap plus a margin, slowly", async () => {
  // Real dumps: "Martial weapon" clipped at [166,1249][346,1232] (visible bottom 1232), then on screen.
  const world = playerWorld([martialClipped, martialOnscreen]);
  const result = await play(world, {
    name: "t",
    route: "/x",
    open: [{ tap: { text: "Martial weapon", exact: true } }],
    ready: "Starting Equipment & Gold:",
  });
  assert.deepEqual(result, { error: null, warnings: [] });
  // One guided swipe inside the content ScrollView [0,252][720,1232]: the gap is 1249-1232=17 px, plus the
  // margin, so the finger goes from y 1184 up by 17+margin over REVEAL_SWIPE_MS.
  const distance = 1249 - 1232 + REVEAL_MARGIN_PX;
  assert.deepEqual(world.swipes, [["360", "1184", "360", String(1184 - distance), String(REVEAL_SWIPE_MS)]]);
  // Then the tap lands on the on-screen node's centre.
  assert.deepEqual(world.taps, [{ x: 256, y: 1102 }]);
});

test("a clipped \"Languages\" on the real Background fixture steers the same guided swipe", async () => {
  const revealed = backgroundClipped.map((node) =>
    node.text === "Languages" ? { ...node, bounds: { x1: 66, y1: 800, x2: 610, y2: 838 } } : node,
  );
  const world = playerWorld([backgroundClipped, revealed]);
  const result = await play(world, {
    name: "t",
    route: "/x",
    open: [{ tap: { text: "Languages", exact: true } }],
    ready: "Background Benefits:",
  });
  assert.deepEqual(result, { error: null, warnings: [] });
  const distance = 1276 - 1232 + REVEAL_MARGIN_PX;
  assert.deepEqual(world.swipes, [["360", "1184", "360", String(1184 - distance), String(REVEAL_SWIPE_MS)]]);
  assert.deepEqual(world.taps, [{ x: 338, y: 819 }]);
});

test("the reveal ends at the swipe bound even when the clock never advances", async () => {
  // A frozen clock: a loop bounded by the clock would never end (the dump budget makes it fail instead of
  // hanging); the swipe bound ends it after MAX_SWIPES swipes.
  const withScrollers = parseDump(`<hierarchy>${CONTENT}<node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([withScrollers], { frozen: true, maxDumps: 200 });
  const result = await play(world, {
    name: "t",
    route: "/x",
    open: [{ tap: { text: "Never There", exact: true } }],
    ready: "Ready Here",
  });
  assert.match(result.error ?? "", /open step \{"text":"Never There","exact":true\} did not show/);
  assert.match(result.error ?? "", new RegExp(`${MAX_SWIPES} swipes`));
  assert.equal(world.swipes.length, MAX_SWIPES);
});

test("a ready text that exists only as a clipped node counts as ready (AC-13: at any scroll position)", async () => {
  // The dump lists the ready text only with inverted (clipped) bounds, scrolled out of the viewport:
  // it is in the hierarchy, so it counts as shown, and nothing is swiped or tapped.
  const clippedOnly = parseDump(`<hierarchy><node text="Deep Ready" bounds="[0,1300][200,1250]" /></hierarchy>`);
  const world = playerWorld([clippedOnly]);
  const result = await play(world, { name: "t", route: "/x", ready: "Deep Ready" });
  assert.deepEqual(result, { error: null, warnings: [] });
  assert.deepEqual(world.swipes, []);
  assert.deepEqual(world.taps, []);
});

test("the ready text absent from the dump is searched by swiping in both directions", async () => {
  // The page is mid-page (the ready text at the top is not in the dump); three identical dumps flip the
  // direction up -> down -> up, and the fourth shows the ready text. The ready timeout (1 s here) would
  // have cut the search after two polls.
  const mid = parseDump(`<hierarchy>${CONTENT}<node text="Mid Page" bounds="[0,400][100,440]" /></hierarchy>`);
  const top = parseDump(`<hierarchy>${CONTENT}<node text="Deep Ready" bounds="[0,100][200,140]" /></hierarchy>`);
  const world = playerWorld([mid, mid, mid, top]);
  const result = await play(world, { name: "t", route: "/x", ready: "Deep Ready" });
  assert.deepEqual(result, { error: null, warnings: [] });
  const up = ["360", "1184", "360", String(1184 - REVEAL_STEP_PX), String(REVEAL_SWIPE_MS)];
  const down = ["360", "260", "360", String(260 + REVEAL_STEP_PX), String(REVEAL_SWIPE_MS)];
  assert.deepEqual(world.swipes, [up, down, up]);
});

test("a reveal swipe on a full-screen scroller stays out of the edge back-gesture zone and the gesture bar", async () => {
  const node = (bounds: DumpNode["bounds"], cls = "android.widget.ScrollView") =>
    ({ text: "", contentDesc: "", resourceId: "", className: cls, clickable: false, scrollable: true, bounds });
  // Vertical, full-screen scroller: the finger stays above the gesture bar (1280-48) ...
  assert.deepEqual(revealSwipeArgs(node({ x1: 0, y1: 0, x2: 720, y2: 1280 }), false, "up", 600, VIEW), [360, 1184, 360, 584, 800]);
  assert.deepEqual(revealSwipeArgs(node({ x1: 0, y1: 0, x2: 720, y2: 1280 }), false, "down", 600, VIEW), [360, 96, 360, 696, 800]);
  // ... and horizontal swipes on a full-width bar stay 48 px clear of the side edges (back gesture).
  assert.deepEqual(
    revealSwipeArgs(node({ x1: 0, y1: 162, x2: 720, y2: 250 }, "android.widget.HorizontalScrollView"), true, "left", 600, VIEW),
    [624, 206, 96, 206, 800],
  );
  assert.deepEqual(
    revealSwipeArgs(node({ x1: 0, y1: 162, x2: 720, y2: 250 }, "android.widget.HorizontalScrollView"), true, "right", 600, VIEW),
    [96, 206, 624, 206, 800],
  );
});

// --- Reaching a tab from any scroll position: the page is scrolled back toward the tab bars first ---

const classCall = { method: "getByText", arg: "Class", options: { exact: true }, index: 0 } as const;
const builderCall = { method: "getByText", arg: "Builder", options: { exact: true }, index: 0 } as const;
// The content scroller and the main tab bar of the scrolled-down fixture.
const scrolledContent = classScrolledDown.find((n) => n.scrollable && n.className === "android.widget.ScrollView");
const scrolledBar = classScrolledDown.find((n) => n.scrollable && n.className === "android.widget.HorizontalScrollView");

test("on the real scrolled-down fixture neither tab is in the dump and only the main tab bar remains; at the top \"Class\" is on screen", () => {
  assert.equal(findMatches(classScrolledDown, classCall).length, 0);
  assert.equal(findMatches(classScrolledDown, builderCall).length, 0);
  assert.equal(findTarget(classScrolledDown, classCall, VIEW), null);
  assert.equal(findTarget(classScrolledDown, builderCall, VIEW), null);
  // "Starting Equipment & Gold:" is the visible needle the previous scenario scrolled to.
  assert.ok(classScrolledDown.some((n) => n.text === "Starting Equipment & Gold:" && isVisible(n, VIEW)));
  assert.deepEqual(
    classScrolledDown.filter((n) => n.scrollable).map((n) => `${n.className} ${JSON.stringify(n.bounds)}`),
    [
      'android.widget.HorizontalScrollView {"x1":0,"y1":162,"x2":720,"y2":250}',
      'android.widget.ScrollView {"x1":0,"y1":252,"x2":720,"y2":1232}',
    ],
  );
  // Swiped back to the top, the subtab bar is in the dump again and "Class" is a tap target.
  const topClass = findTarget(classScrolledTop, classCall, VIEW);
  assert.deepEqual(topClass?.bounds, { x1: 587, y1: 320, x2: 652, y2: 356 });
});

test("a tab scrolled out of the page is reached by swiping the page down first, then the tab bar, and tapped", async () => {
  const world = playerWorld([classScrolledDown, classScrolledTop]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Total Level: 1" });
  assert.deepEqual(result, { error: null, warnings: [] });
  // The first swipe is vertical, toward the top of the page, inside the content scroller, slow ...
  assert.deepEqual(world.swipes[0], revealSwipeArgs(scrolledContent, false, "down", REVEAL_STEP_PX, VIEW).map(String));
  // ... and only then a horizontal swipe in the main tab bar.
  assert.deepEqual(world.swipes[1], revealSwipeArgs(scrolledBar, true, "left", REVEAL_STEP_PX, VIEW).map(String));
  // The dump after the page swipe shows the subtab bar with "Class" on screen, tapped at its centre.
  assert.deepEqual(world.taps, [{ x: 620, y: 338 }]);
});

test("a main-bar tab absent from the scrolled-down dump is revealed horizontally once the page is back at the top", async () => {
  // The top fixture still has the main bar scrolled past "Builder"; the dump with the tab back in the
  // bar stands in for the bar's own horizontal scroll.
  const builderAtTop = [
    ...classScrolledTop,
    { text: "Builder", contentDesc: "", resourceId: "", className: "android.widget.TextView", clickable: false, scrollable: false, bounds: { x1: 80, y1: 187, x2: 157, y2: 220 } },
  ];
  const world = playerWorld([classScrolledDown, classScrolledTop, builderAtTop]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Builder"], ready: "Total Level: 1" });
  assert.deepEqual(result, { error: null, warnings: [] });
  // The page is swiped down (vertical, toward the top) before any horizontal swipe ...
  assert.deepEqual(world.swipes[0], revealSwipeArgs(scrolledContent, false, "down", REVEAL_STEP_PX, VIEW).map(String));
  // ... and the horizontal bar swipe follows in the same round.
  assert.deepEqual(world.swipes[1], revealSwipeArgs(scrolledBar, true, "left", REVEAL_STEP_PX, VIEW).map(String));
  assert.deepEqual(world.taps, [{ x: 119, y: 204 }]);
});

test("a tab already on screen is tapped at once, with no swipe", async () => {
  const world = playerWorld([classScrolledTop]);
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Total Level: 1" });
  assert.deepEqual(result, { error: null, warnings: [] });
  assert.deepEqual(world.taps, [{ x: 620, y: 338 }]);
  assert.deepEqual(world.swipes, []);
});

test("the vertical page search ends at the swipe bound when the clock never advances", async () => {
  // The scrolled-down fixture without the main tab bar: no horizontal scroller left to swipe, only
  // the content scroller. A frozen clock would never end a clock-bounded wait (the dump budget makes
  // that fail instead of hanging); the swipe bound ends the search.
  const noBar = classScrolledDown.filter((n) => !n.className.includes("HorizontalScrollView"));
  const world = playerWorld([noBar], { frozen: true, maxDumps: 200 });
  const result = await play(world, { name: "t", route: "/x", tabs: ["Class"], ready: "Total Level: 1" });
  assert.match(result.error ?? "", /tab "Class" did not show/);
  assert.match(result.error ?? "", new RegExp(`${MAX_SWIPES} swipes`));
  assert.equal(world.swipes.length, MAX_SWIPES);
  // Every swipe is the vertical page swipe, down first, flipping when the dump does not move.
  const content = noBar.find((n) => n.scrollable);
  assert.deepEqual(world.swipes[0], revealSwipeArgs(content, false, "down", REVEAL_STEP_PX, VIEW).map(String));
  assert.deepEqual(world.swipes[1], revealSwipeArgs(content, false, "up", REVEAL_STEP_PX, VIEW).map(String));
  for (const s of world.swipes) assert.equal(s[0], s[2]);
});

test("an open step whose dump has no vertical scroller gets the same page fallback, bounded by swipes", async () => {
  // Only the horizontal tab bar is scrollable: the vertical reveal has no scroller of its own, so the
  // page itself is swiped mid-screen, finger down toward the top first.
  const onlyBar = parseDump(`<hierarchy>${HBAR}<node text="Ready Here" bounds="[0,400][100,440]" /></hierarchy>`);
  const world = playerWorld([onlyBar], { frozen: true, maxDumps: 200 });
  const result = await play(world, { name: "t", route: "/x", open: [{ tap: { text: "Never There", exact: true } }], ready: "Ready Here" });
  assert.match(result.error ?? "", /open step \{"text":"Never There","exact":true\} did not show/);
  assert.match(result.error ?? "", new RegExp(`${MAX_SWIPES} swipes`));
  assert.equal(world.swipes.length, MAX_SWIPES);
  assert.deepEqual(world.swipes[0], swipeDownArgs(VIEW).map(String));
  assert.deepEqual(world.swipes[1], swipeUpArgs(VIEW).map(String));
});
