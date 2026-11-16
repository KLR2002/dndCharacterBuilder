// Runs the Kotlin unit tests of modules/dice-canvas (DiceMathTest, checked against the shared
// math fixture): `npm run test:native`. Generates android/ with expo prebuild when it is missing,
// then runs Gradle with --no-daemon so no daemon outlives the run, and exits with Gradle's code.
// Exit 2 when there is no Android SDK or no java on PATH.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "android");

function fail(message) {
  console.error(`test:native: ${message}`);
  process.exit(2);
}

if (!process.env.ANDROID_HOME) {
  process.env.ANDROID_HOME = join(homedir(), "Android", "Sdk");
}
if (!existsSync(process.env.ANDROID_HOME)) {
  fail(`no Android SDK at ${process.env.ANDROID_HOME} (set ANDROID_HOME)`);
}
if (spawnSync("java", ["-version"], { stdio: "ignore" }).error) {
  fail("no java on PATH (install a JDK 17)");
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
if (!existsSync(androidDir)) {
  console.log("test:native: android/ is missing, running expo prebuild");
  const prebuild = spawnSync(npx, ["expo", "prebuild", "--platform", "android", "--no-install"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  });
  if (prebuild.error) fail(`expo prebuild did not start: ${prebuild.error.message}`);
  if (prebuild.status !== 0) process.exit(prebuild.status ?? 1);
}

const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const gradle = spawn(gradlew, [":dice-canvas:testDebugUnitTest", "--no-daemon"], {
  cwd: androidDir,
  stdio: "inherit",
  env: process.env,
});
gradle.on("error", (error) => fail(`Gradle did not start: ${error.message}`));
gradle.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
