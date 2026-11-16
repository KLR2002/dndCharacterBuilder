// Rolls expressions on the running emulator through the dice tray and checks that the die labels match
// the result chips: `npm run android:roll -- [--mode throw|tumble|off] [--shots <dir>] [--record] <expression>...`.
// It needs exactly one emulator (serial emulator-*, in state device) with the app installed, and boots,
// builds and installs nothing. With --mode it sets the Dice animation first, through the Options screen by
// deep link. Each expression clears logcat, opens the tray, types the expression, closes the keyboard,
// taps the Roll button, waits until the result card exists and its die labels stop changing between two
// dumps (or 40 s), takes a screenshot, and counts the FATAL EXCEPTION lines in logcat. Every element is
// found in a uiautomator dump by its resource-id or content-desc, never by fixed coordinates. The pure
// helpers are in scripts/lib/android-roll.mjs and their tests in checks/androidRoll.test.ts; the device
// plumbing reuses scripts/lib/android-runner.mjs and scripts/lib/uiautomator.mjs. Exit codes: 0 every
// expression passes, 1 a label differs from its chip, a FATAL appears or a wait times out, 2 a refusal or a
// bad argument.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { APP_ID, deepLinkForRoute, isEmulatorSerial, parseAdbDevices, parseSystemBarHeights, parseWmSize, sdkPaths } from "./lib/android-runner.mjs";
import { parseDumpOutput } from "./lib/uiautomator.mjs";
import {
  compareDice,
  dieLabels,
  chipsOf,
  fatalCount,
  findNodeById,
  findRollButton,
  formatResultLine,
  inputTextArg,
  optionsSwipeArgs,
  parseRollArgs,
  resolveMode,
  revealSwipe,
  scrollerOf,
  LABEL_CAPS,
  uncoveredTapPoint,
  usage,
} from "./lib/android-roll.mjs";

const ADB_TIMEOUT_MS = 60_000;
const DUMP_TIMEOUT_MS = 30_000;
const CAPTURE_TIMEOUT_MS = 60_000;
const SETTLE_TIMEOUT_MS = 40_000;
const SETTLE_POLL_MS = 500;
const FIND_TIMEOUT_MS = 10_000;
const FIND_POLL_MS = 500;
const RECORD_SECONDS = 12;
// Backspaces sent to empty the Roll Expression field before an expression is typed: more than any expression the
// tray takes, and a delete on an empty field does nothing.
const CLEAR_FIELD_DELETES = 40;
const MAX_OPTIONS_SWIPES = 25;

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// One synchronous adb call: its output captured, bounded by a timeout, a missing binary reported as code 1.
function run(command, args, timeoutMs = ADB_TIMEOUT_MS) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (result.error) return { code: 1, stdout: result.stdout ?? "", stderr: String(result.error) };
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function refuse(message) {
  console.error(`android:roll: ${message}`);
  process.exit(2);
}

// The device's current hierarchy, parsed; an empty list when the dump fails or does not complete.
function dumpNodes(adb, serial) {
  const dumped = run(adb, ["-s", serial, "exec-out", "uiautomator", "dump", "/dev/tty"], DUMP_TIMEOUT_MS);
  if (dumped.code !== 0) return [];
  return parseDumpOutput(dumped.stdout) ?? [];
}

// Polls dumps until `find` returns a node, or the timeout passes. Returns the node or null.
async function waitForNode(dump, find, timeoutMs = FIND_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const nodes = dump();
    const found = find(nodes);
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await sleep(FIND_POLL_MS);
  }
}

// Taps the centre of a node's visible part (uncovered by another clickable node), or reports why it cannot.
function tapNode(adb, serial, nodes, node) {
  const view = currentView;
  const point = uncoveredTapPoint(node, view, nodes);
  if (!point) return false;
  run(adb, ["-s", serial, "shell", "input", "tap", String(point.x), String(point.y)]);
  return true;
}

// Whether the soft keyboard is shown, from the input method service's state.
function keyboardShown(adb, serial) {
  return /mInputShown=true/.test(run(adb, ["-s", serial, "shell", "dumpsys", "input_method"]).stdout);
}

