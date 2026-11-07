import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir as osTmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_ID,
  AVD_NAME,
  BUILD_TIMEOUT_MS,
  PNG_SIGNATURE,
  SEED_FILE_NAME,
  apkPath,
  buildEnv,
  deepLinkForRoute,
  densityForWidth,
  emulatorArgs,
  gradleArgs,
  isEmulatorSerial,
  metroCacheRoot,
  needsNativeSteps,
  parseAdbDevices,
  parseOnly,
  parseWidths,
  parseWmDensity,
  restoreDensityArgs,
  runAndroid,
  screenshotName,
  sdkPaths,
  selected,
  unmatchedOnlyTerms,
} from "../scripts/lib/android-runner.mjs";
import { buildScreens } from "../scripts/lib/scenarios.mjs";

// The native screenshot runner core (scripts/lib/android-runner.mjs, driven by scripts/layout-android.mjs).
// Every device interaction goes through one injectable executor `run(command, args, options)`, so these
// tests use a fake adb/emulator that records its calls and returns scripted output: the serial guard
// (AC-8), the width-to-density mapping and the density restore (AC-9), the reuse/boot/stop lifecycle
// (AC-10), the build step and its Metro cache separation (AC-11), the ONLY validation (AC-16) and the
// seeded scenario execution (AC-12): reset, seed copy with run-as, deep-link launch, ready polling on
// uiautomator dumps, and the pulled PNG screenshot.

const ROOT = "/repo";
const HOME = "/home/test";
const SDK = join(HOME, "Android", "Sdk");
const ADB = join(SDK, "platform-tools", "adb");
const APK = apkPath(ROOT);

type Call = { command: string; args: string[]; options?: Record<string, unknown> };

// The bytes the fake `adb pull` writes where the runner pulls the screenshot to: a real PNG signature
// followed by a few payload bytes.
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);

// A dump that satisfies both runnable scenarios' ready conditions (Home and Settings).
const DEFAULT_DUMP =
  `<hierarchy><node text="5e Character Builder" content-desc="" bounds="[0,0][300,60]" clickable="false" />` +
  `<node text="Settings &amp; Compendium" content-desc="" bounds="[185,86][534,129]" clickable="false" /></hierarchy>`;

const FAKE_SEED = JSON.stringify({
  characters: [{ id: "char_rendar", name: "Rendar" }],
  folders: [],
  settings: { hasCompletedFirstRun: true },
  integrated: null,
});

