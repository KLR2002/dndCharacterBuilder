// The native Android screenshot runner core, driven by scripts/layout-android.mjs. Every device
// interaction goes through one injectable executor `run(command, args, options) -> { code, stdout,
// stderr }`, so the tests in checks/ drive the whole lifecycle with a fake adb and a fake emulator
// that record their calls. The SDK is resolved from ANDROID_HOME / ANDROID_SDK_ROOT, defaulting to
// ~/Android/Sdk, because neither adb nor emulator is on PATH.
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
// The ready wait: poll a uiautomator dump until the scenario's ready text shows, as long as the web
// check waits for its ready condition.
export const READY_TIMEOUT_MS = 10_000;
export const READY_POLL_MS = 500;
// Where the device writes the dump that is polled and the screenshots that are pulled.
export const DUMP_REMOTE = "/sdcard/e2e-dump.xml";
// A deep-link launch that exits non-zero is retried once after about this long (a real run saw one
// transient exit 255 that passed on its own).
export const LAUNCH_RETRY_DELAY_MS = 1_000;

// The density a width is set through: density = round(720 * 160 / width).
export function densityForWidth(width) {
  return Math.round((SCREEN_WIDTH_PX * 160) / width);
}

// Lowercase substrings from ONLY, as in layout-check. Empty when ONLY is unset or blank.
export function parseOnly(raw) {
  return (raw ?? "").split(",").map((term) => term.trim().toLowerCase()).filter(Boolean);
}

// The widths of the run, as in layout-check.
export function parseWidths(raw) {
  return (raw ?? "393,360,320,412").split(",").map(Number);
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
    const devices = parseAdbDevices(run(adb, ["devices"]).stdout);
    const emulator = devices.find((device) => device.serial.startsWith("emulator-"));
    if (emulator) {
      seen = emulator.serial;
      const prop = run(adb, ["-s", emulator.serial, "shell", "getprop", "sys.boot_completed"]);
      if (prop.stdout.trim() === "1") return { booted: true, serial: emulator.serial };
    }
    if (Date.now() >= deadline) return { booted: false, serial: seen };
    await sleep(pollMs);
  }
}

// The reset: force-stop the app and clear its data, then copy the seed into its private folder with
// run-as (through /data/local/tmp, so no megabytes go through the executor's stdio). The seed is only
// imported on a cold start, so this is only useful right before a launch. Returns false when the clear
// or the copy failed.
function resetAndSeed({ run, adb, adbArgs, seedPath, label, errorLog }) {
  run(adb, adbArgs(["shell", "am", "force-stop", APP_ID]));
  const clear = run(adb, adbArgs(["shell", "pm", "clear", APP_ID]));
  if (clear.code !== 0) {
    errorLog(`${label}: pm clear failed (exit ${clear.code}): ${tail(clear.stderr || clear.stdout)}`);
    return false;
  }
  // The app's files/ folder may not exist after a clear, so create it before the copy.
  const tmpRemote = `/data/local/tmp/${SEED_FILE_NAME}`;
  const push = run(adb, adbArgs(["push", seedPath, tmpRemote]));
  run(adb, adbArgs(["shell", "run-as", APP_ID, "mkdir", "-p", "files"]));
  const copy = run(adb, adbArgs(["shell", "run-as", APP_ID, "cp", tmpRemote, `files/${SEED_FILE_NAME}`]));
  run(adb, adbArgs(["shell", "rm", "-f", tmpRemote]));
  if (push.code !== 0 || copy.code !== 0) {
    errorLog(`${label}: copying the seed into the app failed (push exit ${push.code}, run-as cp exit ${copy.code}): ${tail(copy.stderr || copy.stdout)}`);
    return false;
  }
  return true;
}

