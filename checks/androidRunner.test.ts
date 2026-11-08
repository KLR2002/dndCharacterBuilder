import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { E2E_BUNDLE_INPUTS_MARKER } from "../plugins/lib/e2e-build-transforms.mjs";
import { tmpdir as osTmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ADB_TIMEOUT_MS,
  APP_ID,
  AVD_NAME,
  BUILD_TIMEOUT_MS,
  DUMP_REMOTE,
  DUMP_TIMEOUT_MS,
  INSTALL_TIMEOUT_MS,
  MAX_EMULATOR_RECOVERIES,
  PNG_SIGNATURE,
  SCREENCAP_TIMEOUT_MS,
  SEED_FILE_NAME,
  apkPath,
  buildEnv,
  deepLinkForRoute,
  densityForWidth,
  emulatorArgs,
  emulatorEnv,
  gradleArgs,
  invalidWidthEntries,
  isEmulatorSerial,
  metroCacheRoot,
  parseAdbDevices,
  parseOnly,
  parseSystemBarHeights,
  parseWidths,
  parseWmDensity,
  parseWmSize,
  restoreDensityArgs,
  runAndroid,
  runShotsDir,
  screenshotName,
  sdkPaths,
  selected,
  unmatchedOnlyTerms,
} from "../scripts/lib/android-runner.mjs";
import { buildScreens, buildSeed } from "../scripts/lib/scenarios.mjs";
import { parseE2eSeed } from "../src/services/e2eSeedImport.ts";

// The native screenshot runner core (scripts/lib/android-runner.mjs, driven by scripts/layout-android.mjs).
// Every device interaction goes through one injectable executor `run(command, args, options)`, so these
// tests use a fake adb/emulator that records its calls and returns scripted output: the serial guard
// (AC-8), the width-to-density mapping and the density restore (AC-9), the reuse/boot/stop lifecycle
// (AC-10), the build step and its Metro cache separation (AC-11), the ONLY validation (AC-16) and the
// seeded scenario execution (AC-12): reset, seed copy with run-as, deep-link launch, ready polling on
// uiautomator dumps, and the pulled PNG screenshot. It also pins the isolation between scenarios
// (AC-15): the first scenario of a width and every `fresh` scenario reset and reseed, a `modal`
// scenario force-stops and relaunches without clearing, any other scenario only jumps by deep link,
// and a scenario on the previous scenario's route does not even launch; the launch is retried once;
// and the stuck screen of a scenario that fails after launch is saved as `<scenario>-<width>-FAILED.png`
// while the run continues and exits non-zero (AC-14). It also pins a lost emulator (AC-18): the fake
// device goes offline at a chosen get-state or dump poll and comes back after an emulator start, so
// with a runner-started emulator the run reboots it (at most twice), reinstalls the APK, sets the
// width's density again and repeats the scenario in reset+seed mode, and with a reused emulator the
// run stops at that scenario with a message and a non-zero exit. It also pins the step player (AC-13): tabs and
// open steps as taps on the matching dump node, the modal title waited for as the ready text, scrollTo
// as swipes until the needle is visible, expect ignored, and web-only scenarios listed and skipped.

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

