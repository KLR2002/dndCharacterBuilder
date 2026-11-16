# 03: `npm run test:native` runs the Kotlin unit tests, locally and in CI

**What to build:** The Kotlin side of the dice math (`modules/dice-canvas`, `DiceMathTest.kt`) is checked against the shared fixture `checks/fixtures/diceCanvasMathFixture.json` only when someone runs Gradle by hand. The fixture is recorded from the TypeScript side (`UPDATE_DICE_CANVAS_FIXTURE=1`), so a TypeScript math change plus a re-recorded fixture passes `check:all` and CI while the Kotlin math drifts. Add:

- `scripts/test-native.mjs` and the npm script `test:native` running it. It sets `ANDROID_HOME` to `~/Android/Sdk` when unset; when `android/` is missing it runs `npx expo prebuild --platform android --no-install` with `CI=1 EXPO_NO_TELEMETRY=1`; then it runs `./gradlew :dice-canvas:testDebugUnitTest --no-daemon` in `android/` (no daemon left behind), streams Gradle's output, and exits with Gradle's code. Exit 2 with a message when there is no Android SDK or no `java`.
- A CI job `native` in `.github/workflows/ci.yml`: checkout, Node 22 with the npm cache, `npm ci`, `actions/setup-java@v4` (Temurin 17, `cache: gradle`), `npm run test:native`. The runner's preinstalled Android SDK is used through its `ANDROID_HOME`.
- In `AGENTS.md`, section "Verification", one sentence: changes under `modules/` or to the dice math in `src/rules/` (`diceMath`, `diceProjection`, `diceAnimation`, `diceThrow`, `diceSolids`) also need `npm run test:native` (the Kotlin unit tests against the shared fixture; needs the Android SDK and a JDK, a few minutes on the first run).

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** chore/retro-canvas-dice @ 1947ec3. `npm run test:native` 9/9 green from a worktree with no `android/`; the fixture probe failed `DiceMathTest > rotateVector` after the fixture was declared a Gradle input (bc5c720; before it the task was UP-TO-DATE and stayed green). The CI job has not run on GitHub yet.

- [x] In a fresh worktree with no `android/`, `npm run test:native` generates the project, runs the 9 Kotlin tests green and exits 0; no Gradle daemon is left running afterwards (`pgrep -f GradleDaemon` prints nothing that this run started).
- [x] Red: with one stored value in the fixture edited (a probe, reverted afterwards), `npm run test:native` exits non-zero and names the failing Kotlin test.
- [x] The CI file parses as YAML and the new job has the steps above; the existing jobs are unchanged.
- [x] `AGENTS.md` has the sentence above and nothing else changes there.

## Constraints

- Follow `docs/agents/subagent-tiering.md`, section "Implementer Rules". The Gradle run takes several minutes: start it with `run_in_background: true` and wait with `t3_background_wait` in the same turn.
- Do not commit the generated `android/` project or any build output.
- Do not change the Kotlin or TypeScript math.
