// The native Android screenshot runner core, driven by scripts/layout-android.mjs. Every device
// interaction goes through one injectable executor `run(command, args, options) -> { code, stdout,
// stderr }`, so the tests in checks/ drive the whole lifecycle with a fake adb and a fake emulator
// that record their calls; every adb call also carries a `timeoutMs` in its options, so a hung adb
// is a failed call instead of a blocked run (and blocked signal handlers). The SDK is resolved from
// ANDROID_HOME / ANDROID_SDK_ROOT, defaulting to ~/Android/Sdk, because neither adb nor emulator is
// on PATH. The waits between polls go through the injectable async `sleep`, so the event loop turns
// between device calls and a signal handler runs there.
import { join } from "node:path";
import { buildScreens, buildSeed } from "./scenarios.mjs";
import { playScreen } from "./native-steps.mjs";
import { parseDump } from "./uiautomator.mjs";

// The app id of the (E2E) build, and the AVD the runner boots when no emulator is running.
export const APP_ID = "com.anonymous.dnd5e2014CharacterBuilder";
export const AVD_NAME = "Small_Phone";
// The deep link scheme the app registers, so a route opens by `am start -d <scheme>://<route>`.
export const LINK_SCHEME = "dnd5e2014characterbuilder";
// The seed file the app reads from its private folder on launch (the app deletes it after importing).
// Kept in sync with E2E_SEED_FILE_NAME in src/services/e2eSeedImport.ts; a test fails when they drift.
export const SEED_FILE_NAME = "dnd5e_e2e_seed.json";
// The 8 bytes every PNG starts with, checked on the pulled screenshot.
export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// The AVD's screen is 720 px wide, so dp = 720 / (density / 160).
export const SCREEN_WIDTH_PX = 720;
// A cold Gradle release build takes about six minutes; the runner gives it a long timeout of its own
// and streams nothing from it when it passes.
export const BUILD_TIMEOUT_MS = 900_000;
export const BOOT_TIMEOUT_MS = 180_000;
// Every adb call gets a timeout, so a hung adb cannot block the run (or a signal handler) forever: a
// timed-out call is a failed call, and the device-alive check then decides between a failed and a
// lost scenario. 60 s by default, longer for the install, shorter for a dump; screencap and pull are
// pinned at 60 s.
export const ADB_TIMEOUT_MS = 60_000;
export const INSTALL_TIMEOUT_MS = 180_000;
export const DUMP_TIMEOUT_MS = 30_000;
export const SCREENCAP_TIMEOUT_MS = 60_000;
export const PULL_TIMEOUT_MS = 60_000;
// The widths of the run: unset or blank WIDTHS means this default list, and every entry must be a
// positive integer in [WIDTH_MIN, WIDTH_MAX].
export const WIDTHS_DEFAULT = "393,360,320,412";
export const WIDTH_MIN = 240;
export const WIDTH_MAX = 1000;
// The ready wait: poll a uiautomator dump until the scenario's ready text shows, as long as the web
// check waits for its ready condition.
export const READY_TIMEOUT_MS = 10_000;
export const READY_POLL_MS = 500;
// Where the device writes the dump that is polled and the screenshots that are pulled.
export const DUMP_REMOTE = "/sdcard/e2e-dump.xml";
// A deep-link launch that exits non-zero is retried once after about this long (a real run saw one
// transient exit 255 that passed on its own).
export const LAUNCH_RETRY_DELAY_MS = 1_000;
// How many times one run reboots an emulator it started after losing it (a host GPU context loss
// killed the emulator mid-run). A further loss ends the run.
export const MAX_EMULATOR_RECOVERIES = 2;

// The density a width is set through: density = round(720 * 160 / width).
export function densityForWidth(width) {
  return Math.round((SCREEN_WIDTH_PX * 160) / width);
}

// Lowercase substrings from ONLY, as in layout-check. Empty when ONLY is unset or blank.
export function parseOnly(raw) {
  return (raw ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
}

// The widths of the run, as in layout-check: unset or blank means the default list.
export function parseWidths(raw) {
  const list = raw == null || raw.trim() === "" ? WIDTHS_DEFAULT : raw;
  return list.split(",").map((entry) => Number(entry.trim()));
}

// The WIDTHS entries that are not a positive integer from WIDTH_MIN to WIDTH_MAX (0, NaN, empty
// entries, out-of-range values). Each is named in the refusal message.
export function invalidWidthEntries(raw) {
  const list = raw == null || raw.trim() === "" ? WIDTHS_DEFAULT : raw;
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => !/^\d+$/.test(entry) || Number(entry) < WIDTH_MIN || Number(entry) > WIDTH_MAX);
}