// The launch by deep link, retried once after about a second when it exits non-zero. The URI is quoted
// so the device shell does not split it. Returns false when both attempts failed.
function launchRoute({ run, adb, adbArgs, route, label, errorLog, sleep }) {
  const uri = deepLinkForRoute(route);
  let launch = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) sleep(LAUNCH_RETRY_DELAY_MS);
    launch = run(adb, adbArgs(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `"${uri}"`, APP_ID]));
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
function saveFailedScreenshot({ run, adb, adbArgs, file, shots, label, log, errorLog, fileExists }) {
  const remote = `/sdcard/${file}`;
  run(adb, adbArgs(["shell", "screencap", "-p", remote]));
  const target = join(shots, file);
  const pull = run(adb, adbArgs(["pull", remote, target]));
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
// after a failed scenario, so the next scenario relaunches by deep link. Returns whether the scenario
// produced its screenshot.
async function runScenario({ run, adb, adbArgs, screen, width, shots, seedPath, state, firstOfWidth, sleep, now, log, errorLog, fileExists, readFile, readyTimeoutMs, readyPollMs, view }) {
  const file = screenshotName(screen.name, width);
  const failedFile = file.replace(/\.png$/, "-FAILED.png");
  const label = `[${width}dp] ${screen.name}`;
  const mode = modeForScenario(screen, state, firstOfWidth);
  log(`${label}: ${mode}`);
  if (mode === "reset+seed") {
    if (!resetAndSeed({ run, adb, adbArgs, seedPath, label, errorLog })) {
      state.route = null;
      return false;
    }
    if (!launchRoute({ run, adb, adbArgs, route: screen.route, label, errorLog, sleep })) {
      state.route = null;
      return false;
    }
  } else if (mode === "relaunch") {
    run(adb, adbArgs(["shell", "am", "force-stop", APP_ID]));
    if (!launchRoute({ run, adb, adbArgs, route: screen.route, label, errorLog, sleep })) {
      state.route = null;
      return false;
    }
  } else if (mode === "deep link") {
    if (!launchRoute({ run, adb, adbArgs, route: screen.route, label, errorLog, sleep })) {
      state.route = null;
      return false;
    }
  }
  // The step fields are played on fresh dumps: a tap lands at the matched node's centre, a swipe is an
  // `input swipe` mid-screen. A step whose target never shows fails the scenario with a message naming it;
  // a warning (an absent scrollTo needle, say) is logged and the scenario still screenshots.
  const dump = () => {
    run(adb, adbArgs(["shell", "uiautomator", "dump", DUMP_REMOTE]));
    return parseDump(run(adb, adbArgs(["exec-out", "cat", DUMP_REMOTE])).stdout);
  };
  const tap = (point) => run(adb, adbArgs(["shell", "input", "tap", String(point.x), String(point.y)]));
  const swipe = (args) => run(adb, adbArgs(["shell", "input", "swipe", ...args.map(String)]));
  const { error, warnings } = await playScreen({ screen, dump, tap, swipe, view, sleep, now, timeoutMs: readyTimeoutMs, pollMs: readyPollMs });
  for (const warning of warnings) log(`${label}: warning: ${warning}`);
  if (error) {
    errorLog(`${label}: ${error}`);
    saveFailedScreenshot({ run, adb, adbArgs, file: failedFile, shots, label, log, errorLog, fileExists });
    state.route = null;
    return false;
  }
  // The screenshot is binary, so it is taken on the device and pulled as a file, never through the
  // executor's UTF-8 stdout.
  const remote = `/sdcard/${file}`;
  run(adb, adbArgs(["shell", "screencap", "-p", remote]));
  const target = join(shots, file);
  const pull = run(adb, adbArgs(["pull", remote, target]));
  if (pull.code !== 0 || !fileExists(target)) {
    errorLog(`${label}: pulling the screenshot failed (exit ${pull.code}): ${tail(pull.stderr || pull.stdout)}`);
    state.route = null;
    return false;
  }
  const head = readFile(target).subarray(0, PNG_SIGNATURE.length);
  if (head.length !== PNG_SIGNATURE.length || !head.every((byte, i) => byte === PNG_SIGNATURE[i])) {
    errorLog(`${label}: ${target} is not a PNG (bad file signature)`);
    state.route = null;
    return false;
  }
  log(`${label}: wrote ${target}`);
  state.route = screen.modal ? null : screen.route;
  return true;
}

// One run of the device side: parse and validate the arguments (an unmatched ONLY term exits 2
// before any device is touched), find or start the emulator, refuse a non-emulator serial, build
// unless --no-build, install, then for each width set the density and run every selected scenario in
// its isolation mode (the first of the width and `fresh` reset and reseed, `modal` force-stops and
// relaunches without clearing, the rest only jump by deep link — see modeForScenario), playing the
// step fields on uiautomator dumps and pulling the screenshot, restoring the original density at the
// end (also after a failure, and from the signal handler) and stopping the emulator only when this
// run started it. A scenario marked web-only is listed and skipped. Returns the exit code: non-zero
// when any scenario failed.
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
  const integrated = argv.includes("--integrated");
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
  const widths = parseWidths(env.WIDTHS);
  const shots = env.SHOTS ?? join(tmpdir(), "layout-android");
  mkdir(shots);
  const { sdk, adb, emulator: emulatorBin } = sdkPaths({ env, homeDir });
  if (!fileExists(adb)) {
    errorLog(`adb not found at ${adb}. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install the SDK at ${join(homeDir, "Android", "Sdk")}.`);
    return 2;
  }

  // Find or start the emulator.
  const devices = parseAdbDevices(run(adb, ["devices"]).stdout);
  const target = devices.find((device) => device.state === "device");
  let serial = target?.serial ?? null;
  let started = false;
  if (serial) {
    log(`Reusing connected device ${serial}`);
  } else {
    log(`No device connected; booting AVD ${AVD_NAME} (${windowed ? "windowed" : "headless"})`);
    startEmulator(emulatorBin, emulatorArgs({ windowed }), join(shots, "emulator.log"));
    started = true;
    const boot = await waitForBoot({ run, adb, sleep, timeoutMs: bootTimeoutMs });
    if (!boot.booted) {
      if (boot.serial) run(adb, ["-s", boot.serial, "emu", "kill"]);
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

  const adbArgs = (args) => ["-s", serial, ...args];
  const originalDensity = parseWmDensity(run(adb, adbArgs(["shell", "wm", "density"])).stdout);
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    run(adb, adbArgs(restoreDensityArgs(originalDensity)));
    if (started) run(adb, adbArgs(["emu", "kill"]));
  };
  installSignalHandlers(cleanup);
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
    const install = run(adb, adbArgs(["install", "-r", apk]));
    if (install.code !== 0) {
      errorLog(`adb install -r failed (exit ${install.code}): ${tail(install.stderr || install.stdout)}`);
      return 1;
    }
    log(`Installed ${apk} on ${serial}`);

    // The screen and the system bars, for the step player's taps and swipes: the physical size (a density
    // override does not change it) and the status/gesture bar heights.
    const size = parseWmSize(run(adb, adbArgs(["shell", "wm", "size"])).stdout);
    if (!size) {
      errorLog(`could not read the screen size from "adb shell wm size"`);
      return 2;
    }
    const view = { ...size, ...parseSystemBarHeights(run(adb, adbArgs(["shell", "dumpsys", "window", "windows"])).stdout) };

    // The selected scenarios: a web-only scenario (one whose open steps have no native form) is listed and
    // skipped, the rest run at every width.
    const screens = buildScreens({ integrated });
    const runnable = [];
    for (const screen of screens) {
      if (!selected(screen.name, only)) continue;
      if (screen.webOnly) log(`Skipping ${screen.name}: web-only`);
      else runnable.push(screen);
    }
    // The seed is built once per run and staged locally; only the reset+seed scenarios copy it into
    // the app (the app imports it on the cold start that follows the clear).
    const seedPath = join(tmpdir(), `dnd5e-android-seed-${SEED_FILE_NAME}`);
    if (runnable.length > 0) writeFile(seedPath, makeSeed({ root, integrated }));

    let failures = 0;
    for (const width of widths) {
      const density = densityForWidth(width);
      run(adb, adbArgs(["shell", "wm", "density", String(density)]));
      log(`[${width}dp] density ${density}`);
      // The route the app was last left on at this width, as the web check's per-width page state:
      // unknown at the start of the width, after a modal scenario and after a failed scenario.
      const state = { route: null };
      for (const [index, screen] of runnable.entries()) {
        const ok = await runScenario({
          run,
          adb,
          adbArgs,
          screen,
          width,
          shots,
          seedPath,
          state,
          firstOfWidth: index === 0,
          sleep,
          now,
          log,
          errorLog,
          fileExists,
          readFile,
          readyTimeoutMs,
          readyPollMs,
          view,
        });
        if (!ok) failures += 1;
      }
    }
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
