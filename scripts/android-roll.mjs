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
import { parseDumpOutput, tapPoint, visibleBounds } from "./lib/uiautomator.mjs";
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
  settleSignature,
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
  const point = tapPoint(node, view, nodes);
  if (!point) return false;
  run(adb, ["-s", serial, "shell", "input", "tap", String(point.x), String(point.y)]);
  return true;
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
    if (node && visibleBounds(node, currentView)) {
      tapped = tapNode(adb, serial, nodes, node);
      if (!tapped) return `${id} is covered on screen and no uncovered point of it exists`;
      break;
    }
    if (swipes < MAX_OPTIONS_SWIPES) run(adb, ["-s", serial, "shell", "input", "swipe", ...optionsSwipeArgs(currentView).map(String)]);
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

  // A result card left over from the previous roll would settle at once: dismiss it first.
  if (findNodeById(dump(), "result-card")) {
    const dismiss = await waitForNode(dump, (nodes) => nodes.find((node) => node.contentDesc === "Dismiss result" && node.clickable && node.bounds));
    if (!dismiss) return fail("a result card is open and has no Dismiss result button");
    tapNode(adb, serial, dump(), dismiss);
    await sleep(500);
  }

  run(adb, ["-s", serial, "logcat", "-c"]);

  const diceButton = await waitForNode(dump, (nodes) => findNodeById(nodes, "dice-button"));
  if (!diceButton) return fail("no dice-button on Home");
  if (!tapNode(adb, serial, dump(), diceButton)) return fail("the dice-button is covered");

  const field = await waitForNode(dump, (nodes) => nodes.find((node) => node.contentDesc === "Roll Expression" && node.bounds));
  if (!field) return fail("no Roll Expression field in the tray");
  if (!tapNode(adb, serial, dump(), field)) return fail("the Roll Expression field is covered");
  await sleep(400);

  shell("input", "text", inputTextArg(expression));
  await sleep(300);
  // BACK closes the keyboard; the tray must stay open, so the Roll button must still be in the dump.
  shell("input", "keyevent", "KEYCODE_BACK");
  await sleep(500);
  const rollButton = await waitForNode(dump, (nodes) => findRollButton(nodes, expression));
  if (!rollButton) return fail("the tray closed when the keyboard was dismissed (no Roll button)");

  const remote = `/sdcard/android-roll-${index}.mp4`;
  let recordStart = 0;
  if (record) {
    shell(`screenrecord --time-limit ${RECORD_SECONDS} ${remote} &`);
    recordStart = Date.now();
    await sleep(500);
  }
  if (!tapNode(adb, serial, dump(), rollButton)) return fail("the Roll button is covered");

  // Settled: the result card exists and the labels equal those of the dump before, or the deadline passes.
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let previous = null;
  let nodes = [];
  let settled = false;
  while (!settled && Date.now() < deadline) {
    await sleep(SETTLE_POLL_MS);
    nodes = dump();
    const signature = settleSignature(nodes);
    settled = signature !== null && signature === previous;
    previous = signature;
  }
  if (!settled) return fail(`timed out after ${SETTLE_TIMEOUT_MS / 1000} s waiting for the result card to settle`);

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
  const labels = dieLabels(nodes);
  const resolved = resolveMode(mode, labels.kind);
  const result = compareDice({ mode: resolved, labels: labels.labels, chips: chipsOf(nodes) });
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
