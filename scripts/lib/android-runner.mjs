// The native Android screenshot runner core, driven by scripts/layout-android.mjs. Every device
// interaction goes through one injectable executor `run(command, args, options) -> { code, stdout,
// stderr }`, so the tests in checks/ drive the whole lifecycle with a fake adb and a fake emulator
// that record their calls. The SDK is resolved from ANDROID_HOME / ANDROID_SDK_ROOT, defaulting to
// ~/Android/Sdk, because neither adb nor emulator is on PATH.
import { join } from "node:path";
import { buildScreens, buildSeed } from "./scenarios.mjs";
import { findNode, parseDump } from "./uiautomator.mjs";

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

// Whether a scenario carries steps (tabs, open, modal, scrollTo) that have no native form yet: such a
// scenario is listed as needing native steps and skipped.
export function needsNativeSteps(screen) {
  return Boolean(screen.tabs?.length || screen.open?.length || screen.modal || screen.scrollTo);
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

// The detached emulator start: headless, windowed with `--window`. Headless runs on the host GPU:
// the emulator's software renderer (its default without a window) segfaults during a cold boot of
// this AVD, while `-gpu host` boots it.
export function emulatorArgs({ windowed = false } = {}) {
  return ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio", ...(windowed ? [] : ["-no-window", "-gpu", "host"])];
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

// Polls `uiautomator dump` until the ready condition (an exact string or a RegExp matched against an
// element's text) shows in the dump. Returns the matching node, or null when the timeout passes.
async function waitForReady({ run, adbArgs, adb, ready, timeoutMs, pollMs, sleep, now }) {
  const deadline = now() + timeoutMs;
  for (;;) {
    run(adb, adbArgs(["shell", "uiautomator", "dump", DUMP_REMOTE]));
    const xml = run(adb, adbArgs(["exec-out", "cat", DUMP_REMOTE])).stdout;
    const node = findNode(parseDump(xml), ready);
    if (node) return node;
    if (now() >= deadline) return null;
    await sleep(pollMs);
  }
}

// One scenario at one width: force-stop and clear the app, copy the seed into its private folder with
// run-as (through /data/local/tmp, so no megabytes go through the executor's stdio), launch the
// scenario's route by deep link, wait for its ready text, then screencap on the device and pull the
// PNG into the shots folder. Returns whether the scenario produced its screenshot.
async function runScenario({ run, adb, adbArgs, screen, width, shots, seedPath, sleep, now, log, errorLog, fileExists, readFile, readyTimeoutMs, readyPollMs }) {
  const file = screenshotName(screen.name, width);
  const label = `[${width}dp] ${screen.name}`;
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
  // The URI is quoted so the device shell does not split it.
  const uri = deepLinkForRoute(screen.route);
  const launch = run(adb, adbArgs(["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `"${uri}"`, APP_ID]));
  if (launch.code !== 0) {
    errorLog(`${label}: deep link launch failed (exit ${launch.code}): ${tail(launch.stderr || launch.stdout)}`);
    return false;
  }
  const ready = String(screen.ready);
  const node = await waitForReady({ run, adb, adbArgs, ready: screen.ready, timeoutMs: readyTimeoutMs, pollMs: readyPollMs, sleep, now });
  if (!node) {
    errorLog(`${label}: ready text ${ready} did not show within ${Math.round(readyTimeoutMs / 1000)} s`);
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
    return false;
  }
  const head = readFile(target).subarray(0, PNG_SIGNATURE.length);
  if (head.length !== PNG_SIGNATURE.length || !head.every((byte, i) => byte === PNG_SIGNATURE[i])) {
    errorLog(`${label}: ${target} is not a PNG (bad file signature)`);
    return false;
  }
  log(`${label}: wrote ${target}`);
  return true;
}

// One run of the device side: parse and validate the arguments (an unmatched ONLY term exits 2
// before any device is touched), find or start the emulator, refuse a non-emulator serial, build
// unless --no-build, install, then for each width set the density and run every selected scenario
// (reset, seed, deep link, ready wait, screenshot), restoring the original density at the end (also
// after a failure, and from the signal handler) and stopping the emulator only when this run started
// it. Returns the exit code: non-zero when any scenario failed.
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

    // The selected scenarios: those with native steps are listed and skipped, the rest run at every width.
    const screens = buildScreens({ integrated });
    const runnable = [];
    for (const screen of screens) {
      if (!selected(screen.name, only)) continue;
      if (needsNativeSteps(screen)) log(`Skipping ${screen.name}: needs native steps (tabs, open, modal or scrollTo)`);
      else runnable.push(screen);
    }
    // The seed is built once per run and staged locally; each scenario copies it into the app.
    const seedPath = join(tmpdir(), `dnd5e-android-seed-${SEED_FILE_NAME}`);
    if (runnable.length > 0) writeFile(seedPath, makeSeed({ root, integrated }));

    let failures = 0;
    for (const width of widths) {
      const density = densityForWidth(width);
      run(adb, adbArgs(["shell", "wm", "density", String(density)]));
      log(`[${width}dp] density ${density}`);
      for (const screen of runnable) {
        const ok = await runScenario({
          run,
          adb,
          adbArgs,
          screen,
          width,
          shots,
          seedPath,
          sleep,
          now,
          log,
          errorLog,
          fileExists,
          readFile,
          readyTimeoutMs,
          readyPollMs,
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