// Taps the node `find` returns once it is uncovered: a screen mid-transition can list a button under another
// clickable node for a poll or two, so the tap is retried on fresh dumps until FIND_TIMEOUT_MS passes.
async function tapWhen(adb, serial, dump, find) {
  const deadline = Date.now() + FIND_TIMEOUT_MS;
  for (;;) {
    const nodes = dump();
    const node = find(nodes);
    if (node && tapNode(adb, serial, nodes, node)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(FIND_POLL_MS);
  }
}

let currentView = null;

// Sets the Dice animation: opens Options by deep link, swipes until the mode's node is visible, taps it,
// and returns home by deep link.
async function setMode(adb, serial, mode, dump) {
  const open = (route) => run(adb, ["-s", serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `"${deepLinkForRoute(route)}"`, APP_ID]);
  if (open("/options").code !== 0) return `could not open Options by deep link`;
  const id = `dice-animation-${mode}`;
  let tapped = false;
  for (let swipes = 0; swipes <= MAX_OPTIONS_SWIPES && !tapped; swipes++) {
    await sleep(swipes === 0 ? 800 : 400);
    const nodes = dump();
    const node = findNodeById(nodes, id);
    if (node && uncoveredTapPoint(node, currentView, nodes)) {
      tapped = tapNode(adb, serial, nodes, node);
      if (!tapped) return `${id} is covered on screen and no uncovered point of it exists`;
      break;
    }
    if (swipes < MAX_OPTIONS_SWIPES) {
      const scroller = scrollerOf(nodes);
      const { direction, distance } = revealSwipe(node, scroller);
      const args = optionsSwipeArgs(currentView, direction, scroller, distance);
      run(adb, ["-s", serial, "shell", "input", "swipe", ...args.map(String)]);
    }
  }
  if (!tapped) return `no node ${id} on the Options screen`;
  await sleep(500);
  open("/");
  return null;
}

// Runs one expression. Returns { result, fatal, shot } where result is compareDice's result or { ok: false, error }.
async function rollOne({ adb, serial, expression, index, mode, shotsDir, record }) {
  const dump = () => dumpNodes(adb, serial);
  const shell = (...args) => run(adb, ["-s", serial, "shell", ...args]);
  const fail = (error) => ({ result: { ok: false, error }, fatal: 0, shot: null });

  // A result card left over from the previous roll covers the dice button and would settle at once: it is dismissed
  // when it has a Dismiss button, and the wait for it to leave the screen is bounded.
  const cardGone = async () => {
    const deadline = Date.now() + FIND_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const nodes = dump();
      if (!findNodeById(nodes, "result-card")) return true;
      const dismiss = nodes.find((node) => node.contentDesc === "Dismiss result" && node.clickable && node.bounds);
      if (dismiss) tapNode(adb, serial, nodes, dismiss);
      await sleep(FIND_POLL_MS);
    }
    return false;
  };
  if (!(await cardGone())) return fail("a result card stays open and does not leave the screen");

  run(adb, ["-s", serial, "logcat", "-c"]);

  // The dice button is tapped only with the tray shut: a tap computed from a dump in which the tray is open
  // could land on a row of the Home list once the tray closes.
  const trayOpen = (nodes) => nodes.some((node) => node.contentDesc === "Roll Expression" && node.bounds);
  if (!(await tapWhen(adb, serial, dump, (nodes) => (trayOpen(nodes) ? null : findNodeById(nodes, "dice-button"))))) {
    return fail("the dice-button is never uncovered on Home");
  }

  if (!(await tapWhen(adb, serial, dump, (nodes) => nodes.find((node) => node.contentDesc === "Roll Expression" && node.bounds)))) {
    return fail("the Roll Expression field is never uncovered in the tray");
  }
  await sleep(400);

  // The field keeps what was typed before, so the cursor goes to the end and the text is deleted first.
  shell("input", "keyevent", "KEYCODE_MOVE_END", ...Array(CLEAR_FIELD_DELETES).fill("KEYCODE_DEL"));
  await sleep(200);
  shell("input", "text", inputTextArg(expression));
  await sleep(300);
  // BACK closes a shown soft keyboard and nothing else; with the hardware keyboard the soft one is not
  // shown and BACK would close the tray, so it is pressed only when the input method reports it shown.
  if (keyboardShown(adb, serial)) {
    shell("input", "keyevent", "KEYCODE_BACK");
    await sleep(500);
  }
  const rollShown = await waitForNode(dump, (nodes) => findRollButton(nodes, expression));
  if (!rollShown) return fail("the tray closed when the keyboard was dismissed (no Roll button)");

  const remote = `/sdcard/android-roll-${index}.mp4`;
  let recordStart = 0;
  if (record) {
    shell(`screenrecord --time-limit ${RECORD_SECONDS} ${remote} &`);
    recordStart = Date.now();
    await sleep(500);
  }
  // The Roll button is tapped only in a dump that shows the tray (see the dice button above).
  if (!(await tapWhen(adb, serial, dump, (nodes) => (trayOpen(nodes) ? findRollButton(nodes, expression) : null)))) {
    return fail("the Roll button is never uncovered");
  }

  // The result card carries the chips. A Throw's die labels are drawn while the dice fly and are gone when the card
  // shows, so they come from the last dump before the card that holds the most labels; a Tumble's labels sit in the
  // card itself. Waits up to SETTLE_TIMEOUT_MS for the card.
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let flight = null;
  let card = null;
  while (card === null && Date.now() < deadline) {
    await sleep(SETTLE_POLL_MS);
    const nodes = dump();
    if (findNodeById(nodes, "result-card")) card = nodes;
    else if (dieLabels(nodes).labels.length > (flight ? dieLabels(flight).labels.length : 0)) flight = nodes;
  }
  if (card === null) return fail(`timed out after ${SETTLE_TIMEOUT_MS / 1000} s waiting for the result card`);
  const labelSource = dieLabels(card).labels.length > 0 ? card : flight;
  const labelCount = labelSource ? dieLabels(labelSource).labels.length : 0;
  const cap = LABEL_CAPS[mode];
  const expectedLabels = mode === "off" ? 0 : cap === undefined ? null : Math.min(chipsOf(card).length, cap);
  if (expectedLabels !== null && labelCount !== expectedLabels) {
    return fail(`${labelCount} die labels seen while the dice flew, expected ${expectedLabels}`);
  }

  const fileBase = `${index}-${expression.replace(/\W+/g, "-")}`;
  const shotRemote = `/sdcard/android-roll-${index}.png`;
  shell("screencap", "-p", shotRemote);
  const shot = join(shotsDir, `${fileBase}.png`);
  const pulledShot = run(adb, ["-s", serial, "pull", shotRemote, shot], CAPTURE_TIMEOUT_MS);
  shell("rm", "-f", shotRemote);

  if (record) {
    const elapsed = Date.now() - recordStart;
    await sleep(Math.max(0, (RECORD_SECONDS + 1) * 1000 - elapsed));
    const pulledVideo = run(adb, ["-s", serial, "pull", remote, join(shotsDir, `${fileBase}.mp4`)], CAPTURE_TIMEOUT_MS);
    shell("rm", "-f", remote);
    if (pulledVideo.code !== 0) console.error(`android:roll: could not pull the recording: ${pulledVideo.stderr.trim()}`);
  }

  const fatal = fatalCount(run(adb, ["-s", serial, "logcat", "-d"]).stdout);
  const labels = labelSource ? dieLabels(labelSource) : { kind: null, labels: [] };
  const resolved = resolveMode(mode, labels.kind);
  const result = compareDice({ mode: resolved, labels: labels.labels, chips: chipsOf(card) });
  if (pulledShot.code !== 0) return { result: { ...result, ok: false, error: "screenshot pull failed" }, fatal, shot: null };
  return { result, fatal, shot, resolved };
}