// The `dumpsys window windows` output the step player reads the bar heights from: both system bars are
// `fillx48`; the NAVIGATION_BAR_PANEL line must not count as the bar.
const DEFAULT_BARS =
  `    mAttrs={(0,0)(fillx48) gr=TOP CENTER_VERTICAL ty=STATUS_BAR fmt=TRANSLUCENT\n` +
  `    mAttrs={(0,0)(210x536) ty=NAVIGATION_BAR_PANEL fmt=TRANSLUCENT\n` +
  `    mAttrs={(0,0)(fillx48) gr=BOTTOM CENTER_VERTICAL ty=NAVIGATION_BAR fmt=TRANSLUCENT\n`;

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
  pullCodeFor?: (remote: string, n: number) => number;
  dumpXml?: string | ((poll: number) => string);
  wmSize?: string;
  bars?: string;
  pullBytes?: Buffer;
  gradleCode?: number;
  gradleStdout?: string;
  gradleStderr?: string;
  missing?: string[];
  env?: Record<string, string | undefined>;
  argv?: string[];
  readyTimeoutMs?: number;
  readyPollMs?: number;
  // The device goes offline when the Nth get-state call (or the Nth dump poll) happens, and comes
  // back when startEmulator runs again (a reboot). While offline, `adb devices` lists nothing and
  // every `-s <serial>` command fails the way a dead device does.
  offlineAtGetStates?: number[];
  offlineAtDumps?: number[];
  // The `adb devices` output and the sys.boot_completed value after the Nth emulator start, so a
  // reboot can come back on another serial or never finish booting.
  bootDevicesFor?: (start: number) => string;
  bootCompletedFor?: (start: number) => string;
  // The `adb devices` output of the Nth devices call, to script a device that is offline on the
  // first call and ready later (an emulator listed but not ready yet, adopted without a boot).
  devicesFor?: (call: number) => string;
  // The uiautomator dump command's exit code / stdout of the Nth dump, so a failed dump can be
  // scripted (a non-zero exit, or a zero exit whose output does not report the dump).
  dumpCodeFor?: (dump: number) => number;
  dumpStdoutFor?: (dump: number) => string;
  // Fire the recorded signal handler during the Nth sleep call (an async sleep that yields to the
  // event loop first, the way the real setTimeout sleep does), with this signal name.
  signalAtSleep?: number;
  signalName?: string;
  // The fake clock's start, so two runs can get different screenshot-folder timestamps.
  startClock?: number;
  // Folders under <tmpRoot>/layout-android that already exist (for the taken-name suffix).
  existingLayoutDirs?: string[];
  /** The text of android/app/build.gradle the fake returns; the default carries the E2E bundle-input marker. */
  gradleText?: string;
  // The fake os.tmpdir() of the world, so tests can isolate their run folders.
  tmpRoot?: string;
}) {
  const calls: Call[] = [];
  const starts: { bin: string; args: string[]; logPath: string; env?: Record<string, string> }[] = [];
  const handlers: ((signal?: string) => void)[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const writes: { path: string; content: string }[] = [];
  const sleeps: number[] = [];
  const createdDirs = new Set<string>();
  const tempDirs: string[] = [];
  const removedDirs: string[] = [];
  let seedCalls = 0;
  let emulatorStarted = false;
  let startCount = 0;
  let offline = false;
  let getStateCalls = 0;
  let amStarts = 0;
  let pulls = 0;
  let dumps = 0;
  let devicesCalls = 0;
  let dumpCalls = 0;
  let clock = options.startClock ?? 0;
  const tmpRoot = options.tmpRoot ?? "/tmp";
  const missing = options.missing ?? [];
  const run = (command: string, args: string[], opts?: Record<string, unknown>) => {
    calls.push({ command, args: [...args], options: opts });
    const joined = args.join(" ");
    const reply = (code: number, stdout = "", stderr = "") => ({ code, stdout, stderr });
    if (args[0] === "devices") {
      devicesCalls += 1;
      const body = options.devicesFor
        ? options.devicesFor(devicesCalls)
        : offline
          ? ""
          : emulatorStarted
            ? (options.bootDevicesFor ? options.bootDevicesFor(startCount) : (options.bootDevices ?? ""))
            : (options.devices ?? "");
      return reply(0, `List of devices attached\n${body}\n`);
    }
    if (args.includes("get-state")) {
      getStateCalls += 1;
      if (options.offlineAtGetStates?.includes(getStateCalls)) offline = true;
      return offline ? reply(1, "", "adb: device offline\n") : reply(0, "device\n");
    }
    // A dead device answers every `-s <serial>` command quickly with an error.
    if (offline && args[0] === "-s") return reply(1, "", `adb: device '${args[1]}' not found\n`);
    if (joined.includes("getprop sys.boot_completed")) {
      const completed = options.bootCompletedFor ? options.bootCompletedFor(startCount) : (options.bootCompleted ?? "1");
      return reply(0, `${completed}\n`);
    }
    if (joined.includes("wm density") && !/wm density \d+|wm density reset/.test(joined)) {
      return reply(0, options.wmDensity ?? "Physical density: 320\n");
    }
    if (joined.includes("wm size")) return reply(0, options.wmSize ?? "Physical size: 720x1280\n");
    if (joined.includes("dumpsys window windows")) return reply(0, options.bars ?? DEFAULT_BARS);
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
    if (args.includes("uiautomator")) {
      dumpCalls += 1;
      const code = options.dumpCodeFor ? options.dumpCodeFor(dumpCalls) : 0;
      if (code !== 0) return reply(code, "", "ERROR: could not dump the hierarchy\n");
      return reply(0, options.dumpStdoutFor ? options.dumpStdoutFor(dumpCalls) : "UI hierchary dumped to: /sdcard/e2e-dump.xml\n");
    }
    if (args.includes("exec-out")) {
      dumps += 1;
      if (options.offlineAtDumps?.includes(dumps)) offline = true;
      if (offline) return reply(1, "", "adb: device offline\n");
      const xml = typeof options.dumpXml === "function" ? options.dumpXml(dumps) : (options.dumpXml ?? DEFAULT_DUMP);
      return reply(0, xml);
    }
    if (args.includes("screencap")) return reply(0);
    if (args.includes("pull")) {
      pulls += 1;
      const remote = args[args.indexOf("pull") + 1];
      const code = options.pullCodeFor ? options.pullCodeFor(remote, pulls) : (options.pullCode ?? 0);
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
      // Without an explicit ONLY the world visits the two step-free scenarios (Home, Settings), the ones
      // the scripted dumps satisfy. LD_LIBRARY_PATH is set so the tests can see it stripped from the
      // spawned emulator's environment.
      env: { ONLY: "Home,Settings", PATH: "/usr/bin", LD_LIBRARY_PATH: "/opt/broken/lib", ...(options.env ?? {}) },
      argv: options.argv ?? ["--no-build"],
      run,
      // A real asynchronous sleep: it yields to the event loop, so a signal handler fired from it
      // runs while the runner is waiting.
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
        if (options.signalAtSleep === sleeps.length && handlers.length > 0) handlers[0](options.signalName ?? "SIGINT");
      },
      now: () => clock,
      startEmulator: (bin: string, args: string[], logPath: string, emuEnv?: Record<string, string>) => {
        startCount += 1;
        starts.push({ bin, args: [...args], logPath, env: emuEnv });
        emulatorStarted = true;
        // A fresh emulator process brings the device back.
        offline = false;
        return 4321;
      },
      fileExists: (p: string) => {
        if (missing.some((m) => p.includes(m))) return false;
        // mkdir is real below, so the layout-android run folders and the pulled screenshots exist on
        // disk; the option pre-registers extra taken names.
        if (p.startsWith(join(tmpRoot, "layout-android") + "/")) return existsSync(p) || (options.existingLayoutDirs?.includes(p) ?? false);
        return true;
      },
      writeFile: (p: string, content: string) => {
        writes.push({ path: p, content });
      },
      readFile: (p: string) => (p.endsWith(join("app", "build.gradle")) ? Buffer.from(options.gradleText ?? E2E_BUNDLE_INPUTS_MARKER) : readFileSync(p)),
      makeSeed: () => {
        seedCalls += 1;
        return FAKE_SEED;
      },
      mkdir: (p: string) => {
        createdDirs.add(p);
        mkdirSync(p, { recursive: true });
      },
      makeTempDir: (prefix: string) => {
        const dir = `${prefix}q7x9k2`;
        tempDirs.push(dir);
        return dir;
      },
      removeDir: (p: string) => {
        removedDirs.push(p);
      },
      tmpdir: () => tmpRoot,
      homeDir: HOME,
      installSignalHandlers: (handler: (signal?: string) => void) => handlers.push(handler),
      log: (m: string) => logs.push(m),
      errorLog: (m: string) => errors.push(m),
      readyTimeoutMs: options.readyTimeoutMs ?? 1000,
      readyPollMs: options.readyPollMs ?? 500,
      bootTimeoutMs: 60,
    });
  const callsTo = (needle: string) => calls.filter((c) => `${c.command} ${c.args.join(" ")}`.includes(needle));
  return {
    calls,
    starts,
    handlers,
    logs,
    errors,
    writes,
    sleeps,
    tempDirs,
    removedDirs,
    runRun,
    callsTo,
    get seedCalls() { return seedCalls; },
    get dumps() { return dumps; },
    get pulls() { return pulls; },
  };
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
  assert.deepEqual(headless, ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio", "-gpu", "angle_indirect", "-no-window"]);
  const windowed = emulatorArgs({ windowed: true });
  assert.deepEqual(windowed, ["-avd", AVD_NAME, "-no-snapshot-save", "-no-audio", "-gpu", "angle_indirect"]);
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

test("parseWmSize reads the physical screen size", () => {
  assert.deepEqual(parseWmSize("Physical size: 720x1280\n"), { width: 720, height: 1280 });
  assert.deepEqual(parseWmSize("Override size: 720x1280\nPhysical size: 720x1280\n"), { width: 720, height: 1280 });
  assert.equal(parseWmSize("Override size: 1080x2400\n"), null);
});

test("parseSystemBarHeights reads the status and gesture bar heights, ignoring the nav bar panel", () => {
  assert.deepEqual(parseSystemBarHeights(DEFAULT_BARS), { topBar: 48, bottomBar: 48 });
  assert.deepEqual(parseSystemBarHeights(""), { topBar: 0, bottomBar: 0 });
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
  // The integrated list holds the two Tiefling scenarios; their dumps carry the tabs, the choice row and
  // the CHA pick, so both play through.
  const tiefling0 =
    `<hierarchy><node text="Builder" bounds="[80,187][157,220]" /><node text="Race" bounds="[316,320][375,356]" />` +
    `<node text="CHA" bounds="[10,500][60,540]" /><node text="Choose +2 to 1 ability score (0/1 chosen)" bounds="[52,600][600,650]" /></hierarchy>`;
  const tiefling1 = tiefling0.replace("(0/1 chosen)", "(1/1 chosen)");
  const integrated = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "tiefling", WIDTHS: "360" },
    argv: ["--no-build", "--integrated"],
    dumpXml: (poll) => (poll <= 4 ? tiefling0 : tiefling1),
  });
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
  assert.deepEqual(world.starts[0].args, ["-avd", "Small_Phone", "-no-snapshot-save", "-no-audio", "-gpu", "angle_indirect", "-no-window"]);
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
  // Every launch from the second on fails both its attempts, so Settings fails at 320 and both
  // scenarios fail at 360 (Home is the first of the width and resets+seeds first).
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320,360", SHOTS: shots }, amStartCodeFor: (n) => (n > 1 ? 1 : 0) });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.equal(world.callsTo("wm density reset").length, 1);
  // The failing scenario does not stop the run: every scenario at both widths is attempted, and each
  // failed launch was retried once (7 launches = 1 + 2 + 2 + 2).
  assert.equal(world.callsTo("am start").length, 7);
  assert.equal(world.callsTo("pm clear").length, 2);
  // Home at 320 passed (its launch was the first), the other three scenarios failed on their launches.
  assert.ok(existsSync(join(shots, "Home-320.png")));
  // A launch failure is a failure before the app was launched: no FAILED screenshot is saved for them.
  const remotes = world.callsTo("screencap").map((c) => c.args.at(-1) as string);
  assert.deepEqual(remotes, ["/sdcard/Home-320.png"]);
  assert.ok(world.callsTo("pull").every((c) => !c.args.join(" ").includes("FAILED")));
});

