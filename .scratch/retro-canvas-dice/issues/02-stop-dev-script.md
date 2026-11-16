# 02: One script stops the dev servers and daemons a session started

**What to build:** `scripts/stop-dev.sh`, run at the end of a session that used the emulator, Gradle or an Expo web server, so cleanup is one command instead of hand-written `pkill` lines (a hand-written `pkill -f GradleDaemon` killed the agent's own shell twice, because the pattern was in its own command line). In order, it:

1. Stops every running emulator: `adb -s <serial> emu kill` for each `emulator-*` serial in `adb devices`, then waits (up to about 20 s) until no `qemu-system` emulator process is left.
2. Stops the adb server (`adb kill-server`). `adb` is `$ANDROID_HOME/platform-tools/adb`, `ANDROID_HOME` defaulting to `~/Android/Sdk`; skip with a note when it is missing.
3. Stops the Gradle daemons: `android/gradlew --stop` from the repo root when `android/gradlew` exists, else from the first `.claude/worktrees/*/android/gradlew` found. Then any `GradleDaemon` or `KotlinCompileDaemon` process still alive gets `kill -TERM`.
4. Stops each Expo or static web server given as `--port <n>` (repeatable): the process listening on that port (`ss -ltnpH`), and its process group.
5. Prints what is still alive: listeners on 5037 and on the given ports, and any emulator, `GradleDaemon` or `KotlinCompileDaemon` pids. Exit 0 when nothing is left, 1 when something is, 2 on a bad argument.

The script finds processes with `pgrep` and excludes its own pid and its parent; it never uses `pkill -f`. `--help` prints the usage.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] With an adb server running (`adb start-server`) and nothing else, the script stops it and exits 0; a second run also exits 0 and says nothing was running.
- [ ] With a process listening on a port (for example `python3 -m http.server <port>` started in the background), `--port <port>` stops it; without `--port` the script reports it only if the port is 5037.
- [ ] Run from a shell whose own command line contains `GradleDaemon` (for example `bash -c 'echo GradleDaemon; scripts/stop-dev.sh'`), the script does not kill that shell.
- [ ] `docs/agents/driving-the-android-emulator.md`, section "Manual steps for ad-hoc work", gains one bullet naming `scripts/stop-dev.sh [--port <n>]...` as the way to stop what a session started; the "Stop what you started with `adb emu kill`" wording there points to it.
- [ ] `bash -n scripts/stop-dev.sh` passes, and `shellcheck` too when it is installed.

## Constraints

- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules".
- Do not start an emulator or a Gradle build for this ticket; the adb server and a port listener are enough to exercise it.
