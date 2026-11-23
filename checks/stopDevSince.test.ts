import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

// The fakes are the only processes this file signals. The script runs only with --since, taken
// after fake A started, so the user's own daemons and emulators are never in its reach.
const scriptPath = path.join(process.cwd(), "scripts", "stop-dev.sh");
const fakes: ChildProcess[] = [];

function spawnFake(): ChildProcess {
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)", "GradleDaemon"], {
    detached: true,
    stdio: "ignore",
  });
  fakes.push(child);
  return child;
}

function runStopDev(args: string[]) {
  return new Promise<{ status: number; output: string }>((resolve) => {
    execFile("bash", [scriptPath, ...args], { encoding: "utf-8" }, (error, stdout, stderr) => {
      const status = error === null ? 0 : typeof error.code === "number" ? error.code : 1;
      resolve({ status, output: `${stdout}${stderr}` });
    });
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExit(pid: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid) && Date.now() < deadline) {
    await sleep(100);
  }
  return !isAlive(pid);
}

after(() => {
  for (const child of fakes) {
    if (child.pid === undefined) continue;
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
});

test("--since stops only the processes started after it", async () => {
  const fakeA = spawnFake();
  assert.ok(fakeA.pid !== undefined);
  // --since is whole seconds and ps reports elapsed time in whole seconds, so the 2.5 s gap
  // keeps fake A clearly before the cut-off and fake B clearly after it.
  await sleep(2500);
  const since = Math.floor(Date.now() / 1000);
  await sleep(1100);
  const fakeB = spawnFake();
  assert.ok(fakeB.pid !== undefined);

  const result = await runStopDev(["--since", `@${since}`]);

  assert.equal(await waitForExit(fakeB.pid, 5000), true, `fake B ${fakeB.pid} is still alive`);
  assert.equal(isAlive(fakeA.pid), true, `fake A ${fakeA.pid} was signalled`);
  const leftRunning = new RegExp(
    `left running \\(started before --since\\): gradle daemon pid\\(s\\) .*\\b${fakeA.pid}\\b`,
  );
  assert.match(result.output, leftRunning);
  assert.equal(result.status, 0, result.output);
});

test("--since with a value that is not a time exits 2", async () => {
  const result = await runStopDev(["--since", "nonsense"]);
  assert.equal(result.status, 2, result.output);
});
