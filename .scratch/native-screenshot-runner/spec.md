# Spec: Native Android Screenshot Runner

**Status:** ready-for-human
**Tracker:** local markdown (`.scratch/native-screenshot-runner/`). Tickets follow once the slicing is approved; only leaf tickets enter `ready-for-agent`.
**Related:** ADR 0020 (this decision), ADR 0013 (SRD Baseline), CODING_STANDARDS §7 (layout, native-only issues), `docs/agents/driving-the-android-emulator.md`, `docs/agents/driving-the-app.md`. GLOSSARY terms *SRD Baseline*, *Integrated Catalog*, *Catalog Format*.

## Problem

Native-only UI problems, such as Android text clipping, cannot be caught by `npm run layout:check`, which runs the web build. Today a claim about them rests on a person tapping through an emulator by hand. The developer wants a command that produces emulator screenshots of the same screens `layout:check` visits, at the same four phone widths, so a native-only change can be backed with evidence.

The app has no way to receive known state on native: characters, folders and settings live in AsyncStorage and the Integrated Catalog in a file in the app's private folder, neither of which anything outside the app can write on a release build.

## Decisions (verbatim)

The developer started this with: "i think next step is very important, lets establish that" and the goal "so we can finally backup tests with emulator screenshots". Each interview round was answered with the same words, "do all recommended", which accepts the recommendation printed under each question. The recommendation is quoted below as printed.

Round 1, answered "do all recommended":

- Q1, What the run is for: "(a) for now. The run fails only when a scenario crashes or never reaches its ready text. Measured checks can come later, if the dump turns out to be good enough."
- Q2, When it is required: "Only for native-only changes, plus on demand. A 6-minute cold build on every UI change is too costly for what it catches."
- Q3, Who drives the device: "A plain script. It's repeatable, runs without an agent, and has no MCP startup problems. `androidMCP` stays the tool for exploring by hand."
- Q4, Shared scenarios with layout-check: "Yes, from one shared source. Two scenario lists would drift apart."
- Q5, Widths: "Yes. It's the same width contract as section 7 and needs no extra AVDs."
- Q6, Where screenshots go: "A folder per run, outside the repo. With no pixel diff (Q1), committed screenshots would only go stale."
- Q7, Emulator lifecycle: "Yes." (Reuse a running emulator, boot `Small_Phone` headless when none is, stop only an emulator the runner started, `--window` to watch.)
- Q8, Building: "Yes. Gradle skips the build itself when nothing changed, so this costs little." (Always the incremental Gradle release build, `--no-build` to skip it.)
- Q9, Catalog modes: "SRD first. How the Integrated Catalog is stored on native is one of the facts the agent is checking, and it may need its own seeding path."

Round 2, answered "do all recommended":

- Q10, How state gets into the app: "(a). State goes through the app's own write path, a multi-MB catalog fits, and changing a seed needs no rebuild. The cost is that the screenshotted APK differs from the shipped one by the debuggable flag, the hook and Q11." (An E2E build, built when `EXPO_PUBLIC_E2E=1`, that is `debuggable`; the runner copies one seed file in with `run-as`; on launch, only in that build, the app imports it through its own `storage.ts` and `compendiumStorage.ts` writers, then deletes it; a guard test checks the hook runs only behind the flag.)
- Q11, OTA updates during runs: "Yes, off in the E2E build."
- Q12, Isolation between scenarios: "Yes." (Widths outside, scenarios inside; reseed with `pm clear` only for `fresh` scenarios; every other scenario reuses the running app and jumps by deep link.)
- Q13, Running the shared scenario fields natively: "Yes." (Find and tap text through `uiautomator dump`; poll the dump for `ready`; carry out `tabs`, `open` and `modal` as taps; turn `scrollTo` into swipes; ignore `expect`; mark a scenario with a step that has no native form as web-only.)
- Q14, Command and knobs: "Yes." (`npm run layout:android`, with the same `ONLY`, `WIDTHS` and `SHOTS` variables and `--integrated` flag as `layout:check`, plus `--no-build` and `--window`; screenshots named `<scenario>-<width>.png`.)

Round 3, answered "do all recommended":

- Q15, Where the shared scenarios live: "Yes. One seed shape means one place to change." (`SCREENS` and `buildSeed()` move into `scripts/lib/scenarios.mjs`; the seed keeps the shape `{ characters, folders, settings, integrated }`.)
- Q16, Emulators only, same app id: "Yes to both." (The runner refuses any device whose serial is not `emulator-*`; the E2E build keeps the normal app id.)
- Q17, Switching to the E2E build: "(a). It avoids churn and keeps the normal build untouched. After the plugin lands, `expo prebuild` has to run once." (A tracked config plugin wires `debuggable` and Expo Updates to a Gradle property; the runner builds with `-Pe2e`; `EXPO_PUBLIC_E2E=1` reaches the JS bundle through the environment.)
- Q18, Standards follow-up: "Yes." (`AGENTS.md` Verification and `CODING_STANDARDS.md` section 7 name `npm run layout:android` as the required check for native-only changes; the emulator doc is rewritten around the runner and keeps the manual steps.)
- Q19, Record it as an ADR: "Yes." (Written: ADR 0020.)