test("the signal-handler cleanup is idempotent with the finally cleanup", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: "320", SHOTS: shots }, amStartCodeFor: () => 1 });
  assert.equal(await world.runRun(), 1);
  assert.equal(world.handlers.length, 1);
  world.handlers[0]("SIGINT");
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

test("a generated android/ project without the bundle-input wiring stops with the prebuild hint", async () => {
  const world = makeWorld({ ...emulatorWorld, argv: [], gradleText: "android { buildTypes { release { } } }" });
  const code = await world.runRun();
  assert.equal(code, 2);
  const errors = world.errors.join("\n");
  assert.ok(errors.includes("npx expo prebuild --platform android --no-install"));
  assert.ok(errors.includes(E2E_BUNDLE_INPUTS_MARKER));
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

// A dump that satisfies every scenario of the isolation test below at once: the tab names, the
// open-step targets (text, pattern and label), the ready texts, the modal titles and the scrollTo
// needles, all with on-screen bounds.
const ISOLATION_DUMP =
  `<hierarchy>` +
  `<node text="Builder" bounds="[80,187][157,220]" />` +
  `<node text="Abilities" bounds="[180,187][260,220]" />` +
  `<node text="Race" bounds="[316,320][375,356]" />` +
  `<node text="Class" bounds="[400,320][460,356]" />` +
  `<node text="Stats" bounds="[241,187][297,220]" />` +
  `<node text="5 points remaining" bounds="[10,500][200,540]" />` +
  `<node text="Granted Languages:" bounds="[10,620][300,660]" />` +
  `<node text="Selected Ability Improvements" bounds="[10,680][400,720]" />` +
  `<node text="Total Level 1" bounds="[10,740][300,780]" />` +
  `<node text="Fighting Styles" bounds="[10,800][300,840]" />` +
  `<node text="Take Rest (Short / Long)" bounds="[80,298][346,364]" />` +
  `<node text="Add Language" bounds="[100,400][620,450]" />` +
  `<node text="Rest &amp; Recovery" bounds="[100,900][620,950]" />` +
  `<node text="" content-desc="Add language" bounds="[500,1000][600,1040]" />` +
  `<node text="5e Character Builder" bounds="[0,0][300,60]" />` +
  `</hierarchy>`;

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
      if (j.includes("rm -f") && j.includes(DUMP_REMOTE)) return "rm-dump";
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

// The markers of the scenario isolation calls only (no device lifecycle, no dump polls), in order.
function structuralMarkersOf(world: { calls: Call[] }) {
  const structural = new Set(["force-stop", "pm-clear", "push-seed", "mkdir-files", "seed-copy", "rm-tmp", "am-start", "screencap", "pull"]);
  return markersOf(world).filter((m) => structural.has(m));
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
    "rm-dump",
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
  // The seed's temp remote file is removed, and the remote dump file is deleted before the dump.
  const rmCalls = world.callsTo("rm -f");
  assert.equal(rmCalls.length, 2);
  assert.ok(rmCalls.some((c) => c.args.includes(DUMP_REMOTE)));
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

test("a scenario whose ready text never shows saves its stuck screen as -FAILED.png and exits non-zero", async () => {
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
  // The app was launched, so the stuck screen is saved as <scenario>-<width>-FAILED.png (same screencap
  // and pull as a normal screenshot), its path is logged, and no normal screenshot is taken.
  const failed = join(shots, "Settings-360-FAILED.png");
  assert.equal(world.callsTo("screencap").length, 1);
  assert.equal(world.callsTo("pull").length, 1);
  const screencap = world.callsTo("screencap")[0];
  assert.deepEqual(screencap.args.slice(-2), ["-p", "/sdcard/Settings-360-FAILED.png"]);
  const pull = world.callsTo("pull")[0];
  assert.deepEqual(pull.args.slice(-2), ["/sdcard/Settings-360-FAILED.png", failed]);
  assert.ok(world.logs.join("\n").includes(failed));
  assert.ok(existsSync(failed));
  assert.deepEqual([...readFileSync(failed).subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(!existsSync(join(shots, "Settings-360.png")));
  // The density is still restored.
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a web-only scenario among the selected ones is listed as skipped and never run", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "New Character modal,Home", WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.ok(world.logs.join("\n").includes("Skipping New Character modal: web-only"));
  // Only Home ran: one launch, one screenshot, one reset+seed.
  assert.equal(world.callsTo("am start").length, 1);
  assert.equal(world.callsTo("pm clear").length, 1);
  assert.equal(world.callsTo("input tap").length, 0);
  assert.ok(existsSync(join(shots, "Home-360.png")));
});

test("a failing seed copy stops the scenario with a non-zero exit and no launch", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots }, seedCopyCode: 1 });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("seed"));
  // A failure before the launch (the reset or the seed copy) writes no FAILED screenshot.
  assert.equal(world.callsTo("am start").length, 0);
  assert.equal(world.callsTo("screencap").length, 0);
  assert.equal(world.callsTo("pull").length, 0);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a failing pm clear stops the scenario before launch with no FAILED screenshot", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots }, clearCode: 1 });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("pm clear"));
  assert.equal(world.callsTo("am start").length, 0);
  assert.equal(world.callsTo("screencap").length, 0);
  assert.equal(world.callsTo("pull").length, 0);
  assert.ok(!existsSync(join(shots, "Home-360-FAILED.png")));
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

// --- AC-13: the step fields play on the dumps ---

// Dumps for the step scenarios: the tab bar with "Stats", the Stats screen with the Take Rest row, the same
// with the Rest modal's title, and the Builder Class screen with and without the scrollTo needle.
const STATS_DUMP =
  `<hierarchy><node text="Stats" bounds="[241,187][297,220]" />` +
  `<node text="Take Rest (Short / Long)" bounds="[80,298][346,364]" /></hierarchy>`;
const MODAL_DUMP = STATS_DUMP.replace("</hierarchy>", `<node text="Rest &amp; Recovery" bounds="[100,400][620,450]" /></hierarchy>`);
const BM_DUMP =
  `<hierarchy><node text="Stats" bounds="[241,187][297,220]" />` +
  `<node text="Hit Points" bounds="[0,100][200,140]" /></hierarchy>`;
const NEEDLE_DUMP = BM_DUMP.replace("</hierarchy>", `<node text="Superiority Dice: 4d8 + 2d6" bounds="[52,900][500,950]" /></hierarchy>`);

test("a scenario with tabs, an open step and a modal plays them as taps and a ready wait, then screenshots", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Rest modal", WIDTHS: "360", SHOTS: shots },
    dumpXml: (poll) => (poll === 1 ? STATS_DUMP : MODAL_DUMP),
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  // The Stats tab at [241,187][297,220] and the Take Rest row at [80,298][346,364] are tapped; the modal
  // title at [100,400][620,450] (centre 360,425) is waited for as the ready text, never tapped.
  const taps = world.callsTo("input tap").map((c) => c.args.slice(-2));
  assert.deepEqual(taps, [
    ["269", "204"],
    ["213", "331"],
  ]);
  assert.ok(!taps.some((t) => t.join(",") === "360,425"));
  // The tab wait (500 ms) and the modal settle wait (500 ms); the ready text showed on the first poll.
  assert.deepEqual(world.sleeps, [500, 500]);
  assert.equal(world.callsTo("screencap").length, 1);
  assert.equal(world.callsTo("pull").length, 1);
  assert.ok(world.logs.join("\n").includes("Rest-modal-360.png"));
});

test("scrollTo swipes once until a dump shows the needle visible, after tapping the tab", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Stats battle master superiority dice", WIDTHS: "360", SHOTS: shots },
    dumpXml: (poll) => (poll <= 3 ? BM_DUMP : NEEDLE_DUMP),
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  const taps = world.callsTo("input tap").map((c) => c.args.slice(-2));
  assert.deepEqual(taps, [["269", "204"]]);
  const swipes = world.callsTo("input swipe");
  assert.equal(swipes.length, 1);
  assert.deepEqual(swipes[0].args.slice(swipes[0].args.indexOf("swipe")), ["swipe", "360", "896", "360", "384", "300"]);
  assert.equal(world.callsTo("screencap").length, 1);
  assert.ok(world.logs.join("\n").includes("Stats-battle-master-superiority-dice-360.png"));
});