// A fake device world. `devices` is the `adb devices` output before the runner possibly boots an
// emulator, `bootDevices` after startEmulator ran. Everything else is scripted per command.
function makeWorld(options: {
  devices?: string;
  bootDevices?: string;
  bootCompleted?: string;
  wmDensity?: string;
  installCode?: number;
  amStartCodeFor?: (startNumber: number) => number;
  clearCode?: number;
  pushCode?: number;
  seedCopyCode?: number;
  pullCode?: number;
  dumpXml?: string | ((poll: number) => string);
  pullBytes?: Buffer;
  gradleCode?: number;
  gradleStdout?: string;
  gradleStderr?: string;
  missing?: string[];
  env?: Record<string, string>;
  argv?: string[];
  readyTimeoutMs?: number;
  readyPollMs?: number;
}) {
  const calls: Call[] = [];
  const starts: { bin: string; args: string[]; logPath: string }[] = [];
  const handlers: (() => void)[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const writes: { path: string; content: string }[] = [];
  let seedCalls = 0;
  let emulatorStarted = false;
  let amStarts = 0;
  let dumps = 0;
  let clock = 0;
  const missing = options.missing ?? [];
  const run = (command: string, args: string[], opts?: Record<string, unknown>) => {
    calls.push({ command, args: [...args], options: opts });
    const joined = args.join(" ");
    const reply = (code: number, stdout = "", stderr = "") => ({ code, stdout, stderr });
    if (args[0] === "devices") {
      const body = emulatorStarted ? (options.bootDevices ?? "") : (options.devices ?? "");
      return reply(0, `List of devices attached\n${body}\n`);
    }
    if (joined.includes("getprop sys.boot_completed")) return reply(0, `${options.bootCompleted ?? "1"}\n`);
    if (joined.includes("wm density") && !/wm density \d+|wm density reset/.test(joined)) {
      return reply(0, options.wmDensity ?? "Physical density: 320\n");
    }
    if (args.includes("install")) {
      const code = options.installCode ?? 0;
      return code === 0 ? reply(0, "Success\n") : reply(code, "", "INSTALL_FAILED_OLDER_SDK\n");
    }
    if (joined.includes("am force-stop")) return reply(0);
    if (args.includes("pm") && args.includes("clear")) {
      const code = options.clearCode ?? 0;
      return code === 0 ? reply(0, "Success\n") : reply(code, "", "Failed\n");
    }
    if (args.includes("push")) {
      const code = options.pushCode ?? 0;
      return code === 0 ? reply(0, "1 file pushed\n") : reply(code, "", "adb: error: failed to copy\n");
    }
    if (joined.includes("run-as") && args.includes("mkdir")) return reply(0);
    if (joined.includes("run-as") && args.includes("cp")) {
      const code = options.seedCopyCode ?? 0;
      return code === 0 ? reply(0) : reply(code, "", "cp: /data/local/tmp/x: Permission denied\n");
    }
    if (args.includes("rm")) return reply(0);
    if (args.includes("am") && args.includes("start")) {
      amStarts += 1;
      const code = options.amStartCodeFor?.(amStarts) ?? 0;
      return code === 0 ? reply(0, "Starting: Intent\n") : reply(code, "", "Error: Activity not started\n");
    }
    if (args.includes("uiautomator")) return reply(0, "UI hierchary dumped to: /sdcard/e2e-dump.xml\n");
    if (args.includes("exec-out")) {
      dumps += 1;
      const xml = typeof options.dumpXml === "function" ? options.dumpXml(dumps) : (options.dumpXml ?? DEFAULT_DUMP);
      return reply(0, xml);
    }
    if (args.includes("screencap")) return reply(0);
    if (args.includes("pull")) {
      const code = options.pullCode ?? 0;
      if (code === 0) writeFileSync(args.at(-1) as string, options.pullBytes ?? PNG_BYTES);
      return code === 0 ? reply(0, "1 file pulled\n") : reply(code, "", "adb: error: remote file does not exist\n");
    }
    if (joined.includes("emu kill")) return reply(0);
    if (command.endsWith("gradlew")) {
      const code = options.gradleCode ?? 0;
      return reply(code, options.gradleStdout ?? "BUILD SUCCESSFUL\n", options.gradleStderr ?? "");
    }
    return reply(0);
  };
  const runRun = async () =>
    runAndroid({
      root: ROOT,
      env: options.env ?? {},
      argv: options.argv ?? ["--no-build"],
      run,
      sleep: (ms: number) => {
        clock += ms;
      },
      now: () => clock,
      startEmulator: (bin: string, args: string[], logPath: string) => {
        starts.push({ bin, args: [...args], logPath });
        emulatorStarted = true;
        return 4321;
      },
      fileExists: (p: string) => !missing.some((m) => p.includes(m)),
      writeFile: (p: string, content: string) => {
        writes.push({ path: p, content });
      },
      readFile: (p: string) => readFileSync(p),
      makeSeed: () => {
        seedCalls += 1;
        return FAKE_SEED;
      },
      mkdir: () => {},
      tmpdir: () => "/tmp",
      homeDir: HOME,
      installSignalHandlers: (handler: () => void) => handlers.push(handler),
      log: (m: string) => logs.push(m),
      errorLog: (m: string) => errors.push(m),
      readyTimeoutMs: options.readyTimeoutMs ?? 1000,
      readyPollMs: options.readyPollMs ?? 500,
      bootTimeoutMs: 60,
    });
  const callsTo = (needle: string) => calls.filter((c) => `${c.command} ${c.args.join(" ")}`.includes(needle));
  return { calls, starts, handlers, logs, errors, writes, runRun, callsTo, get seedCalls() { return seedCalls; }, get dumps() { return dumps; } };
}

const emulatorWorld = { devices: "emulator-5554\tdevice\n" };

// --- Pure helpers ---

test("widths map to densities: 320->360, 360->320, 393->293, 412->280", () => {
  assert.equal(densityForWidth(320), 360);
  assert.equal(densityForWidth(360), 320);
  assert.equal(densityForWidth(393), 293);
  assert.equal(densityForWidth(412), 280);
});

test("parseAdbDevices parses the device list and skips the header", () => {
  assert.deepEqual(parseAdbDevices("List of devices attached\nemulator-5554\tdevice\nHTC123\toffline\n\n"), [
    { serial: "emulator-5554", state: "device" },
    { serial: "HTC123", state: "offline" },
  ]);
});

test("parseWmDensity reads the physical and the override density", () => {
  assert.deepEqual(parseWmDensity("Physical density: 320\n"), { physical: 320, override: null });
  assert.deepEqual(parseWmDensity("Physical density: 320\nOverride density: 440\n"), { physical: 320, override: 440 });
});

test("restoreDensityArgs resets, or puts back a pre-existing override", () => {
  assert.deepEqual(restoreDensityArgs({ physical: 320, override: null }), ["shell", "wm", "density", "reset"]);
  assert.deepEqual(restoreDensityArgs({ physical: 320, override: 440 }), ["shell", "wm", "density", "440"]);
});

test("isEmulatorSerial accepts only serials starting with emulator-", () => {
  assert.equal(isEmulatorSerial("emulator-5554"), true);
  assert.equal(isEmulatorSerial("HTC123"), false);
  assert.equal(isEmulatorSerial("localhost:5555"), false);
});

test("sdkPaths honors ANDROID_HOME, then ANDROID_SDK_ROOT, then the default ~/Android/Sdk", () => {
  assert.equal(sdkPaths({ env: { ANDROID_HOME: "/a" }, homeDir: HOME }).sdk, "/a");
  assert.equal(sdkPaths({ env: { ANDROID_SDK_ROOT: "/b" }, homeDir: HOME }).sdk, "/b");
  const dflt = sdkPaths({ env: {}, homeDir: HOME });
  assert.equal(dflt.sdk, SDK);
  assert.equal(dflt.adb, ADB);
  assert.equal(dflt.emulator, join(SDK, "emulator", "emulator"));
});

test("emulatorArgs boots the AVD detached, headless unless --window", () => {
  const headless = emulatorArgs({ windowed: false });
  assert.deepEqual(headless, ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio", "-no-window", "-gpu", "host"]);
  const windowed = emulatorArgs({ windowed: true });
  assert.deepEqual(windowed, ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio"]);
});

test("gradleArgs is the incremental E2E release build", () => {
  assert.deepEqual(gradleArgs(), [":app:assembleRelease", "-PreactNativeArchitectures=x86_64", "-Pe2e", "--console=plain"]);
});

test("parseOnly and parseWidths match layout-check's handling", () => {
  assert.deepEqual(parseOnly(" Home , ,SETTINGS "), ["home", "settings"]);
  assert.deepEqual(parseOnly(""), []);
  assert.deepEqual(parseWidths(undefined), [393, 360, 320, 412]);
  assert.deepEqual(parseWidths("320,412"), [320, 412]);
});

test("unmatchedOnlyTerms and selected work on the scenario names", () => {
  const names = buildScreens({ integrated: false }).map((screen: { name: string }) => screen.name);
  assert.deepEqual(unmatchedOnlyTerms(["home", "zzz"], names), ["zzz"]);
  assert.deepEqual(unmatchedOnlyTerms([], names), []);
  assert.equal(selected("Home", ["home"]), true);
  assert.equal(selected("Home", ["zzz"]), false);
  assert.equal(selected("Home", []), true);
});

// --- AC-12 pure helpers: screenshot name, deep link, native-step detection, seed file name, PNG signature ---

test("screenshotName names shots exactly as layout-check does", () => {
  assert.equal(screenshotName("Home", 360), "Home-360.png");
  assert.equal(screenshotName("Settings", 320), "Settings-320.png");
  assert.equal(screenshotName("Builder Race language choice", 393), "Builder-Race-language-choice-393.png");
});

test("deepLinkForRoute maps a scenario route to the app's link scheme", () => {
  assert.equal(deepLinkForRoute("/"), "dnd5e2014characterbuilder://");
  assert.equal(deepLinkForRoute("/options"), "dnd5e2014characterbuilder://options");
  assert.equal(deepLinkForRoute("/character/char_rendar"), "dnd5e2014characterbuilder://character/char_rendar");
});

test("needsNativeSteps flags scenarios with tabs, open, modal or scrollTo", () => {
  const screens: any[] = buildScreens({ integrated: false });
  const byName = (name: string) => screens.find((screen) => screen.name === name);
  assert.equal(needsNativeSteps(byName("Home")), false);
  assert.equal(needsNativeSteps(byName("Settings")), false);
  assert.equal(needsNativeSteps(byName("Stats")), true);
  assert.equal(needsNativeSteps(byName("New Character modal")), true);
  assert.equal(needsNativeSteps({ name: "x", route: "/", ready: "r", scrollTo: "y" }), true);
  assert.equal(needsNativeSteps({ name: "x", route: "/", ready: "r", tabs: ["Stats"] }), true);
  assert.equal(needsNativeSteps({ name: "x", route: "/", ready: "r" }), false);
});

test("the runner's seed file name matches the app's E2E_SEED_FILE_NAME", () => {
  const source = readFileSync(fileURLToPath(new URL("../src/services/e2eSeedImport.ts", import.meta.url)), "utf8");
  const match = /E2E_SEED_FILE_NAME\s*=\s*"([^"]+)"/.exec(source);
  assert.ok(match, "E2E_SEED_FILE_NAME must be exported as a string literal");
  assert.equal(SEED_FILE_NAME, match[1]);
});

test("PNG_SIGNATURE is the 8-byte PNG file signature", () => {
  assert.deepEqual([...PNG_SIGNATURE], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

// --- AC-11: the Metro cache is separated per flag value ---

test("buildEnv gives each flag value its own Metro cache folder through TMPDIR", () => {
  const e2e = buildEnv({ sdk: SDK, e2e: true, env: {}, tmpdir: "/tmp" });
  const plain = buildEnv({ sdk: SDK, e2e: false, env: {}, tmpdir: "/tmp" });
  assert.equal(e2e.EXPO_PUBLIC_E2E, "1");
  assert.equal("EXPO_PUBLIC_E2E" in plain, false);
  assert.equal(e2e.ANDROID_HOME, SDK);
  assert.equal(e2e.ANDROID_SDK_ROOT, SDK);
  assert.notEqual(e2e.TMPDIR, plain.TMPDIR);
  assert.equal(e2e.TMPDIR, metroCacheRoot({ e2e: true, tmpdir: "/tmp" }));
  assert.equal(plain.TMPDIR, metroCacheRoot({ e2e: false, tmpdir: "/tmp" }));
  assert.ok(metroCacheRoot({ e2e: true, tmpdir: "/tmp" }).includes("e2e"));
  assert.ok(!metroCacheRoot({ e2e: false, tmpdir: "/tmp" }).includes("e2e"));
});

// --- AC-16: an ONLY term that matches nothing exits 2 before touching any device ---

test("an unmatched ONLY term exits 2, lists the scenario names and never calls adb", async () => {
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "home,zzz-no-such" } });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes("zzz-no-such"));
  assert.ok(world.errors.join("\n").includes("Home"));
  assert.equal(world.calls.length, 0);
});