One point was filled in while writing this spec and is not a quoted decision: a scenario with `modal` force-stops and relaunches the app by deep link without clearing it, matching the web runner's reload on `modal`. See AC-15.

## Acceptance Criteria

### AC-1: The E2E build is debuggable with updates off, only when asked

**Given** the config plugin is applied to the generated Android project
**When** the Gradle release build runs with `-Pe2e`
**Then** the build is debuggable and Expo Updates is disabled
**And Given** the same project, **When** the build runs without `-Pe2e`, **Then** neither setting differs from today's release build.

### AC-2: The seed hook does nothing without the flag

**Given** `EXPO_PUBLIC_E2E` is not set and a seed file sits in the app's private folder
**When** the app launches
**Then** no seed is imported and the file is left untouched.

### AC-3: With the flag, the seed is imported through the app's own writers

**Given** `EXPO_PUBLIC_E2E=1` and a seed file `{ characters, folders, settings, integrated }`
**When** the app launches
**Then** characters, folders and settings are saved through `storage.ts`, the catalog (when `integrated` is not null) through `saveCompendiumData`, and the seed file is deleted.

### AC-4: A broken seed leaves no partial state

**Given** `EXPO_PUBLIC_E2E=1` and a seed file that is not valid JSON or lacks a required key
**When** the app launches
**Then** nothing from it is written, the app starts with empty state, and the seed file is deleted.

### AC-5: Only the flagged entry can reach the hook

**Given** the seed importer module
**When** any module in `src/` imports it outside the one entry guarded by the flag
**Then** a guard test fails and names the importer.

### AC-6: The web and native runners share one scenario list

**Given** `SCREENS` and `buildSeed()` moved to `scripts/lib/scenarios.mjs`
**When** `layout:check` lists its scenarios, with and without `--integrated`
**Then** the names and their order equal the list taken before the move, and `buildSeed()` returns `{ characters, folders, settings, integrated }`.

### AC-7: Scenario steps are data

**Given** a scenario's `open` and `modal` steps
**When** the shared module defines them
**Then** each is data (tap the text, with an optional index), the web runner plays them as clicks with the same outcome as today, and a step with no native form marks its scenario web-only.

### AC-8: The runner refuses anything that is not an emulator

**Given** the connected device's serial does not start with `emulator-`
**When** the runner starts
**Then** it exits non-zero before it clears, installs or launches anything.

### AC-9: Widths map to densities and are always restored

**Given** the widths 320, 360, 393 and 412
**When** the runner sets a width
**Then** it uses density 360, 320, 293 and 280, and it restores the device's original density at the end of the run, also after a failure.

### AC-10: The emulator is reused or started and stopped by the runner

**Given** an emulator is already running
**When** the runner starts
**Then** it uses that emulator and never stops it.
**And Given** none is running, **When** the runner starts, **Then** it boots `Small_Phone` headless (windowed with `--window`), waits until `sys.boot_completed` is `1`, and stops that emulator when the run ends.

### AC-11: The runner builds the E2E APK incrementally

**Given** a run without `--no-build`
**When** the runner prepares the app
**Then** it calls the incremental Gradle release build with `-Pe2e` and installs the APK with `adb install -r`, and the JavaScript bundle in that APK carries the live seed hook, whichever flag value the previous build used.
**And Given** `--no-build`, **Then** it skips Gradle and installs the APK already built.

### AC-12: A seeded scenario produces a screenshot

**Given** a scenario of the shared list at one width
**When** the runner runs it
**Then** it copies the seed file in with `run-as`, launches the scenario's route by deep link, waits for the `ready` text by polling `uiautomator dump`, and writes `<scenario>-<width>.png` into the run's screenshot folder (`SHOTS`, otherwise a new folder outside the repo).

### AC-13: Native steps play the shared fields

