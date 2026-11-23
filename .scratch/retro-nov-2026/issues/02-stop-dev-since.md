# 02: `stop-dev.sh --since` stops only what started after a time

**What to build:**

- **The problem.** `scripts/stop-dev.sh` stops every emulator, the adb server and every Gradle and Kotlin daemon, whoever started them. On 2026-11-23 it would have stopped, and a session did stop by hand, a Gradle daemon the user had started three minutes earlier. A session cannot tell its own processes from the user's.
- **The fix.** A new option, `--since <time>`. `<time>` is whatever `date -d` reads, such as `@1763862000` or `"2026-11-23 02:44"`.
  - A process started before `<time>` is never signalled. A process's start time is the time now minus `ps -o etimes= -p <pid>`.
  - **Emulators:** only the `qemu-system-*` processes started since. Each gets `kill -TERM <pid>` rather than `adb emu kill`, since a serial cannot be matched to a pid cheaply.
  - **adb:** `adb kill-server` runs only when the adb server process started since.
  - **Gradle and Kotlin:** `gradlew --stop` is skipped, because it stops every daemon. Only the daemons started since get `kill -TERM`.
  - **`--port <n>` listeners:** only those started since.
  - The waits (`wait_for_none`) wait only for the processes the run signalled, so an older emulator never costs the 20-second wait.
  - **Report:** an older process that is still running is printed as `left running (started before --since): <label> pid(s) …`. It does not make the exit status 1. Anything started since that is still running counts as before.
  - Without `--since`, the script behaves exactly as now. The `usage` text and the header comment describe the option.

**Blocked by:** None

**Status:** open

- [ ] `checks/stopDevSince.test.ts`, red first. Fake daemons are `node -e "setTimeout(() => {}, 60000)" GradleDaemon`, which `pgrep -f GradleDaemon` matches. Spawn them detached and kill them in an `after` hook whatever the result.
  1. Spawn fake A and wait 1.5 s.
  2. Take `since` as `@<epoch seconds>`, wait 1.1 s, and spawn fake B.
  3. Run `bash scripts/stop-dev.sh --since @<since>`.
  - B is gone within a few seconds, A is still alive, and the output names A's pid under `left running (started before --since)`.
  - A bad `--since` value (`--since nonsense`) exits 2.
  - The test stops only the fakes it spawned. Signal them by pid, never with `pkill -f`.
- [ ] `npm run check:all` passes.