test("--list prints the scenario names as JSON and touches nothing", async () => {
  const world = makeWorld({ argv: ["--list"] });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(world.logs[0]), buildScreens({ integrated: false }).map((s: { name: string }) => s.name));
  assert.equal(world.calls.length, 0);
});

test("--integrated switches the scenario list the ONLY terms match against", async () => {
  const srd = makeWorld({ ...emulatorWorld, env: { ONLY: "tiefling" }, argv: ["--no-build"] });
  assert.equal(await srd.runRun(), 2);
  const integrated = makeWorld({ ...emulatorWorld, env: { ONLY: "tiefling" }, argv: ["--no-build", "--integrated"] });
  assert.equal(await integrated.runRun(), 0);
});

// --- AC-8: the runner refuses anything that is not an emulator ---

test("a non-emulator device exits non-zero before any clear, install, launch or density change", async () => {
  const world = makeWorld({ devices: "HTC123\tdevice\n" });
  const code = await world.runRun();
  assert.notEqual(code, 0);
  assert.ok(world.errors.join("\n").includes("HTC123"));
  const mutating = world.calls.filter((c) => /install|am start|wm density|emu kill|gradlew|pm clear|force-stop|run-as/.test(`${c.command} ${c.args.join(" ")}`));
  assert.deepEqual(mutating, []);
  assert.equal(world.starts.length, 0);
});

