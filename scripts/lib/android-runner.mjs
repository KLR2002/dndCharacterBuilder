// The native Android screenshot runner core, driven by scripts/layout-android.mjs. Every device
// interaction goes through one injectable executor `run(command, args, options) -> { code, stdout,
// stderr }`, so the tests in checks/ drive the whole lifecycle with a fake adb and a fake emulator
// that record their calls. The SDK is resolved from ANDROID_HOME / ANDROID_SDK_ROOT, defaulting to
// ~/Android/Sdk, because neither adb nor emulator is on PATH.
import { join } from "node:path";
import { buildScreens } from "./scenarios.mjs";

// The app id of the (E2E) build, and the AVD the runner boots when no emulator is running.
export const APP_ID = "com.anonymous.dnd5e2014CharacterBuilder";
export const AVD_NAME = "Small_Phone";
// The AVD's screen is 720 px wide, so dp = 720 / (density / 160).
export const SCREEN_WIDTH_PX = 720;
// A cold Gradle release build takes about six minutes; the runner gives it a long timeout of its own
// and streams nothing from it when it passes.
export const BUILD_TIMEOUT_MS = 900_000;
export const BOOT_TIMEOUT_MS = 180_000;
// About five seconds for the first render after a launch.
export const RENDER_WAIT_MS = 5_000;

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

// One run of the device side: parse and validate the arguments (an unmatched ONLY term exits 2
// before any device is touched), find or start the emulator, refuse a non-emulator serial, build
// unless --no-build, install, then for each width set the density and launch the app, restoring the
// original density at the end (also after a failure, and from the signal handler) and stopping the
// emulator only when this run started it. Returns the exit code.
export async function runAndroid(options) {
  const {
    root,
    env,
    argv,
    run,
    sleep,
    startEmulator,
    fileExists,
    mkdir,
    tmpdir,
    homeDir,
    installSignalHandlers,
    log,
    errorLog,
    buildTimeoutMs = BUILD_TIMEOUT_MS,
    bootTimeoutMs = BOOT_TIMEOUT_MS,
    renderWaitMs = RENDER_WAIT_MS,
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
    for (const width of widths) {
      const density = densityForWidth(width);
      run(adb, adbArgs(["shell", "wm", "density", String(density)]));
      const launch = run(adb, adbArgs(["shell", "monkey", "-p", APP_ID, "-c", "android.intent.category.LAUNCHER", "1"]));
      if (launch.code !== 0) {
        errorLog(`Launching ${APP_ID} at ${width}dp failed (exit ${launch.code}): ${tail(launch.stderr || launch.stdout)}`);
        return 1;
      }
      log(`[${width}dp] density ${density}; launched ${APP_ID}`);
      await sleep(renderWaitMs);
    }
    log("Run finished");
    return 0;
  } finally {
    cleanup();
  }
}