**Given** a scenario with `tabs`, `open`, `modal` or `scrollTo`
**When** the runner runs it natively
**Then** `tabs` and the `open` steps are carried out as taps on the text, pattern or label found in the dump, `modal` (the dialog's title) is the text waited for before the screenshot, `scrollTo` is carried out as swipes until the text shows, and `expect` is not evaluated.

### AC-14: A stuck scenario is reported and does not stop the run

**Given** a scenario whose `ready` text never appears within its timeout
**When** the timeout passes
**Then** the runner saves the stuck screen as `<scenario>-<width>-FAILED.png`, runs the remaining scenarios, and exits non-zero.

### AC-15: Isolation follows `fresh`, `modal` and route

**Given** a scenario marked `fresh`
**When** it starts
**Then** the app's data is cleared and the seed copied in again.
**And Given** a scenario marked `modal`, **Then** the app is force-stopped and relaunched by deep link without clearing its data.
**And Given** any other scenario, **Then** the runner only jumps to its route by deep link.

### AC-16: A term that matches nothing is an error

**Given** `ONLY` holds a term that no scenario name contains
**When** the runner starts
**Then** it exits with 2 and lists the scenario names of the run, as `layout:check` does.

### AC-17: The standards name the command

**Given** `npm run layout:android` exists
**When** the docs are read
**Then** `AGENTS.md` (Verification) and `CODING_STANDARDS.md` section 7 name it as the check for native-only changes, and `docs/agents/driving-the-android-emulator.md` is built around it and keeps the manual steps.

## Architecture Constraints

- The scenario module lives in `scripts/lib/`. Both runners depend on it and it depends on neither.
- The seed hook reads the flag as `process.env.EXPO_PUBLIC_E2E`, which Metro inlines at bundle time, so in a bundle built without the flag the hook returns at once and the importer never runs. The importer module is still in that bundle, unreachable.
- Metro's transform cache is not keyed on `EXPO_PUBLIC_E2E`: an export built after one with the other flag value reused the stale transform. The runner never builds the bundle from a cache transformed under another flag value.
- The hook writes only through `storage.ts` and `compendiumStorage.ts`, never straight to AsyncStorage or the catalog file (ADR 0020).
- The E2E build keeps the app id `com.anonymous.dnd5e2014CharacterBuilder`.
- `android/` stays gitignored. Everything native comes from tracked config: a config plugin and `app.config.js`.
- The runner is a plain `scripts/` program. It does not depend on `androidMCP`.
- The first ticket settles whether a Gradle property can drive the Expo Updates setting. If it cannot, the plugin's approach changes and ADR 0020's Decision needs an edit before the rest is built on it.

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1 | Config plugin function on fixture manifest and Gradle input; a built APK | Unit test of both outputs; `adb shell run-as <app id> ls files` succeeds on the `-Pe2e` APK and fails on the normal one |
| AC-2, AC-3, AC-4 | Seed importer module, with the existing test KV and fs seams | `npm test`: written values read back through `loadAll` and `loadCompendiumData`; the file is gone |
| AC-5 | `checks/` guard test | `npm test`: the guard fails on a planted import |
| AC-6 | Scenario module exports | `npm run layout:check` scenario list equals the list captured from master before the move |
| AC-7 | Scenario module plus the web runner | `layout:check` run, full, is green with the same scenarios visited |
| AC-8, AC-9, AC-16 | Pure functions of the runner | `npm test` |
| AC-10, AC-11 | Runner lifecycle and build step | `npm test` against a fake `adb` and `emulator`; one real boot and one real `--no-build` run; the bundle check below, run after a plain build and then an E2E build with no manual cache clearing |
| AC-12 | Full run on the emulator | `npm run layout:android -- --no-build` with `ONLY=Settings`: the PNG exists and shows Settings |
| AC-13 | Dump parser and step player | Test on fixture dump XML; a real run of one scenario with `tabs`, `open` and `scrollTo` |
| AC-14 | Full run with a deliberately wrong `ready` | Run exits non-zero; `-FAILED.png` exists; later scenarios still produced PNGs |
| AC-15 | Runner scenario loop | Test with a fake `adb` recording its calls; mutation check: delete each `pm clear`, `force-stop` and reseed line and see a test fail |
| AC-17 | The three docs | `grep -n 'layout:android' AGENTS.md CODING_STANDARDS.md docs/agents/driving-the-android-emulator.md` |

## Out of Scope

- Pixel diff, measured layout checks and any pass/fail on what a screenshot shows.
- Committed baseline screenshots.
- A user-facing import or export feature.
- iOS.
- `--integrated` on native in the first version. The flag is accepted and the scenario list is shared, but its first native run is a follow-up.
- Running on a real phone.

## Open Risks

1. **Expo Updates toggle.** A Gradle property may not be able to set the Updates flag in the generated manifest. Owner: the first ticket, which is a spike; its result decides ADR 0020's wording.
2. **Runtime.** 64 scenarios at four widths on one emulator is unmeasured and likely far above the web check's 3 minutes. `ONLY` may become the usual way to run it. Owner: the developer, after the first full run.
3. **How many scenarios stay web-only.** Known only once AC-7 is done. Owner: the AC-7 ticket reports the count.