test("a tab whose target never shows fails the scenario, saves the -FAILED.png stuck screen and exits non-zero", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Stats", WIDTHS: "360", SHOTS: shots }, dumpXml: DEFAULT_DUMP });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes('tab "Stats" did not show'));
  assert.ok(world.errors.join("\n").includes("[360dp] Stats"));
  assert.equal(world.callsTo("input tap").length, 0);
  // The failed step target is a failure after launch: every selected scenario (ONLY "Stats" matches
  // five) saves its stuck screen as -FAILED.png, and no normal screenshot is taken.
  const failed = join(shots, "Stats-360-FAILED.png");
  assert.equal(world.callsTo("screencap").length, 5);
  assert.equal(world.callsTo("pull").length, 5);
  assert.ok(world.callsTo("screencap").every((c) => (c.args.at(-1) as string).includes("-FAILED.png")));
  assert.ok(existsSync(failed));
  assert.deepEqual([...readFileSync(failed).subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(!existsSync(join(shots, "Stats-360.png")));
  assert.ok(world.logs.join("\n").includes(failed));
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("expect is not evaluated: a scenario whose expect cannot hold still produces its screenshot", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  // "4 to review" is on screen, which the scenario's absentMatching would flag on web.
  const dump =
    `<hierarchy><node text="Stats" bounds="[241,187][297,220]" />` +
    `<node text="Hit Points" bounds="[0,100][200,140]" /><node text="4 to review" bounds="[10,600][200,650]" /></hierarchy>`;
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Review notices none", WIDTHS: "360", SHOTS: shots }, dumpXml: dump });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.callsTo("screencap").length, 1);
  assert.ok(world.logs.join("\n").includes("Review-notices-none-360.png"));
});

test("an absent scrollTo needle logs a warning naming the scenario and the needle, and the screenshot is still taken", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  // No dump ever shows the needle "Superiority Dice: 4d8 + 2d6".
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Stats battle master superiority dice", WIDTHS: "360", SHOTS: shots },
    dumpXml: BM_DUMP,
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  const warnings = world.logs.filter((m) => m.includes("warning"));
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes("[360dp] Stats battle master superiority dice"));
  assert.ok(warnings[0].includes('scrollTo "Superiority Dice: 4d8 + 2d6"'));
  assert.equal(world.errors.length, 0);
  assert.equal(world.callsTo("screencap").length, 1);
  assert.equal(world.callsTo("pull").length, 1);
  assert.ok(world.logs.join("\n").includes("Stats-battle-master-superiority-dice-360.png"));
});

// --- AC-15: the isolation between scenarios follows fresh, modal and route ---

// The scenarios in list order: Builder Abilities (Rendar), Builder Race language choice (Half-Elf),
// Builder Class feats (Half-Elf), Builder Class fighting styles card collapsed (Fighter, fresh),
// Stats add language modal (Rendar, modal), Rest modal (Rendar, modal), Home (/).
test("each scenario runs in its isolation mode and logs it: reset+seed, deep link, same route, relaunch", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: {
      ONLY: "Builder Abilities,Builder Race language choice,Builder Class feats,fighting styles card collapsed,Stats add language modal,Rest modal,Home",
      WIDTHS: "360",
      SHOTS: shots,
    },
    dumpXml: ISOLATION_DUMP,
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  // One log line per scenario naming the mode it used.
  assert.deepEqual(
    world.logs.filter((m) => /: (reset\+seed|relaunch|deep link|same route)$/.test(m)),
    [
      "[360dp] Builder Abilities: reset+seed",
      "[360dp] Builder Race language choice: deep link",
      "[360dp] Builder Class feats: same route",
      "[360dp] Builder Class fighting styles card collapsed: reset+seed",
      "[360dp] Stats add language modal: relaunch",
      "[360dp] Rest modal: relaunch",
      "[360dp] Home: deep link",
    ],
  );
  assert.deepEqual(structuralMarkersOf(world), [
    // The first scenario of the width: force-stop, clear, seed in, deep-link launch.
    "force-stop", "pm-clear", "push-seed", "mkdir-files", "seed-copy", "rm-tmp", "am-start", "screencap", "pull",
    // A different route: only the deep-link launch.
    "am-start", "screencap", "pull",
    // The same route as the previous scenario: not even a launch, the UI state carries over.
    "screencap", "pull",
    // fresh: clear and seed in again, then launch.
    "force-stop", "pm-clear", "push-seed", "mkdir-files", "seed-copy", "rm-tmp", "am-start", "screencap", "pull",
    // modal: force-stop and relaunch by deep link, without clearing or reseeding.
    "force-stop", "am-start", "screencap", "pull",
    "force-stop", "am-start", "screencap", "pull",
    // After a modal the route is unknown: deep link again, no clear.
    "am-start", "screencap", "pull",
  ]);
  assert.equal(world.callsTo("pm clear").length, 2);
  assert.equal(world.callsTo("am force-stop").length, 4);
  assert.equal(world.callsTo("push").length, 2);
  assert.equal(world.callsTo("am start").length, 6);
  for (const name of ["Builder-Abilities-360.png", "Builder-Race-language-choice-360.png", "Builder-Class-feats-360.png", "Builder-Class-fighting-styles-card-collapsed-360.png", "Stats-add-language-modal-360.png", "Rest-modal-360.png", "Home-360.png"]) {
    assert.ok(existsSync(join(shots, name)), name);
  }
});