// --- AC-10: reuse a running emulator, never stop it ---

test("a running emulator is reused and never stopped", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.starts.length, 0);
  assert.equal(world.callsTo("emu kill").length, 0);
  assert.equal(world.callsTo(`install -r ${APK}`).length, 1);
  // One deep-link launch per runnable scenario at the one width: Home and Settings.
  assert.equal(world.callsTo("am start").length, 2);
});

// --- AC-10: with none running, boot headless, wait for boot, stop it at the end ---

test("with no device the runner boots Small_Phone headless, waits for boot and stops it at the end", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ devices: "", bootDevices: "emulator-5554\tdevice\n", env: { WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.starts.length, 1);
  assert.equal(world.starts[0].bin, join(SDK, "emulator", "emulator"));
  assert.deepEqual(world.starts[0].args, ["-avd", "Small_Phone", "-no-snapshot-save", "-no-audio", "-no-window", "-gpu", "host"]);
  assert.ok(world.callsTo("getprop sys.boot_completed").length >= 1);
  assert.equal(world.callsTo("-s emulator-5554 emu kill").length, 1);
});

test("--window boots windowed (no -no-window)", async () => {
  const world = makeWorld({ devices: "", bootDevices: "emulator-5554\tdevice\n", argv: ["--no-build", "--window"] });
  assert.equal(await world.runRun(), 0);
  assert.ok(!world.starts[0].args.includes("-no-window"));
});

