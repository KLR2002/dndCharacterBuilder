# 02: Seed hook in the app

**Status:** done
**Landed:** ae08167. `checks/e2eSeed.test.ts` and `checks/e2eSeedHookGuard.test.ts` 10/10 (red-green and three mutation checks by the implementer); `npm run check:all` exit 0 (1763 app tests, 303 scraper tests); `context.test.ts` 25/25 in six repeat runs. Bundle check with `expo export`: a plain bundle holds the hook as `async function(){return}`; an E2E bundle (cache cleared) holds the importing hook. The importer module ships in the plain bundle, unreachable, and the spec and the source comment say so. Open: Metro's cache is not keyed on the flag, which ticket 05 now covers under AC-11.

## What to build

In the E2E build only (`EXPO_PUBLIC_E2E=1`), the app reads a seed file from its private folder on launch, imports it through its own storage writers, and deletes it. The seed has the shape `{ characters, folders, settings, integrated }`. In any other build the hook does not exist in the bundle or does nothing. A seed that cannot be read leaves no partial state. A guard test keeps the hook reachable from one flagged entry only.

## Owns

- AC-2: The seed hook does nothing without the flag
- AC-3: With the flag, the seed is imported through the app's own writers
- AC-4: A broken seed leaves no partial state
- AC-5: Only the flagged entry can reach the hook

## Acceptance Criteria

- [x] AC-2: With `EXPO_PUBLIC_E2E` unset and a seed file present, nothing is imported and the file is untouched.
- [x] AC-3: With `EXPO_PUBLIC_E2E=1` and a valid seed, characters, folders and settings are saved through `storage.ts`, the catalog (when `integrated` is not null) through `saveCompendiumData`, and the seed file is deleted. Loading afterwards returns the seeded values.
- [x] AC-4: With `EXPO_PUBLIC_E2E=1` and a seed that is not valid JSON or lacks a required key, nothing from it is written, the app starts with empty state, and the file is deleted.
- [x] AC-5: A guard test fails and names the importer when any module in `src/` imports the seed importer outside the one entry guarded by the flag.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-2, AC-3, AC-4 | Seed importer module, with the existing test KV and filesystem seams | Red-green tests in `checks/`: values read back through `loadAll` and `loadCompendiumData`; the file is gone afterwards. Mutation check: delete the flag check, the delete-file line, and the validate-before-write line, and see a test fail each time. |
| AC-5 | Guard test in `checks/` | Red-green: the guard fails on a planted import, passes on the real tree. |

## Constraints

- Spec: `.scratch/native-screenshot-runner/spec.md`. Decision record: `docs/adr/0020-native-e2e-build-seeds-through-the-apps-own-storage.md`.
- The hook reads the flag as `process.env.EXPO_PUBLIC_E2E`, which Metro inlines at bundle time, so in a bundle built without the flag the hook returns at once and the importer never runs.
- The hook writes only through `storage.ts` and `compendiumStorage.ts`, never straight to AsyncStorage or the catalog file.
- Shared storage code must not use browser globals without a platform check (`CODING_STANDARDS.md` section 6).
- Out of scope: pushing the seed with `run-as` (ticket 06), the config plugin (ticket 01).

## Blocked by

None
