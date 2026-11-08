// The device side of the native screenshot run: `npm run layout:android`. It reuses a running
// emulator or boots the Small_Phone AVD headless (windowed with `--window`) and stops only one it
// started, refuses any device whose serial is not an emulator, builds the E2E APK incrementally
// with `-Pe2e` (skipped with `--no-build`) and installs it with `adb install -r`, then for each
// width sets the screen density and runs every selected scenario in its isolation mode: the first
// scenario of the width and every `fresh` scenario clear the app's data and copy the seed into its
// private folder with run-as, a `modal` scenario force-stops and relaunches without clearing, any
// other scenario only jumps to its route by deep link (not even that when it is the previous
// scenario's route), and the launch is retried once when it exits non-zero. The step fields play as
// before (`tabs` and `open` as taps on the matching dump node, the ready text or modal title waited
// for, `scrollTo` as swipes until the text is visible; a web-only scenario is listed and skipped),
// and the `<scenario>-<width>.png` screenshot is pulled into the shots folder; a scenario that
// fails after the launch also saves the stuck screen as `<scenario>-<width>-FAILED.png` and the run
// continues, exiting non-zero. The original density is restored at the end (also after a failure).
// The device is checked alive before each scenario and at every scenario failure point; when it is
// lost, an emulator this run started is booted again (at most twice), reinstalled, re-densitied and
// the running scenario repeated in reset+seed mode, while a reused emulator stops the run at that
// scenario with a message and a non-zero exit. The runner core, with every device interaction behind
// one injectable executor, is in
// scripts/lib/android-runner.mjs; the tests are in checks/androidRunner.test.ts and
// checks/nativeSteps.test.ts.
//
// Usage: `npm run layout:android` (not part of check:all). Env: WIDTHS (default "393,360,320,412"),
// ONLY (a comma-separated list of substrings: an unmatched term exits 2 and lists the scenario
// names), SHOTS (default a layout-android folder under the OS temp dir). Flags: `--integrated`
// (accepted; the scenario list is the shared one for the integrated catalog), `--no-build`,
// `--window`, `--list` (prints the scenario names as JSON and exits). Exit: 0 success, 1 a build,
// install, seed copy, launch, ready wait or screenshot failed for at least one scenario, 2 a refusal
// (an unmatched ONLY term, no adb, a non-emulator device, no generated android/ project, no APK, an
// emulator that never booted).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAndroid } from "./lib/android-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The real executor: one command, its output captured, nothing streamed.
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

// A synchronous sleep: the executor is synchronous, so the waits block the thread.
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Starts the emulator detached, logging to logPath, and returns its pid.
function startEmulator(bin, args, logPath) {
  const out = fs.openSync(logPath, "a");
  const child = spawn(bin, args, { detached: true, stdio: ["ignore", out, out] });
  child.unref();
  return child.pid;
}

const code = await runAndroid({
  root: ROOT,
  env: process.env,
  argv: process.argv.slice(2),
  run,
  sleep,
  startEmulator,
  fileExists: (path) => fs.existsSync(path),
  writeFile: (path, content) => fs.writeFileSync(path, content),
  readFile: (path) => fs.readFileSync(path),
  mkdir: (path) => fs.mkdirSync(path, { recursive: true }),
  tmpdir,
  homeDir: process.env.HOME ?? fs.realpathSync("~"),
  installSignalHandlers: (cleanup) => {
    for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
      process.on(signal, () => {
        cleanup();
        process.exit(exitCode);
      });
    }
  },
  log: (message) => console.log(message),
  errorLog: (message) => console.error(message),
});
process.exit(code);