test("an emulator that never finishes booting is reported and killed", async () => {
  const world = makeWorld({ devices: "", bootDevices: "emulator-5554\toffline\n", bootCompleted: "0" });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes("sys.boot_completed"));
  assert.equal(world.callsTo("emu kill").length, 1);
  assert.equal(world.callsTo("install").length, 0);
});

// --- AC-9: widths set densities, the original density is restored, also after a failure ---

test("each width sets its density and the original density is restored once at the end", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320,412", SHOTS: shots } });
  assert.equal(await world.runRun(), 0);
  const setCalls = world.callsTo("wm density").filter((c) => c.args.includes("360") || c.args.includes("280"));
  assert.deepEqual(setCalls.map((c) => c.args.at(-1)), ["360", "280"]);
  assert.equal(world.callsTo("wm density reset").length, 1);
  // Two runnable scenarios (Home, Settings) per width.
  assert.equal(world.callsTo("am start").length, 4);
  // The original density is read before the first change.
  const read = world.callsTo("wm density").find((c) => c.args.at(-1) === "density");
  assert.ok(read);
});

test("a pre-existing override density is put back instead of reset", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, wmDensity: "Physical density: 320\nOverride density: 440\n", env: { WIDTHS: "360", SHOTS: shots } });
  assert.equal(await world.runRun(), 0);
  const restores = world.callsTo("wm density").filter((c) => c.args.at(-1) !== "density" && c.args.at(-1) !== "320");
  assert.deepEqual(restores.map((c) => c.args.at(-1)), ["440"]);
});

test("a scenario launch failure still restores the density and exits non-zero", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320,360", SHOTS: shots }, amStartCodeFor: (n) => (n === 2 ? 1 : 0) });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.equal(world.callsTo("wm density reset").length, 1);
  // The failing scenario does not stop the run: every scenario at both widths is attempted.
  assert.equal(world.callsTo("am start").length, 4);
});

test("the signal-handler cleanup is idempotent with the finally cleanup", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320", SHOTS: shots }, amStartCodeFor: () => 1 });
  assert.equal(await world.runRun(), 1);
  assert.equal(world.handlers.length, 1);
  world.handlers[0]();
  assert.equal(world.callsTo("wm density reset").length, 1);
  assert.equal(world.callsTo("emu kill").length, 0);
});