// The screenshot folder of a run without SHOTS: a fresh folder per run under
// <tmpdir>/layout-android, named <YYYYMMDD-HHMMSS> (UTC), with a numeric suffix when that name is
// already taken, so stale screenshots of earlier runs never mix with this run's.
export function runShotsDir({ tmpdir, now, fileExists }) {
  const base = join(tmpdir(), "layout-android");
  const d = new Date(now());
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  let dir = join(base, stamp);
  let suffix = 1;
  while (fileExists(dir)) dir = join(base, `${stamp}-${suffix++}`);
  return dir;
}

// The environment of the spawned emulator process: LD_LIBRARY_PATH is stripped, because a shell
// that exports it breaks the emulator's Vulkan loader (the emulator doc starts it by hand with
// `env -u LD_LIBRARY_PATH`; the runner does the equivalent itself).
export function emulatorEnv(env) {
  const copy = { ...env };
  delete copy.LD_LIBRARY_PATH;
  return copy;
}

// A scenario route as a deep link URI: "/" is the scheme alone, "/options" adds the path.
export function deepLinkForRoute(route) {
  return `${LINK_SCHEME}://${route.replace(/^\//, "")}`;
}

// The screenshot file name, exactly as scripts/layout-check.mjs names its screenshots, so web and
// native shots of one scenario pair up.
export function screenshotName(name, width) {
  return `${name.replace(/\W+/g, "-")}-${width}.png`;
}

