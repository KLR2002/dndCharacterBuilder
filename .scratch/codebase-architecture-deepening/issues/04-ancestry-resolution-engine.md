# 04: Deep Ancestry Resolution & Rule Choices Engine

**What to build:** Build the deep Ancestry Engine (`src/rules/ancestryEngine.ts`). Encapsulate catalog querying, variant feature gating (such as SCAG descent options), origin feat slot eligibility (Variant Human, Custom Lineage), High Elf and Half-Elf descent cantrip unlocking, and cascading invalidation when switching ancestry or variant traits. Provide an intent-based mutation interface: `applyAncestrySelection`, `applyAncestryChoice`, and `clearAncestryChoice`.

**Blocked by:** 03: Character Sheet Tabs Migration to Evaluated Model.

**Status:** done

- [x] Create `src/rules/ancestryEngine.ts` exporting `resolveAncestryState(character, catalogs?)`.
- [x] Implement `applyAncestryChoice` with automatic cascading (e.g. clearing dependent cantrip rule choice when unselecting "Cantrip" descent trait).
- [x] Expose origin feat and racial cantrip eligibility flags cleanly without relying on UI string matching.
- [x] Write unit tests in `checks/ancestryEngine.test.ts` covering High Elf cantrip unlocking, Half-Elf descent variant choices, and cascading cleanups.
- [x] Verify zero TypeScript errors and all tests pass with `npm test`.