async function main(argv, env) {
  const args = parseRollArgs(argv);
  if (!args.ok) refuse(`${args.error}\n${usage()}`);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  const { adb } = sdkPaths({ env, homeDir: homedir() });
  const listed = run(adb, ["devices"]);
  if (listed.code !== 0) refuse(`adb devices failed: ${listed.stderr.trim() || listed.stdout.trim()}`);
  const devices = parseAdbDevices(listed.stdout);
  if (devices.length !== 1) refuse(`need exactly one device, found ${devices.length} (${devices.map((d) => d.serial).join(", ") || "none"}); start one emulator`);
  const [{ serial, state }] = devices;
  if (!isEmulatorSerial(serial)) refuse(`${serial} is not an emulator (serial must start with emulator-)`);
  if (state !== "device") refuse(`${serial} is ${state}, not ready`);

  const installed = run(adb, ["-s", serial, "shell", "pm", "list", "packages", APP_ID]);
  if (!installed.stdout.includes(`package:${APP_ID}`)) refuse(`${APP_ID} is not installed on ${serial}`);

  const size = parseWmSize(run(adb, ["-s", serial, "shell", "wm", "size"]).stdout);
  if (!size) refuse("could not read the screen size");
  const bars = parseSystemBarHeights(run(adb, ["-s", serial, "shell", "dumpsys", "window", "windows"]).stdout);
  currentView = { width: size.width, height: size.height, ...bars };

  const shotsDir = args.shots ?? mkdtempSync(join(tmpdir(), "android-roll-"));
  mkdirSync(shotsDir, { recursive: true });
  console.log(`Screenshots: ${shotsDir}`);

  const dump = () => dumpNodes(adb, serial);
  // A tray left open by an earlier run is a modal that keeps the Options deep link from showing, so it is
  // closed first; BACK with the keyboard down closes the tray.
  if (dump().some((node) => node.contentDesc === "Roll Expression")) {
    run(adb, ["-s", serial, "shell", "input", "keyevent", "KEYCODE_BACK"]);
    await sleep(800);
    if (dump().some((node) => node.contentDesc === "Roll Expression")) refuse("a dice tray is open and did not close on BACK");
  }
  if (args.mode) {
    const problem = await setMode(adb, serial, args.mode, dump);
    if (problem) refuse(`could not set --mode ${args.mode}: ${problem}`);
  }

  let allPassed = true;
  for (let i = 0; i < args.expressions.length; i++) {
    const expression = args.expressions[i];
    const { result, fatal, shot, resolved } = await rollOne({
      adb,
      serial,
      expression,
      index: i + 1,
      mode: args.mode,
      shotsDir,
      record: args.record,
    });
    const passed = result.ok && fatal === 0 && !result.error;
    allPassed = allPassed && passed;
    console.log(formatResultLine({ expression, mode: args.mode ?? resolved, result, fatal, shot }));
  }
  return allPassed ? 0 : 1;
}

main(process.argv.slice(2), process.env).then((code) => process.exit(code));