test("the first scenario of the second width resets and reseeds again", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home,Settings", WIDTHS: "320,360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  // Each width's first scenario does the full reset+seed; the second scenario of each width only jumps
  // by deep link (Home "/" then Settings "/options" differ).
  assert.deepEqual(
    world.logs.filter((m) => /: (reset\+seed|relaunch|deep link|same route)$/.test(m)),
    [
      "[320dp] Home: reset+seed",
      "[320dp] Settings: deep link",
      "[360dp] Home: reset+seed",
      "[360dp] Settings: deep link",
    ],
  );
  assert.equal(world.callsTo("pm clear").length, 2);
  assert.equal(world.callsTo("push").length, 2);
  assert.equal(world.callsTo("am start").length, 4);
});

// --- AC-14: a stuck scenario is saved, reported and does not stop the run ---

test("a stuck scenario saves -FAILED.png, the next scenario relaunches by deep link without clearing, and the run exits non-zero", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  // The dump shows Settings' ready text but never Home's, so Home (first of the width) gets stuck.
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
    dumpXml: `<hierarchy><node text="Settings &amp; Compendium" bounds="[185,86][534,129]" /></hierarchy>`,
    readyTimeoutMs: 1000,
    readyPollMs: 500,
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("ready"));
  // Home's stuck screen was saved as Home-360-FAILED.png and its path logged; no normal Home shot.
  const failed = join(shots, "Home-360-FAILED.png");
  assert.ok(existsSync(failed));
  assert.deepEqual([...readFileSync(failed).subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(world.logs.join("\n").includes(failed));
  assert.ok(!existsSync(join(shots, "Home-360.png")));
  // The run continued: Settings still produced its screenshot, relaunching by deep link (the route is
  // unknown after a failed scenario) without clearing or reseeding.
  assert.ok(existsSync(join(shots, "Settings-360.png")));
  assert.deepEqual(structuralMarkersOf(world), [
    "force-stop", "pm-clear", "push-seed", "mkdir-files", "seed-copy", "rm-tmp", "am-start", "screencap", "pull",
    "am-start", "screencap", "pull",
  ]);
  assert.equal(world.callsTo("pm clear").length, 1);
  assert.equal(world.callsTo("am start").length, 2);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("the -FAILED.png save is best effort: when the device does not answer it is logged and the run carries on", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
    dumpXml: `<hierarchy><node text="Settings &amp; Compendium" bounds="[185,86][534,129]" /></hierarchy>`,
    readyTimeoutMs: 1000,
    readyPollMs: 500,
    // The pull of the FAILED screenshot fails; the normal pull still works.
    pullCodeFor: (remote) => (remote.includes("FAILED") ? 1 : 0),
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("could not save"));
  assert.ok(world.errors.join("\n").includes("Home-360-FAILED.png"));
  assert.equal(world.callsTo("screencap").length, 2);
  assert.equal(world.pulls, 2);
  assert.ok(!existsSync(join(shots, "Home-360-FAILED.png")));
  // The run carried on regardless: Settings still produced its screenshot.
  assert.ok(existsSync(join(shots, "Settings-360.png")));
});

// --- the launch retry ---

test("a non-zero am start is retried once after about a second and the scenario then passes", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
    amStartCodeFor: (n) => (n === 1 ? 255 : 0),
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.callsTo("am start").length, 2);
  assert.ok(world.sleeps.includes(1000));
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.equal(world.callsTo("screencap").length, 1);
});

// --- AC-18: a lost emulator is survived or reported ---

test("a runner-started emulator lost before a scenario is rebooted, reinstalled, re-densitied and the scenario repeated in reset+seed mode", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    // The runner boots its own emulator; the reboot comes back on another serial, to prove the
    // serial is read from the boot wait and not assumed.
    devices: "",
    bootDevicesFor: (n) => `emulator-${5553 + n}\tdevice\n`,
    // The second get-state call (before Settings) finds the device gone.
    offlineAtGetStates: [2],
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  // The recovery line, once.
  assert.deepEqual(world.logs.filter((m) => m.includes("emulator lost, rebooting")), ["[360dp] Settings: emulator lost, rebooting (1 of 2)"]);
  // Booted twice, the second time with the same arguments; the boot wait read the new serial.
  assert.equal(world.starts.length, 2);
  assert.deepEqual(world.starts[1].args, world.starts[0].args);
  assert.ok(world.callsTo("-s emulator-5555 shell getprop").length >= 1);
  // The APK is installed again on the new serial, and the width's density set again after the reboot.
  assert.equal(world.callsTo("install -r").length, 2);
  assert.equal(world.callsTo("-s emulator-5555 install -r").length, 1);
  assert.equal(world.callsTo("wm density").filter((c) => c.args.at(-1) === "320").length, 2);
  // The original density is restored once at the end of the recovered run.
  assert.equal(world.callsTo("wm density reset").length, 1);
  // The lost scenario was repeated in reset+seed mode: cleared and seeded again, then launched.
  assert.equal(world.callsTo("pm clear").length, 2);
  assert.equal(world.callsTo("push").length, 2);
  assert.equal(world.callsTo("am start").length, 2);
  // Every scenario of the set has its screenshot, and the lost one wrote no FAILED screenshot.
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(existsSync(join(shots, "Settings-360.png")));
  assert.ok(!existsSync(join(shots, "Settings-360-FAILED.png")));
  // The emulator the run started is stopped exactly once at the end, on the new serial.
  const kills = world.callsTo("emu kill");
  assert.equal(kills.length, 1);
  assert.ok(kills[0].args.includes("emulator-5555"));
});

test("a scenario that fails because the device died mid-scenario is a lost device, not a failed scenario: no FAILED screenshot, the run recovers and repeats it", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devices: "",
    bootDevices: "emulator-5554\tdevice\n",
    // Home's ready poll is dump 1; the device dies on Settings' first dump poll (dump 2).
    offlineAtDumps: [2],
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.deepEqual(world.logs.filter((m) => m.includes("emulator lost, rebooting")), ["[360dp] Settings: emulator lost, rebooting (1 of 2)"]);
  // No FAILED screenshot anywhere: the mid-scenario failure was the lost device.
  assert.equal(world.callsTo("screencap").filter((c) => (c.args.at(-1) as string).includes("FAILED")).length, 0);
  assert.ok(!existsSync(join(shots, "Settings-360-FAILED.png")));
  // The repeat produced the screenshot.
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(existsSync(join(shots, "Settings-360.png")));
  assert.equal(world.starts.length, 2);
  assert.equal(world.callsTo("install -r").length, 2);
});