// --- AC-11: build unless --no-build, install with adb install -r ---

test("without --no-build the runner runs the Gradle E2E build with the E2E environment and installs with -r", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, argv: [], env: { WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  const gradle = world.callsTo("gradlew");
  assert.equal(gradle.length, 1);
  assert.deepEqual(gradle[0].args, gradleArgs());
  assert.equal(gradle[0].options?.cwd, join(ROOT, "android"));
  assert.equal(gradle[0].options?.timeoutMs, BUILD_TIMEOUT_MS);
  const gradleEnv = gradle[0].options?.env as Record<string, string>;
  assert.equal(gradleEnv.EXPO_PUBLIC_E2E, "1");
  assert.equal(gradleEnv.ANDROID_HOME, SDK);
  assert.equal(gradleEnv.TMPDIR, metroCacheRoot({ e2e: true, tmpdir: "/tmp" }));
  // A passing build streams nothing.
  assert.ok(!world.logs.join("\n").includes("BUILD SUCCESSFUL"));
  assert.equal(world.callsTo(`install -r ${APK}`).length, 1);
});

test("a failing Gradle build exits 1, prints its output and installs nothing", async () => {
  const world = makeWorld({ ...emulatorWorld, argv: [], gradleCode: 1, gradleStderr: "FAILURE: Build failed with an exception." });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("FAILURE: Build failed"));
  assert.equal(world.callsTo("install").length, 0);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("--no-build skips Gradle and installs the APK already built", async () => {
  const world = makeWorld({ ...emulatorWorld, argv: ["--no-build"] });
  assert.equal(await world.runRun(), 0);
  assert.equal(world.callsTo("gradlew").length, 0);
  assert.equal(world.callsTo(`install -r ${APK}`).length, 1);
});

test("a missing android/ project stops with the prebuild hint", async () => {
  const world = makeWorld({ ...emulatorWorld, argv: [], missing: ["gradlew"] });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes("npx expo prebuild --platform android --no-install"));
  assert.equal(world.callsTo("gradlew").length, 0);
});

test("a missing APK stops the run before installing", async () => {
  const world = makeWorld({ ...emulatorWorld, argv: ["--no-build"], missing: ["app-release.apk"] });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes("app-release.apk"));
  assert.equal(world.callsTo("install").length, 0);
});

test("a failing install exits non-zero and restores the density", async () => {
  const world = makeWorld({ ...emulatorWorld, installCode: 1, env: { WIDTHS: "360" } });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("INSTALL_FAILED_OLDER_SDK"));
  assert.equal(world.callsTo("wm density reset").length, 1);
  assert.equal(world.callsTo("am start").length, 0);
});

// --- AC-12: one scenario end to end with the fake adb ---

// Maps each recorded call to a marker, so a test can assert the exact order of the device interactions.
function markersOf(world: { calls: Call[] }) {
  return world.calls
    .map((c) => {
      const j = `${c.command} ${c.args.join(" ")}`;
      if (/wm density \d+|wm density reset/.test(j)) return `set-density:${c.args.at(-1)}`;
      if (j.includes("wm density")) return "read-density";
      if (j.includes("install")) return "install";
      if (j.includes("am force-stop")) return "force-stop";
      if (j.includes("pm clear")) return "pm-clear";
      if (j.includes("push")) return "push-seed";
      if (j.includes("run-as") && j.includes("mkdir")) return "mkdir-files";
      if (j.includes("run-as") && j.includes("cp")) return "seed-copy";
      if (j.includes("rm -f")) return "rm-tmp";
      if (j.includes("am start")) return "am-start";
      if (j.includes("uiautomator")) return "dump";
      if (j.includes("exec-out")) return "cat-dump";
      if (j.includes("screencap")) return "screencap";
      if (j.includes("pull")) return "pull";
      if (j.includes("devices")) return "devices";
      if (j.includes("getprop")) return "getprop";
      return null;
    })
    .filter((m) => m !== null);
}