// `adb shell wm size` output: the physical screen size in px (a density override does not change it).
export function parseWmSize(stdout) {
  const match = /Physical size:\s*(\d+)x(\d+)/.exec(stdout);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

// The status bar and gesture bar heights in px, from `dumpsys window windows`: the STATUS_BAR and
// NAVIGATION_BAR windows are `fillx<N>` (full width, N px tall) at the top and the bottom of the screen,
// and stay that size under a density override. 0 when the device reports neither.
export function parseSystemBarHeights(stdout) {
  let topBar = 0;
  let bottomBar = 0;
  for (const line of stdout.split("\n")) {
    const bar = /\(fillx(\d+)\)/.exec(line);
    if (!bar) continue;
    if (!topBar && /\bty=STATUS_BAR\b/.test(line)) topBar = Number(bar[1]);
    if (!bottomBar && /\bty=NAVIGATION_BAR\b/.test(line)) bottomBar = Number(bar[1]);
  }
  return { topBar, bottomBar };
}

// Whether ONLY visits the scenario `name` (every scenario when ONLY is empty).
export function selected(name, only) {
  return only.length === 0 || only.some((term) => name.toLowerCase().includes(term));
}

// The ONLY terms that no scenario name contains. Such a term is a typo, so it fails the run instead
// of visiting nothing.
export function unmatchedOnlyTerms(only, names) {
  const lower = names.map((name) => name.toLowerCase());
  return only.filter((term) => !lower.some((name) => name.includes(term)));
}

// The connected devices of an `adb devices` output: [{ serial, state }], header line skipped.
export function parseAdbDevices(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"))
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter((device) => device.serial);
}

// A device is accepted only when its serial starts with `emulator-`.
export function isEmulatorSerial(serial) {
  return serial.startsWith("emulator-");
}

// `adb shell wm density` output: the physical density and, only when overridden, the override.
export function parseWmDensity(stdout) {
  const physical = /Physical density:\s*(\d+)/.exec(stdout)?.[1];
  const override = /Override density:\s*(\d+)/.exec(stdout)?.[1];
  return { physical: physical ? Number(physical) : null, override: override ? Number(override) : null };
}

// How the original density is put back: a pre-existing override is restored, otherwise reset.
export function restoreDensityArgs(original) {
  return original.override != null
    ? ["shell", "wm", "density", String(original.override)]
    : ["shell", "wm", "density", "reset"];
}

// The SDK layout: ANDROID_HOME, else ANDROID_SDK_ROOT, else ~/Android/Sdk.
export function sdkPaths({ env, homeDir }) {
  const sdk = env.ANDROID_HOME || env.ANDROID_SDK_ROOT || join(homeDir, "Android", "Sdk");
  return { sdk, adb: join(sdk, "platform-tools", "adb"), emulator: join(sdk, "emulator", "emulator") };
}

// The detached emulator start: headless, windowed with `--window`. The renderer is ANGLE over the
// host's Vulkan: the emulator's software renderer (its default without a window) segfaults during a
// cold boot of this AVD, and its host GL renderer (`-gpu host`) lost its GL context and killed the
// emulator after 8 and 29 scenarios in two full runs, while ANGLE ran all 50 SRD scenarios at 360 dp.
export function emulatorArgs({ windowed = false } = {}) {
  return ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio", "-gpu", "angle_indirect", ...(windowed ? [] : ["-no-window"])];
}

// The incremental E2E release build, run from android/.
export function gradleArgs() {
  return [":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "-Pe2e", "--console=plain"];
}

export function apkPath(root) {
  return join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
}

// Metro's transform cache (the FileStore rooted at os.tmpdir()/metro-cache in @expo/metro-config) is
// not keyed on EXPO_PUBLIC_E2E, so a bundle transformed under one flag value would be served for a
// build with the other. os.tmpdir() honors TMPDIR, so pointing TMPDIR at a per-flag-value directory
// gives each flag value its own metro-cache folder and the bundle step never reuses a cache
// transformed under the other flag value.
export function metroCacheRoot({ e2e, tmpdir }) {
  return join(tmpdir, `metro-cache-root-${e2e ? "e2e" : "plain"}`);
}

// The environment of the Gradle build: the SDK for Gradle, the flag for the JS bundle, and the
// per-flag-value Metro cache root (see metroCacheRoot).
export function buildEnv({ sdk, e2e, env, tmpdir }) {
  return {
    ...env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    ...(e2e ? { EXPO_PUBLIC_E2E: "1" } : {}),
    TMPDIR: metroCacheRoot({ e2e, tmpdir }),
  };
}

// The last lines of a command's output, for error messages.
function tail(text, lines = 15) {
  return text.trim().split("\n").slice(-lines).join("\n");
}

// Polls until the booted emulator reports sys.boot_completed=1. Returns the serial seen (possibly
// still booting) and whether it finished.
async function waitForBoot({ run, adb, sleep, timeoutMs, pollMs = 2_000 }) {
  const deadline = Date.now() + timeoutMs;
  let seen = null;
  for (;;) {
    const devices = parseAdbDevices(run(adb, ["devices"], { timeoutMs: ADB_TIMEOUT_MS }).stdout);
    const emulator = devices.find((device) => isEmulatorSerial(device.serial));
    if (emulator) {
      seen = emulator.serial;
      const prop = run(adb, ["-s", emulator.serial, "shell", "getprop", "sys.boot_completed"], { timeoutMs: ADB_TIMEOUT_MS });
      if (prop.stdout.trim() === "1") return { booted: true, serial: emulator.serial };
    }
    if (Date.now() >= deadline) return { booted: false, serial: seen };
    await sleep(pollMs);
  }
}

// The reset: force-stop the app and clear its data, then copy the seed into its private folder with
// run-as (through /data/local/tmp, so no megabytes go through the executor's stdio). The seed is only
// imported on a cold start, so this is only useful right before a launch. Returns false when the clear
// or the copy failed. `adbCall(args, timeoutMs?)` runs one adb command against the chosen serial.
function resetAndSeed({ adbCall, seedPath, label, errorLog }) {
  adbCall(["shell", "am", "force-stop", APP_ID]);
  const clear = adbCall(["shell", "pm", "clear", APP_ID]);
  if (clear.code !== 0) {
    errorLog(`${label}: pm clear failed (exit ${clear.code}): ${tail(clear.stderr || clear.stdout)}`);
    return false;
  }
  // The app's files/ folder may not exist after a clear, so create it before the copy.
  const tmpRemote = `/data/local/tmp/${SEED_FILE_NAME}`;
  const push = adbCall(["push", seedPath, tmpRemote]);
  adbCall(["shell", "run-as", APP_ID, "mkdir", "-p", "files"]);
  const copy = adbCall(["shell", "run-as", APP_ID, "cp", tmpRemote, `files/${SEED_FILE_NAME}`]);
  adbCall(["shell", "rm", "-f", tmpRemote]);
  if (push.code !== 0 || copy.code !== 0) {
    errorLog(`${label}: copying the seed into the app failed (push exit ${push.code}, run-as cp exit ${copy.code}): ${tail(copy.stderr || copy.stdout)}`);
    return false;
  }
  return true;
}

// The launch by deep link, retried once after about a second (awaited, so the event loop turns and a
// signal handler can run there) when it exits non-zero. The URI is quoted so the device shell does
// not split it. Returns false when both attempts failed.
async function launchRoute({ adbCall, route, label, errorLog, sleep }) {
  const uri = deepLinkForRoute(route);
  let launch = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(LAUNCH_RETRY_DELAY_MS);
    launch = adbCall(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `"${uri}"`, APP_ID]);
    if (launch.code === 0) return true;
  }
  errorLog(`${label}: deep link launch failed (exit ${launch.code}): ${tail(launch.stderr || launch.stdout)}`);
  return false;
}