test("a reused emulator lost at a scenario stops the run there: message naming scenario, width and serial, no remaining scenarios, non-zero exit, no FAILED screenshot", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    offlineAtGetStates: [2],
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.notEqual(code, 0);
  const err = world.errors.join("\n");
  assert.ok(err.includes("[360dp] Settings"), err);
  assert.ok(err.includes("emulator-5554"), err);
  assert.ok(err.includes("did not start"), err);
  // Home ran and produced its screenshot; Settings and everything after it did not run.
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(!existsSync(join(shots, "Settings-360.png")));
  assert.ok(!existsSync(join(shots, "Settings-360-FAILED.png")));
  assert.equal(world.callsTo("am start").length, 1);
  assert.equal(world.callsTo("screencap").length, 1);
  // No emulator was started, so none is stopped; the density restore is still attempted once (best
  // effort on the dead device, it does not throw or hang).
  assert.equal(world.starts.length, 0);
  assert.equal(world.callsTo("emu kill").length, 0);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a third loss ends the run with a message and a non-zero exit", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devices: "",
    bootDevices: "emulator-5554\tdevice\n",
    // Lost before Settings@360 (get-state 2), before Home@320 (3) and before Settings@320 (4).
    offlineAtGetStates: [2, 3, 4],
    env: { ONLY: "Home,Settings", WIDTHS: "360,320", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.deepEqual(world.logs.filter((m) => m.includes("emulator lost, rebooting")), [
    "[360dp] Settings: emulator lost, rebooting (1 of 2)",
    "[320dp] Home: emulator lost, rebooting (2 of 2)",
  ]);
  const err = world.errors.join("\n");
  assert.ok(err.includes("[320dp] Settings"), err);
  assert.ok(err.includes("ending the run"), err);
  // Two recoveries happened (three boots); the scenarios up to the third loss have screenshots,
  // the ones after it did not run.
  assert.equal(world.starts.length, 3);
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(existsSync(join(shots, "Settings-360.png")));
  assert.ok(existsSync(join(shots, "Home-320.png")));
  assert.ok(!existsSync(join(shots, "Settings-320.png")));
  // The started emulator is still stopped once at the end, best effort on the dead device.
  assert.equal(world.callsTo("emu kill").length, 1);
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("a recovery whose reboot never finishes booting ends the run with a message and a non-zero exit", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devices: "",
    bootDevicesFor: (n) => `emulator-${5553 + n}\tdevice\n`,
    // The first boot completes; the reboot never reports sys.boot_completed=1.
    bootCompletedFor: (n) => (n === 1 ? "1" : "0"),
    offlineAtGetStates: [2],
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  const err = world.errors.join("\n");
  assert.ok(err.includes("sys.boot_completed"), err);
  assert.ok(err.includes("ending the run"), err);
  assert.deepEqual(world.logs.filter((m) => m.includes("emulator lost, rebooting")), ["[360dp] Settings: emulator lost, rebooting (1 of 2)"]);
  // The reboot was started and then killed; the APK was installed only once (the initial install).
  assert.equal(world.starts.length, 2);
  assert.equal(world.callsTo("install -r").length, 1);
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(!existsSync(join(shots, "Settings-360.png")));
  // Cleanup on the dead device did not throw; the started emulator's stop was attempted once.
  assert.equal(world.callsTo("wm density reset").length, 1);
});

test("the recovery limit is two per run", () => {
  assert.equal(MAX_EMULATOR_RECOVERIES, 2);
});

// --- A folder per run (Q6/AC-12): without SHOTS a fresh timestamped folder, printed once ---

test("runShotsDir names the folder YYYYMMDD-HHMMSS (UTC) under <tmp>/layout-android and suffixes a taken name", () => {
  const base = { tmpdir: () => "/tmp", now: () => Date.UTC(2026, 2, 4, 5, 6, 7) };
  assert.equal(runShotsDir({ ...base, fileExists: () => false }), "/tmp/layout-android/20260304-050607");
  assert.equal(
    runShotsDir({ ...base, fileExists: (p: string) => p === "/tmp/layout-android/20260304-050607" }),
    "/tmp/layout-android/20260304-050607-1",
  );
  assert.equal(
    runShotsDir({ ...base, fileExists: (p: string) => p === "/tmp/layout-android/20260304-050607" || p === "/tmp/layout-android/20260304-050607-1" }),
    "/tmp/layout-android/20260304-050607-2",
  );
});

test("without SHOTS the run creates a fresh timestamped folder and prints it once; with SHOTS it prints SHOTS", async () => {
  const tmpRoot = mkdtempSync(join(osTmpdir(), "android-runner-tmp-"));
  const w1 = makeWorld({ ...emulatorWorld, tmpRoot, env: { ONLY: "Home", WIDTHS: "360" }, startClock: Date.UTC(2026, 2, 4, 5, 6, 7) });
  assert.equal(await w1.runRun(), 0);
  assert.ok(w1.logs.includes(`Screenshots: ${join(tmpRoot, "layout-android", "20260304-050607")}`));
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const w2 = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  assert.equal(await w2.runRun(), 0);
  assert.ok(w2.logs.includes(`Screenshots: ${shots}`));
});

test("two runs without SHOTS get two different folders", async () => {
  const tmpRoot = mkdtempSync(join(osTmpdir(), "android-runner-tmp-"));
  const w1 = makeWorld({ ...emulatorWorld, tmpRoot, env: { ONLY: "Home", WIDTHS: "360" }, startClock: Date.UTC(2026, 2, 4, 5, 6, 7) });
  const w2 = makeWorld({ ...emulatorWorld, tmpRoot, env: { ONLY: "Home", WIDTHS: "360" }, startClock: Date.UTC(2026, 2, 4, 5, 6, 8) });
  await w1.runRun();
  await w2.runRun();
  const l1 = w1.logs.find((m) => m.startsWith("Screenshots: "));
  const l2 = w2.logs.find((m) => m.startsWith("Screenshots: "));
  assert.ok(l1 && l2, "both runs print their folder");
  assert.notEqual(l1, l2);
});

test("a run whose timestamped folder is already taken gets a suffix", async () => {
  const tmpRoot = mkdtempSync(join(osTmpdir(), "android-runner-tmp-"));
  const taken = join(tmpRoot, "layout-android", "20260304-050607");
  const world = makeWorld({
    ...emulatorWorld,
    tmpRoot,
    env: { ONLY: "Home", WIDTHS: "360" },
    startClock: Date.UTC(2026, 2, 4, 5, 6, 7),
    existingLayoutDirs: [taken],
  });
  assert.equal(await world.runRun(), 0);
  assert.ok(world.logs.includes(`Screenshots: ${taken}-1`));
});

// --- WIDTHS validation and LAYOUT_INTEGRATED ---

test("invalidWidthEntries lists the entries that are not a positive integer in 240..1000", () => {
  assert.deepEqual(invalidWidthEntries(undefined), []);
  assert.deepEqual(invalidWidthEntries(""), []);
  assert.deepEqual(invalidWidthEntries("   "), []);
  assert.deepEqual(invalidWidthEntries("320,412"), []);
  assert.deepEqual(invalidWidthEntries("240,1000"), []);
  assert.deepEqual(invalidWidthEntries("0,abc,360"), ["0", "abc"]);
  assert.deepEqual(invalidWidthEntries("100"), ["100"]);
  assert.deepEqual(invalidWidthEntries("1001"), ["1001"]);
  assert.deepEqual(invalidWidthEntries("360.5"), ["360.5"]);
  assert.deepEqual(invalidWidthEntries("-5"), ["-5"]);
});

test("WIDTHS with a 0, NaN or out-of-range entry exits 2 naming the bad entry, before any device call", async () => {
  for (const [raw, bad] of [["0,abc", '"0"'], ["abc", '"abc"'], ["100", '"100"'], ["1001", '"1001"'], ["360.5", '"360.5"'], ["-5", '"-5"']] as const) {
    const world = makeWorld({ ...emulatorWorld, env: { WIDTHS: raw } });
    const code = await world.runRun();
    assert.equal(code, 2, raw);
    assert.ok(world.errors.join("\n").includes(bad), `${raw} must be named: ${world.errors.join("\n")}`);
    assert.equal(world.calls.length, 0, `no device call for WIDTHS=${raw}`);
  }
});

test("unset or empty WIDTHS runs the default four widths", async () => {
  for (const raw of [undefined, ""]) {
    const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
    const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: raw, SHOTS: shots } });
    assert.equal(await world.runRun(), 0, `WIDTHS=${raw}`);
    const set = world
      .callsTo("wm density")
      .filter((c) => /wm density \d+$/.test(c.args.join(" ")))
      .map((c) => c.args.at(-1));
    assert.deepEqual(set, ["293", "320", "360", "280"], `WIDTHS=${raw}`); // 393,360,320,412
  }
});

