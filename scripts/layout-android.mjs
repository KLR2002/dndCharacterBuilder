// The device side of the native screenshot run: `npm run layout:android`. It reuses a running
// emulator, waits for one that is listed but still booting, or boots the Small_Phone AVD headless
// (windowed with `--window`) and stops only one it started, refuses any device whose serial is not
// an emulator, builds the E2E APK incrementally with `-Pe2e` (skipped with `--no-build`) and
// installs it with `adb install -r`, then for each width sets the screen density and runs every
// selected scenario in its isolation mode: the first scenario of the width and every `fresh`
// scenario clear the app's data and copy the seed into its private folder with run-as, a `modal`
// scenario force-stops and relaunches without clearing, any other scenario only jumps to its route
// by deep link (not even that when it is the previous scenario's route), and the launch is retried
// once when it exits non-zero. The step fields play natively (`tabs` and `open` as taps on the
// matching dump node, the ready text or modal title waited for in the dump, `scrollTo` as swipes
// until the text is visible; a web-only scenario is listed and skipped), and the
// `<scenario>-<width>.png` screenshot is pulled into the run's shots folder; a scenario that fails
// after the launch also saves the stuck screen as `<scenario>-<width>-FAILED.png` and the run
// continues, exiting non-zero. The signal handlers are installed before any device work, so a
// signal during the boot wait already reaches them: the handler's cleanup stops an emulator this
// run started (by `adb -s <serial> emu kill` once the serial is known and the console answers,
// otherwise by killing the spawned process group), restores the original density when it was read and removes the temp seed
// dir, and this entry exits 130/143 right after the handler, so there the handler's cleanup is the
// only one that runs; the same idempotent cleanup also runs on every other exit path. The original
// density is restored at the end (also after a failure). An exception from the run (an unwritable
// SHOTS folder, an unreadable build.gradle, a spawn error) runs that cleanup too, prints one line
// `layout:android failed: <message>` and exits 2. The run stops the adb server and leaves no Gradle
// daemon when it started them (the build runs with `--no-daemon`), and leaves any it found running. Every adb call runs with a timeout, and the waits
// between polls are real asynchronous sleeps, so
// the event loop turns between device calls and a signal handler runs there. The device is checked
// alive before each scenario and at every scenario failure point; when it is lost, an emulator this
// run started is booted again (at most twice), reinstalled, re-densitied and the running scenario
// repeated in reset+seed mode, while a reused emulator stops the run at that scenario with a
// message and a non-zero exit. The runner core, with every device interaction behind one injectable
// executor, is in scripts/lib/android-runner.mjs; the tests are in checks/androidRunner.test.ts and
// checks/nativeSteps.test.ts.
//
// Usage: `npm run layout:android` (not part of check:all). Env: WIDTHS (default "393,360,320,412";
// every entry must be a positive integer from 240 to 1000, else exit 2 before any device is touched),
// ONLY (a comma-separated list of substrings: an unmatched term exits 2 and lists the scenario
// names, an ONLY that selects only web-only scenarios exits 2), SHOTS (default a fresh
// layout-android/<YYYYMMDD-HHMMSS> folder under the OS temp dir, printed once as "Screenshots: <path>"),
// LAYOUT_INTEGRATED=1 (same as --integrated). Flags: `--integrated` (accepted; the scenario list is
// the shared one for the integrated catalog), `--no-build`, `--window`, `--list` (prints the
// scenario names as JSON and exits). Exit: 0 success, 1 a build, install, seed copy, launch, ready
// wait or screenshot failed for at least one scenario, 2 a refusal (an unmatched ONLY term, an
// invalid WIDTHS entry, only web-only scenarios selected, no adb, a non-emulator device, no
// emulator binary, no generated android/ project or one generated before the E2E wiring, no APK, an emulator that never booted), 130/143 a
// signal ended the run.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAndroid } from "./lib/android-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The real executor: one command, its output captured, nothing streamed. `timeoutMs` bounds the
// call, so a hung adb or emulator command is a failed call instead of a blocked run.
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) return { code: 1, stdout: result.stdout ?? "", stderr: String(result.error) };
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// A really asynchronous sleep, so the event loop turns between device calls and a signal handler
// runs there (the executor itself is synchronous, but the waits must not block the thread).
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

// Starts the emulator detached with the given environment, logging to logPath, and returns its pid.
// The spawn `error` event (a missing binary, say) is swallowed here: the pid then never exists, the
// boot wait times out, and the cleanup's stop of that pid is a no-op; without the listener the event
// would throw an unhandled error instead.
function startEmulator(bin, args, logPath, env) {
  const out = fs.openSync(logPath, "a");
  const child = spawn(bin, args, { detached: true, stdio: ["ignore", out, out], env });
  child.on("error", () => {});
  child.unref();
  return child.pid;
}

// Stops a spawned emulator process: the detached child leads its own process group, so kill the
// group, falling back to the pid itself.
function stopProcess(pid) {
  try {
    process.kill(-pid);
  } catch {
    process.kill(pid);
  }
}

// The late-bound cleanup of the run, handed out through cleanupRef; when the run itself throws (an
// unwritable SHOTS folder, an unreadable build.gradle, a spawn error), it still runs before exiting.
const cleanupRef = { current: null };
let code;
try {
  code = await runAndroid({
    root: ROOT,
    env: process.env,
    argv: process.argv.slice(2),
    run,
    sleep,
    startEmulator,
    stopProcess,
    cleanupRef,
    fileExists: (path) => fs.existsSync(path),
    writeFile: (path, content) => fs.writeFileSync(path, content),
    readFile: (path) => fs.readFileSync(path),
    mkdir: (path) => fs.mkdirSync(path, { recursive: true }),
    makeTempDir: (prefix) => fs.mkdtempSync(prefix),
    removeDir: (path) => fs.rmSync(path, { recursive: true, force: true }),
    tmpdir,
    homeDir: homedir(),
    installSignalHandlers: (handler) => {
      for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
        process.on(signal, () => {
          handler(signal);
          process.exit(exitCode);
        });
      }
    },
    log: (message) => console.log(message),
    errorLog: (message) => console.error(message),
  });
} catch (error) {
  cleanupRef.current?.();
  console.error(`layout:android failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
process.exit(code);