// The isolation mode of a scenario, mirroring how the web check reloads its page: the first scenario of
// a width and every `fresh` scenario reset the app and copy the seed in (`reset+seed`); a `modal`
// scenario force-stops and relaunches by deep link without clearing (`relaunch`, as the web check
// reloads the page); any other scenario only jumps to its route by deep link (`deep link`), and when
// that is the route the previous scenario left the app on, not even that (`same route`: the UI state
// carries over, as the web check re-taps the tabs on the page it is already on).
function modeForScenario(screen, state, firstOfWidth) {
  if (firstOfWidth || screen.fresh) return "reset+seed";
  if (screen.modal) return "relaunch";
  if (state.route !== screen.route) return "deep link";
  return "same route";
}

// The stuck screen of a scenario that failed after the app was launched, saved as
// `<scenario>-<width>-FAILED.png` with the same on-device screencap and pull as a normal screenshot.
// Best effort: when the device does not answer, say so and carry on without a file.
function saveFailedScreenshot({ adbCall, file, shots, label, log, errorLog, fileExists }) {
  const remote = `/sdcard/${file}`;
  adbCall(["shell", "screencap", "-p", remote], SCREENCAP_TIMEOUT_MS);
  const target = join(shots, file);
  const pull = adbCall(["pull", remote, target], PULL_TIMEOUT_MS);
  if (pull.code !== 0 || !fileExists(target)) {
    errorLog(`${label}: could not save the stuck screen as ${file} (pull exit ${pull.code}); carrying on without it`);
    return;
  }
  log(`${label}: wrote ${target}`);
}

// One scenario at one width, in its isolation mode (see modeForScenario): reset+seed or relaunch or a
// bare deep-link jump, or no launch at all on the previous scenario's route; then the scenario's step
// fields (tabs, open, the ready text, scrollTo) are played on uiautomator dumps, and the screen is
// screencapped on the device and pulled as a PNG into the shots folder. A scenario that fails after
// the launch also saves the stuck screen as `<scenario>-<width>-FAILED.png`; a failure before the
// launch (the reset, the seed copy, the launch itself) does not. `state.route` tracks the route the app
// was last left on, as the web check's per-width page state: unknown (null) after a modal scenario and
// after a failed scenario, so the next scenario relaunches by deep link. Returns "ok" when the scenario
// produced its screenshot, "failed" when it failed on a live device, and "lost" when the device was
// gone at the failure point (checked with `deviceAlive`), in which case no FAILED screenshot is saved:
// a lost device is not a failed scenario.
async function runScenario({ adbCall, screen, width, shots, seedPath, state, firstOfWidth, sleep, now, log, errorLog, fileExists, readFile, readyTimeoutMs, readyPollMs, view, deviceAlive }) {
  const file = screenshotName(screen.name, width);
  const failedFile = file.replace(/\.png$/, "-FAILED.png");
  const label = `[${width}dp] ${screen.name}`;
  const mode = modeForScenario(screen, state, firstOfWidth);
  log(`${label}: ${mode}`);
  if (mode === "reset+seed") {
    if (!resetAndSeed({ adbCall, seedPath, label, errorLog })) {
      state.route = null;
      return deviceAlive() ? "failed" : "lost";
    }
    if (!(await launchRoute({ adbCall, route: screen.route, label, errorLog, sleep }))) {
      state.route = null;
      return deviceAlive() ? "failed" : "lost";
    }
  } else if (mode === "relaunch") {
    adbCall(["shell", "am", "force-stop", APP_ID]);
    if (!(await launchRoute({ adbCall, route: screen.route, label, errorLog, sleep }))) {
      state.route = null;
      return deviceAlive() ? "failed" : "lost";
    }
  } else if (mode === "deep link") {
    if (!(await launchRoute({ adbCall, route: screen.route, label, errorLog, sleep }))) {
      state.route = null;
      return deviceAlive() ? "failed" : "lost";
    }
  }
  // The step fields are played on fresh dumps: a tap lands at the matched node's centre, a swipe is an
  // `input swipe` mid-screen. A step whose target never shows fails the scenario with a message naming it;
  // a warning (an absent scrollTo needle, say) is logged and the scenario still screenshots.
  const dump = () => {
    // The remote dump file is deleted before every dump, so a failed dump cannot read a stale
    // hierarchy: a dump whose exit code is non-zero, or whose output does not report the dump, is an
    // empty node list for this poll.
    adbCall(["shell", "rm", "-f", DUMP_REMOTE]);
    const dumped = adbCall(["shell", "uiautomator", "dump", DUMP_REMOTE], DUMP_TIMEOUT_MS);
    if (dumped.code !== 0 || !/dumped to:/.test(dumped.stdout)) return [];
    return parseDump(adbCall(["exec-out", "cat", DUMP_REMOTE]).stdout);
  };
  const tap = (point) => adbCall(["shell", "input", "tap", String(point.x), String(point.y)]);
  const swipe = (args) => adbCall(["shell", "input", "swipe", ...args.map(String)]);
  const { error, warnings } = await playScreen({ screen, dump, tap, swipe, view, sleep, now, timeoutMs: readyTimeoutMs, pollMs: readyPollMs });
  for (const warning of warnings) log(`${label}: warning: ${warning}`);
  if (error) {
    // A failure caused by a lost device is not a failed scenario: no stuck screen is saved for it.
    if (!deviceAlive()) {
      state.route = null;
      return "lost";
    }
    errorLog(`${label}: ${error}`);
    saveFailedScreenshot({ adbCall, file: failedFile, shots, label, log, errorLog, fileExists });
    state.route = null;
    return "failed";
  }
  // The screenshot is binary, so it is taken on the device and pulled as a file, never through the
  // executor's UTF-8 stdout.
  const remote = `/sdcard/${file}`;
  adbCall(["shell", "screencap", "-p", remote], SCREENCAP_TIMEOUT_MS);
  const target = join(shots, file);
  const pull = adbCall(["pull", remote, target], PULL_TIMEOUT_MS);
  if (pull.code !== 0 || !fileExists(target)) {
    if (!deviceAlive()) {
      state.route = null;
      return "lost";
    }
    errorLog(`${label}: pulling the screenshot failed (exit ${pull.code}): ${tail(pull.stderr || pull.stdout)}`);
    state.route = null;
    return "failed";
  }
  const head = readFile(target).subarray(0, PNG_SIGNATURE.length);
  if (head.length !== PNG_SIGNATURE.length || !head.every((byte, i) => byte === PNG_SIGNATURE[i])) {
    errorLog(`${label}: ${target} is not a PNG (bad file signature)`);
    state.route = null;
    return "failed";
  }
  log(`${label}: wrote ${target}`);
  state.route = screen.modal ? null : screen.route;
  return "ok";
}