test("one scenario runs end to end: reset, seed copy, deep link, ready poll, screenshot pull", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Settings", WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.deepEqual(markersOf(world), [
    "devices",
    "read-density",
    "install",
    "set-density:320",
    "force-stop",
    "pm-clear",
    "push-seed",
    "mkdir-files",
    "seed-copy",
    "rm-tmp",
    "am-start",
    "dump",
    "cat-dump",
    "screencap",
    "pull",
    "set-density:reset",
  ]);
  // The seed was built once and written to the local staging file that adb push copies from.
  assert.equal(world.seedCalls, 1);
  assert.equal(world.writes.length, 1);
  assert.deepEqual(JSON.parse(world.writes[0].content), JSON.parse(FAKE_SEED));
  const push = world.callsTo("push")[0];
  assert.deepEqual(push.args.slice(-2), [world.writes[0].path, `/data/local/tmp/${SEED_FILE_NAME}`]);
  // The seed copy goes through run-as into the app's private files folder, and the temp file is removed.
  const runAs = world.callsTo("run-as");
  const copy = runAs.find((c) => c.args.includes("cp"));
  const mkdir = runAs.find((c) => c.args.includes("mkdir"));
  assert.ok(copy && mkdir);
  assert.deepEqual(copy.args.slice(copy.args.indexOf("shell")), ["shell", "run-as", APP_ID, "cp", `/data/local/tmp/${SEED_FILE_NAME}`, `files/${SEED_FILE_NAME}`]);
  assert.deepEqual(mkdir.args.slice(mkdir.args.indexOf("shell")), ["shell", "run-as", APP_ID, "mkdir", "-p", "files"]);
  assert.equal(world.callsTo("rm -f").length, 1);
  // The launch is the scenario's route by deep link, with the URI quoted for the device shell.
  const start = world.callsTo("am start")[0];
  assert.deepEqual(start.args.slice(start.args.indexOf("shell")), [
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    '"dnd5e2014characterbuilder://options"',
    APP_ID,
  ]);
  // The screenshot is taken on the device and pulled to <scenario>-<width>.png in SHOTS.
  const screencap = world.callsTo("screencap")[0];
  assert.deepEqual(screencap.args.slice(-2), ["-p", "/sdcard/Settings-360.png"]);
  const pull = world.callsTo("pull")[0];
  const target = join(shots, "Settings-360.png");
  assert.deepEqual(pull.args.slice(-2), ["/sdcard/Settings-360.png", target]);
  const png = readFileSync(target);
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 8);
  assert.ok(world.logs.join("\n").includes("Settings-360.png"));
});

test("the ready text is polled until it shows", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
    dumpXml: (poll) => (poll < 3 ? "<hierarchy><node text=\"Loading\" bounds=\"[0,0][10,10]\" /></hierarchy>" : DEFAULT_DUMP),
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.dumps, 3);
  assert.equal(world.callsTo("screencap").length, 1);
});

test("a scenario whose ready text never shows is reported failed and the run exits non-zero", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Settings", WIDTHS: "360", SHOTS: shots },
    dumpXml: "<hierarchy><node text=\"Something Else\" bounds=\"[0,0][10,10]\" /></hierarchy>",
    readyTimeoutMs: 1000,
    readyPollMs: 500,
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("ready"));
  assert.ok(world.errors.join("\n").includes("Settings"));
  // No screenshot is taken for a failed scenario, and the density is still restored.
  assert.equal(world.callsTo("screencap").length, 0);
  assert.equal(world.callsTo("pull").length, 0);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a selected scenario with tabs, open, modal or scrollTo is listed as needing native steps and skipped", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Stats", WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.ok(world.logs.join("\n").includes("needs native steps"));
  assert.ok(world.logs.join("\n").includes("Stats"));
  assert.equal(world.callsTo("am start").length, 0);
  assert.equal(world.callsTo("pm clear").length, 0);
  assert.equal(world.seedCalls, 0);
});

test("a failing seed copy stops the scenario with a non-zero exit and no launch", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots }, seedCopyCode: 1 });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("seed"));
  assert.equal(world.callsTo("am start").length, 0);
  assert.equal(world.callsTo("screencap").length, 0);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a pulled file that is not a PNG fails the scenario", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
    pullBytes: Buffer.from("this is not a png at all"),
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("PNG"));
  assert.ok(world.errors.join("\n").includes("Home"));
  assert.equal(world.callsTo("wm density reset").length, 1);
});