test("ONLY that selects only web-only scenarios exits 2 listing them, before any device call", async () => {
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "New Character modal" } });
  const code = await world.runRun();
  assert.equal(code, 2);
  const err = world.errors.join("\n");
  assert.ok(err.includes("New Character modal"), err);
  assert.match(err, /web-only/i);
  assert.equal(world.calls.length, 0);
});

test("LAYOUT_INTEGRATED=1 selects the integrated scenario list like --integrated", async () => {
  const tiefling0 =
    `<hierarchy><node text="Builder" bounds="[80,187][157,220]" /><node text="Race" bounds="[316,320][375,356]" />` +
    `<node text="CHA" bounds="[10,500][60,540]" /><node text="Choose +2 to 1 ability score (0/1 chosen)" bounds="[52,600][600,650]" /></hierarchy>`;
  const tiefling1 = tiefling0.replace("(0/1 chosen)", "(1/1 chosen)");
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "tiefling", WIDTHS: "360", LAYOUT_INTEGRATED: "1" },
    argv: ["--no-build"],
    dumpXml: (poll) => (poll <= 4 ? tiefling0 : tiefling1),
  });
  assert.equal(await world.runRun(), 0);
});

// --- Device selection: prefer emulator-* serials, adopt a not-ready one, refuse the rest ---

test("isEmulatorSerial rejects a serial that merely contains \"emulator\"", () => {
  assert.equal(isEmulatorSerial("my-emulator-phone"), false);
  assert.equal(isEmulatorSerial("emulator-5554"), true);
  assert.equal(isEmulatorSerial("emulator"), false);
});

test("a ready non-emulator serial that merely contains \"emulator\" is refused", async () => {
  const world = makeWorld({ devices: "my-emulator-phone\tdevice\n" });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes("my-emulator-phone"));
  assert.equal(world.starts.length, 0);
  const mutating = world.calls.filter((c) => /install|am start|wm density|emu kill|pm clear|force-stop|run-as/.test(`${c.command} ${c.args.join(" ")}`));
  assert.deepEqual(mutating, []);
});

test("a physical device listed before a running emulator is ignored and the emulator is reused", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ devices: "HTC123\tdevice\nemulator-5554\tdevice\n", env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.starts.length, 0);
  assert.equal(world.callsTo("emu kill").length, 0);
  assert.ok(!world.calls.some((c) => c.args.includes("HTC123")), "the phone is never addressed");
  assert.equal(world.callsTo("-s emulator-5554 install -r").length, 1);
  assert.ok(existsSync(join(shots, "Home-360.png")));
});

test("an emulator listed but not ready yet is waited for and adopted: never started, never killed", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devicesFor: (n) => (n === 1 ? "emulator-5554\toffline\n" : "emulator-5554\tdevice\n"),
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.starts.length, 0, "no emulator process is spawned for an adopted emulator");
  assert.ok(world.callsTo("getprop sys.boot_completed").length >= 1, "the boot wait ran");
  assert.equal(world.callsTo("emu kill").length, 0, "an adopted emulator is never killed");
  assert.equal(world.callsTo("-s emulator-5554 install -r").length, 1);
  assert.ok(existsSync(join(shots, "Home-360.png")));
});

test("an offline emulator listed together with a ready physical device is waited for, not refused", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devicesFor: (n) => (n === 1 ? "HTC123\tdevice\nemulator-5554\toffline\n" : "HTC123\tdevice\nemulator-5554\tdevice\n"),
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  assert.equal(world.starts.length, 0);
  assert.equal(world.callsTo("emu kill").length, 0);
  assert.ok(!world.calls.some((c) => c.args.includes("HTC123")));
  assert.equal(world.callsTo("-s emulator-5554 install -r").length, 1);
});

// --- Every adb call after the device is chosen carries -s <serial>, with a timeout ---

test("across a whole fake run every adb call except `devices` carries -s <serial>, including tap, swipe, dump, screencap, pull, install", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const content = `<node text="" class="android.widget.ScrollView" scrollable="true" bounds="[0,252][720,1232]" />`;
  const withoutNeedle = `<hierarchy>${content}<node text="Builder" bounds="[80,187][157,220]" /><node text="Race" bounds="[316,320][375,356]" /></hierarchy>`;
  const withNeedle = `<hierarchy>${content}<node text="Builder" bounds="[80,187][157,220]" /><node text="Race" bounds="[316,320][375,356]" /><node text="Granted Languages:" bounds="[10,620][300,660]" /></hierarchy>`;
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Builder Race language choice", WIDTHS: "360", SHOTS: shots },
    // The two tab polls consume dumps 1-2, the ready polls 3-4 (no needle yet, so swipes run), and
    // from dump 5 on the needle is there.
    dumpXml: (poll) => (poll <= 4 ? withoutNeedle : withNeedle),
  });
  const code = await world.runRun();
  assert.equal(code, 0);
  const adbCalls = world.calls.filter((c) => c.command === ADB);
  assert.ok(adbCalls.length > 0);
  for (const c of adbCalls) {
    if (c.args[0] === "devices") continue;
    assert.equal(c.args[0], "-s", `${c.command} ${c.args.join(" ")}`);
    assert.equal(c.args[1], "emulator-5554", `${c.command} ${c.args.join(" ")}`);
  }
  for (const kind of ["wm density", "pm clear", "push", "run-as", "am start", "uiautomator dump", "exec-out", "input tap", "input swipe", "screencap", "pull", "install -r"]) {
    const calls = world.callsTo(kind);
    assert.ok(calls.length > 0, kind);
    assert.ok(calls.every((c) => c.args[0] === "-s" && c.args[1] === "emulator-5554"), kind);
  }
});