// One run of the device side: parse and validate the arguments (an unmatched ONLY term, an invalid
// WIDTHS entry, or an ONLY that selects only web-only scenarios exits 2 before any device is
// touched), then find or start the emulator — a ready emulator serial is reused, an emulator that is
// listed but not ready yet is waited for and adopted (never started or stopped by this run), a ready
// non-emulator device is refused, and only when no emulator is listed at all does the runner boot
// one (and stop it at the end); refuse a non-emulator serial; build unless --no-build; install; then
// for each width set the density and run every selected scenario in its isolation mode (the first
// of the width and `fresh` reset and reseed, `modal` force-stops and relaunches without clearing, the
// rest only jump by deep link — see modeForScenario), playing the step fields on uiautomator dumps
// and pulling the screenshot into the run's folder (SHOTS, else a fresh per-run folder), restoring
// the original density at the end (also after a failure, and from the signal handler, which also
// stops the emulator when this run started it and ends the run with 130/143) and stopping the
// emulator only when this run started it. The device is checked alive before each scenario and at
// every scenario failure point (`adb -s <serial> get-state` must print `device`); when it is lost, an
// emulator this run started is booted again (at most MAX_EMULATOR_RECOVERIES times per run), the APK
// installed and the width's density set again, and the scenario that was running is repeated in
// reset+seed mode, while a reused emulator stops the run at that scenario with a message and a
// non-zero exit. A scenario that failed because the device was lost writes no FAILED screenshot. A
// scenario marked web-only is listed and skipped. Returns the exit code: 0 success, 1 a scenario
// failed or the device was lost unrecoverably, 2 a refusal, 130/143 a signal ended the run.
export async function runAndroid(options) {
  const {
    root,
    env,
    argv,
    run,
    sleep,
    now = () => Date.now(),
    startEmulator,
    fileExists,
    writeFile,
    readFile,
    makeSeed = ({ root: r, integrated: i }) => JSON.stringify(buildSeed({ root: r, integrated: i })),
    mkdir,
    makeTempDir,
    removeDir,
    tmpdir,
    homeDir,
    installSignalHandlers,
    log,
    errorLog,
    buildTimeoutMs = BUILD_TIMEOUT_MS,
    bootTimeoutMs = BOOT_TIMEOUT_MS,
    readyTimeoutMs = READY_TIMEOUT_MS,
    readyPollMs = READY_POLL_MS,
  } = options;
  const integrated = argv.includes("--integrated") || env.LAYOUT_INTEGRATED === "1";
  const noBuild = argv.includes("--no-build");
  const windowed = argv.includes("--window");
  // The scenario names of this run, from the shared module.
  const names = buildScreens({ integrated }).map((screen) => screen.name);
  if (argv.includes("--list")) {
    log(JSON.stringify(names, null, 2));
    return 0;
  }
  const only = parseOnly(env.ONLY);
  const unmatched = unmatchedOnlyTerms(only, names);
  if (unmatched.length > 0) {
    errorLog(`ONLY matches no scenario: ${unmatched.map((term) => `"${term}"`).join(", ")}. Scenarios in this run: ${names.join(", ")}`);
    return 2;
  }
  // WIDTHS is validated before any device is touched: unset or blank means the default list, every
  // other entry must be a positive integer in [WIDTH_MIN, WIDTH_MAX].
  const badWidths = invalidWidthEntries(env.WIDTHS);
  if (badWidths.length > 0) {
    errorLog(`WIDTHS entries must be positive integers from ${WIDTH_MIN} to ${WIDTH_MAX}: ${badWidths.map((entry) => `"${entry}"`).join(", ")}`);
    return 2;
  }
  const widths = parseWidths(env.WIDTHS);
  // The selected scenarios, computed before any device is touched: a web-only scenario (one whose
  // open steps have no native form) is listed and skipped, and an ONLY that selects only web-only
  // scenarios (nothing runnable) is a refusal.
  const screens = buildScreens({ integrated });
  const selectedScreens = screens.filter((screen) => selected(screen.name, only));
  const runnable = [];
  for (const screen of selectedScreens) {
    if (screen.webOnly) log(`Skipping ${screen.name}: web-only`);
    else runnable.push(screen);
  }
  if (only.length > 0 && selectedScreens.length > 0 && runnable.length === 0) {
    errorLog(`ONLY selects only web-only scenarios, so nothing would run natively: ${selectedScreens.map((screen) => screen.name).join(", ")}. Scenarios in this run: ${names.join(", ")}`);
    return 2;
  }
  // The screenshot folder of this run: SHOTS, else a fresh folder per run, printed once.
  const shots = env.SHOTS ?? runShotsDir({ tmpdir, now, fileExists });
  mkdir(shots);
  log(`Screenshots: ${shots}`);
  const { sdk, adb, emulator: emulatorBin } = sdkPaths({ env, homeDir });
  if (!fileExists(adb)) {
    errorLog(`adb not found at ${adb}. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK at ${join(homeDir, "Android", "Sdk")}.`);
    return 2;
  }

  // Find or start the emulator. An emulator serial is always preferred over any other device: a
  // ready one is reused; one that is listed but not ready yet (offline, mid-boot) is waited for and
  // adopted, and never started or stopped by this run; only when no emulator is listed at all does
  // the runner boot one. A ready non-emulator device is refused (AC-8); a non-emulator device is
  // ignored whenever an emulator is usable.
  const devices = parseAdbDevices(run(adb, ["devices"], { timeoutMs: ADB_TIMEOUT_MS }).stdout);
  const emulators = devices.filter((device) => isEmulatorSerial(device.serial));
  const readyEmulator = emulators.find((device) => device.state === "device");
  const listedEmulator = emulators.find((device) => device.state !== "device");
  const readyOther = devices.find((device) => !isEmulatorSerial(device.serial) && device.state === "device");
  let serial = null;
  let started = false;
  if (readyEmulator) {
    serial = readyEmulator.serial;
    log(`Reusing connected emulator ${serial}`);
  } else if (listedEmulator) {
    log(`Emulator ${listedEmulator.serial} is listed as ${listedEmulator.state}; waiting for it to boot`);
    const boot = await waitForBoot({ run, adb, sleep, timeoutMs: bootTimeoutMs });
    if (!boot.booted) {
      errorLog(`Emulator ${listedEmulator.serial} did not report sys.boot_completed=1 within ${Math.round(bootTimeoutMs / 1000)} s.`);
      return 2;
    }
    serial = boot.serial;
    log(`Emulator ${serial} booted`);
  } else if (readyOther) {
    errorLog(`Refusing device ${readyOther.serial}: only emulators (a serial starting with "emulator-") are accepted, because a run changes the device's screen density and installs an app on it.`);
    return 2;
  } else {
    if (!fileExists(emulatorBin)) {
      errorLog(`No emulator binary at ${emulatorBin}. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK at ${join(homeDir, "Android", "Sdk")}.`);
      return 2;
    }
    log(`No emulator connected; booting AVD ${AVD_NAME} (${windowed ? "windowed" : "headless"})`);
    startEmulator(emulatorBin, emulatorArgs({ windowed }), join(shots, "emulator.log"), emulatorEnv(env));
    started = true;
    const boot = await waitForBoot({ run, adb, sleep, timeoutMs: bootTimeoutMs });
    if (!boot.booted) {
      if (boot.serial) run(adb, ["-s", boot.serial, "emu", "kill"], { timeoutMs: ADB_TIMEOUT_MS });
      errorLog(`Emulator ${AVD_NAME} did not report sys.boot_completed=1 within ${Math.round(bootTimeoutMs / 1000)} s.`);
      return 2;
    }
    serial = boot.serial;
    log(`Emulator ${serial} booted`);
  }

  // Refuse anything that is not an emulator, before anything is cleared, installed or launched.
  if (!isEmulatorSerial(serial)) {
    errorLog(`Refusing device ${serial}: only emulators (a serial starting with "emulator-") are accepted, because a run changes the device's screen density and installs an app on it.`);
    return 2;
  }

  // One adb command against the chosen serial, with a timeout; `serial` is read at call time, so a
  // recovery that lands on a new serial is picked up.
  const adbArgs = (args) => ["-s", serial, ...args];
  const adbCall = (args, timeoutMs = ADB_TIMEOUT_MS) => run(adb, adbArgs(args), { timeoutMs });
  // Whether the device is still alive: `adb -s <serial> get-state` must print `device` and exit 0.
  // Anything else (offline, no devices, serial not found, a non-zero exit) means the device is lost.
  const deviceAlive = () => {
    const state = adbCall(["get-state"]);
    return state.code === 0 && state.stdout.trim() === "device";
  };
  const originalDensity = parseWmDensity(adbCall(["shell", "wm", "density"]).stdout);
  // The seed is staged in a private temp dir (not a predictable path), removed at the end of the run.
  let seedDir = null;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    // Best effort: a dead device answers adb quickly with an error, so neither call hangs or throws.
    try {
      adbCall(restoreDensityArgs(originalDensity));
    } catch {
      // The device is gone; there is no density to restore.
    }
    if (started) {
      try {
        adbCall(["emu", "kill"]);
      } catch {
        // The emulator is gone; there is nothing left to stop.
      }
    }
    if (seedDir) {
      try {
        removeDir(seedDir);
      } catch {
        // The temp dir is gone; nothing to remove.
      }
    }
  };
  // A signal ends the run: the handler runs the cleanup at once and the scenario loop returns the
  // signal's exit code (130 SIGINT, 143 SIGTERM) at its next check, so no further scenario runs.
  let signalExitCode = null;
  installSignalHandlers((signal) => {
    if (signalExitCode === null) {
      signalExitCode = signal === "SIGTERM" ? 143 : 130;
      cleanup();
    }
  });
  try {
    const android = join(root, "android");
    const apk = apkPath(root);
    if (!noBuild) {
      if (!fileExists(join(android, "gradlew"))) {
        errorLog(`No generated Android project at ${android}. Generate it once with: npx expo prebuild --platform android --no-install`);
        return 2;
      }
      mkdir(metroCacheRoot({ e2e: true, tmpdir: tmpdir() }));
      const build = run(join(android, "gradlew"), gradleArgs(), {
        cwd: android,
        env: buildEnv({ sdk, e2e: true, env, tmpdir: tmpdir() }),
        timeoutMs: buildTimeoutMs,
      });
      if (build.code !== 0) {
        errorLog(`Gradle E2E release build failed (exit ${build.code}):\n${tail(build.stderr || build.stdout)}`);
        return 1;
      }
      log("Gradle E2E release build finished (APK: android/app/build/outputs/apk/release/app-release.apk)");
    }
    if (!fileExists(apk)) {
      errorLog(`No APK at ${apk}. Build it once without --no-build.`);
      return 2;
    }
    const install = adbCall(["install", "-r", apk], INSTALL_TIMEOUT_MS);
    if (install.code !== 0) {
      errorLog(`adb install -r failed (exit ${install.code}): ${tail(install.stderr || install.stdout)}`);
      return 1;
    }
    log(`Installed ${apk} on ${serial}`);

    // The screen and the system bars, for the step player's taps and swipes: the physical size (a density
    // override does not change it) and the status/gesture bar heights.
    const size = parseWmSize(adbCall(["shell", "wm", "size"]).stdout);
    if (!size) {
      errorLog(`could not read the screen size from "adb shell wm size"`);
      return 2;
    }
    const view = { ...size, ...parseSystemBarHeights(adbCall(["shell", "dumpsys", "window", "windows"]).stdout) };

    // The seed is built once per run and staged in a private temp dir that is removed at the end of
    // the run; only the reset+seed scenarios copy it into the app (the app imports it on the cold
    // start that follows the clear).
    let seedPath = null;
    if (runnable.length > 0) {
      seedDir = makeTempDir(join(tmpdir(), "dnd5e-android-seed-"));
      seedPath = join(seedDir, SEED_FILE_NAME);
      writeFile(seedPath, makeSeed({ root, integrated }));
    }

    // When the device is lost mid-run: if this run started the emulator, boot it again (at most
    // MAX_EMULATOR_RECOVERIES times), wait for boot, install the APK, set the width's density again
    // and let the caller repeat the scenario in reset+seed mode; a reused emulator is not restarted,
    // so the run stops at that scenario. Returns whether the scenario can be repeated.
    let recoveries = 0;
    const recoverLostDevice = async ({ screen, width, density, state }) => {
      if (!started) {
        errorLog(
          `[${width}dp] ${screen.name}: device ${serial} is gone (adb -s ${serial} get-state does not report "device"); ` +
            `this run did not start the emulator, so it is not restarted: stopping without running the remaining scenarios`,
        );
        return false;
      }
      if (recoveries >= MAX_EMULATOR_RECOVERIES) {
        errorLog(`[${width}dp] ${screen.name}: emulator lost again; this run has already rebooted it ${recoveries} of ${MAX_EMULATOR_RECOVERIES} times, ending the run`);
        return false;
      }
      recoveries += 1;
      log(`[${width}dp] ${screen.name}: emulator lost, rebooting (${recoveries} of ${MAX_EMULATOR_RECOVERIES})`);
      startEmulator(emulatorBin, emulatorArgs({ windowed }), join(shots, "emulator.log"), emulatorEnv(env));
      const boot = await waitForBoot({ run, adb, sleep, timeoutMs: bootTimeoutMs });
      if (!boot.booted) {
        if (boot.serial) run(adb, ["-s", boot.serial, "emu", "kill"], { timeoutMs: ADB_TIMEOUT_MS });
        errorLog(`rebooting ${AVD_NAME} after the emulator was lost did not report sys.boot_completed=1 within ${Math.round(bootTimeoutMs / 1000)} s; ending the run`);
        return false;
      }
      // The rebooted emulator is normally the same serial again, but read it from the boot wait.
      serial = boot.serial;
      log(`Emulator ${serial} booted again`);
      const install = adbCall(["install", "-r", apk], INSTALL_TIMEOUT_MS);
      if (install.code !== 0) {
        errorLog(`adb install -r on the rebooted ${serial} failed (exit ${install.code}): ${tail(install.stderr || install.stdout)}; ending the run`);
        return false;
      }
      // The reboot may have kept a density override, so set this width's density again.
      adbCall(["shell", "wm", "density", String(density)]);
      state.route = null;
      return true;
    };

    let failures = 0;
    let aborted = false;
    for (const width of widths) {
      if (aborted || signalExitCode !== null) break;
      const density = densityForWidth(width);
      adbCall(["shell", "wm", "density", String(density)]);
      log(`[${width}dp] density ${density}`);
      // The route the app was last left on at this width, as the web check's per-width page state:
      // unknown at the start of the width, after a modal scenario and after a failed scenario.
      const state = { route: null };
      let index = 0;
      while (index < runnable.length && !aborted) {
        if (signalExitCode !== null) return signalExitCode;
        const screen = runnable[index];
        const runScreen = (firstOfWidth) =>
          runScenario({
            adbCall,
            screen,
            width,
            shots,
            seedPath,
            state,
            firstOfWidth,
            sleep,
            now,
            log,
            errorLog,
            fileExists,
            readFile,
            readyTimeoutMs,
            readyPollMs,
            view,
            deviceAlive,
          });
        // The device is checked before each scenario, and runScenario checks it again at every
        // failure point, so a loss is caught either here or as a "lost" result.
        let result = deviceAlive() ? await runScreen(index === 0) : "lost";
        if (signalExitCode !== null) return signalExitCode;
        if (result === "lost") {
          if (!(await recoverLostDevice({ screen, width, density, state }))) {
            aborted = true;
            break;
          }
          if (signalExitCode !== null) return signalExitCode;
          // Repeat the scenario that was running, in reset+seed mode, so the app is seeded again.
          result = await runScreen(true);
          if (signalExitCode !== null) return signalExitCode;
          if (result === "lost") continue;
        }
        if (result === "failed") failures += 1;
        index += 1;
      }
    }
    if (signalExitCode !== null) return signalExitCode;
    if (aborted) return 1;
    if (failures > 0) {
      errorLog(`Run finished with ${failures} failed scenario(s)`);
      return 1;
    }
    log("Run finished");
    return 0;
  } finally {
    cleanup();
  }
}