test("every adb call carries a timeout: 60 s default, 180 s install, 30 s dump, 60 s screencap and pull", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  assert.equal(await world.runRun(), 0);
  const adbCalls = world.calls.filter((c) => c.command === ADB);
  assert.ok(adbCalls.length > 0);
  for (const c of adbCalls) {
    const j = c.args.join(" ");
    const expected = j.includes("install") ? INSTALL_TIMEOUT_MS : j.includes("uiautomator") ? DUMP_TIMEOUT_MS : ADB_TIMEOUT_MS;
    assert.equal(c.options?.timeoutMs, expected, j);
  }
  assert.equal(ADB_TIMEOUT_MS, 60_000);
  assert.equal(INSTALL_TIMEOUT_MS, 180_000);
  assert.equal(DUMP_TIMEOUT_MS, 30_000);
  for (const c of world.callsTo("screencap").concat(world.callsTo("pull"))) {
    assert.equal(c.options?.timeoutMs, SCREENCAP_TIMEOUT_MS, "screencap/pull timeout");
  }
});

// --- A failed uiautomator dump never reads a stale hierarchy ---

test("a dump that exits non-zero is an empty node list for that poll: the remote file is deleted first and never catted", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  // The scripted exec-out output WOULD satisfy the ready text; a runner that ignores the dump's
  // exit code would read it and pass.
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
    dumpCodeFor: () => 1,
    dumpXml: DEFAULT_DUMP,
    readyTimeoutMs: 1000,
    readyPollMs: 500,
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.ok(world.errors.join("\n").includes("ready"));
  assert.equal(world.callsTo("exec-out").length, 0, "no cat after a failed dump");
  assert.ok(world.callsTo("uiautomator").length > 0);
  // Every dump attempt is preceded by rm -f of the remote dump file.
  world.calls.forEach((c, i) => {
    if (`${c.command} ${c.args.join(" ")}`.includes("uiautomator")) {
      const prev = world.calls[i - 1];
      assert.ok(prev && prev.args.join(" ").includes("rm -f") && prev.args.join(" ").includes(DUMP_REMOTE), `rm -f ${DUMP_REMOTE} before dump #${i}`);
    }
  });
  assert.ok(existsSync(join(shots, "Home-360-FAILED.png")), "the stuck screen is still saved");
});

test("a dump that exits 0 but does not report the dump is a failure too", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots },
    dumpCodeFor: () => 0,
    dumpStdoutFor: () => "ERROR: could not obtain idle state\n",
    dumpXml: DEFAULT_DUMP,
    readyTimeoutMs: 500,
    readyPollMs: 200,
  });
  const code = await world.runRun();
  assert.equal(code, 1);
  assert.equal(world.callsTo("exec-out").length, 0);
  assert.ok(world.errors.join("\n").includes("ready"));
});

// --- Startup hardening: emulator env, missing binary, private seed dir ---

test("emulatorEnv strips LD_LIBRARY_PATH and keeps the rest", () => {
  assert.deepEqual(emulatorEnv({ LD_LIBRARY_PATH: "/opt/x", PATH: "/usr/bin", HOME: "/h" }), { PATH: "/usr/bin", HOME: "/h" });
  assert.deepEqual(emulatorEnv({ PATH: "/usr/bin" }), { PATH: "/usr/bin" });
});

test("the spawned emulator gets the environment without LD_LIBRARY_PATH", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ devices: "", bootDevices: "emulator-5554\tdevice\n", env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  assert.equal(await world.runRun(), 0);
  assert.equal(world.starts.length, 1);
  assert.ok(world.starts[0].env, "the runner passes an environment to startEmulator");
  assert.ok(!("LD_LIBRARY_PATH" in world.starts[0].env!), "LD_LIBRARY_PATH is stripped");
  assert.equal(world.starts[0].env!.PATH, "/usr/bin");
});

test("when a boot is needed and the emulator binary is missing, the run exits 2 naming the path instead of waiting", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ devices: "", missing: [join("emulator", "emulator")], env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  const code = await world.runRun();
  assert.equal(code, 2);
  assert.ok(world.errors.join("\n").includes(join(SDK, "emulator", "emulator")), world.errors.join("\n"));
  assert.equal(world.starts.length, 0);
  assert.equal(world.callsTo("getprop").length, 0, "no boot wait was started");
});

test("the seed is staged in a private temp dir that is removed at the end of the run", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots } });
  assert.equal(await world.runRun(), 0);
  assert.equal(world.writes.length, 1);
  assert.equal(world.tempDirs.length, 1);
  assert.ok(world.writes[0].path.startsWith(world.tempDirs[0] + "/"), world.writes[0].path);
  assert.match(world.writes[0].path, /dnd5e_e2e_seed\.json$/);
  assert.notEqual(world.writes[0].path, join("/tmp", `dnd5e-android-seed-${SEED_FILE_NAME}`), "not the predictable path");
  assert.deepEqual(world.removedDirs, [world.tempDirs[0]]);
});

test("the seed temp dir is removed also after a failed run", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({ ...emulatorWorld, env: { ONLY: "Home", WIDTHS: "360", SHOTS: shots }, clearCode: 1 });
  assert.equal(await world.runRun(), 1);
  assert.equal(world.tempDirs.length, 1);
  assert.deepEqual(world.removedDirs, [world.tempDirs[0]]);
});

// --- Signals: delivered between two scenarios, the cleanup runs and the run ends 130/143 ---

test("a SIGINT delivered between two scenarios runs the cleanup (density restore, emulator stop) and ends the run with exit 130, no further scenario runs", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    devices: "",
    bootDevices: "emulator-5554\tdevice\n",
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
    signalAtSleep: 1, // the first scenario's settle sleep
  });
  const code = await world.runRun();
  assert.equal(code, 130);
  assert.equal(world.starts.length, 1);
  assert.equal(world.callsTo("emu kill").length, 1, "the emulator this run started is stopped");
  assert.equal(world.callsTo("wm density reset").length, 1, "the density is restored");
  assert.ok(existsSync(join(shots, "Home-360.png")));
  assert.ok(!existsSync(join(shots, "Settings-360.png")), "no further scenario runs");
  assert.equal(world.callsTo("am start").length, 1);
  assert.equal(world.callsTo("screencap").length, 1);
});

test("a SIGTERM between two scenarios ends the run with exit 143", async () => {
  const shots = mkdtempSync(join(osTmpdir(), "android-runner-test-"));
  const world = makeWorld({
    ...emulatorWorld,
    env: { ONLY: "Home,Settings", WIDTHS: "360", SHOTS: shots },
    signalAtSleep: 1,
    signalName: "SIGTERM",
  });
  const code = await world.runRun();
  assert.equal(code, 143);
  assert.equal(world.callsTo("wm density reset").length, 1);
  assert.equal(world.callsTo("emu kill").length, 0, "a reused emulator is not stopped");
  assert.ok(!existsSync(join(shots, "Settings-360.png")));
});

// --- The seed the runner stages parses with the app's own parseE2eSeed ---

test("buildSeed output, serialised, parses with the app's parseE2eSeed in SRD and integrated mode", () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  for (const integrated of [false, true]) {
    const seed = buildSeed({ root, integrated });
    const parsed = parseE2eSeed(JSON.stringify(seed));
    assert.ok(parsed, `the ${integrated ? "integrated" : "SRD"} seed must parse with parseE2eSeed`);
    assert.equal(parsed.integrated === null, !integrated);
    assert.ok(parsed.characters.length > 0);
    assert.ok(Array.isArray(parsed.folders));
    assert.ok(parsed.settings && typeof parsed.settings === "object");
  }
});
