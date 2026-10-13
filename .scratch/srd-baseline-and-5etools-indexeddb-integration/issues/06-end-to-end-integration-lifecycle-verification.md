# 06: End-to-End Integration Lifecycle & System Verification

**What to build:**
Complete end-to-end integration tests and system-level verification covering the full lifecycle: running on SRD Baseline, creating an SRD character, triggering integration, verifying IndexedDB hydration and cutover (with zero duplicate records and SRD disabled), toggling sourcebooks, creating a non-SRD character (e.g. Hexblade or Echo Knight), reverting back to SRD, and confirming `npm run check:all` passes cleanly.

**Blocked by:** 05 (First-Run Informational Modal & Settings Sourcebook Gating)

**Status:** closed

- [x] Write integration test in `checks/integrationLifecycle.test.ts` covering:
  - Default SRD state: only SRD entities accessible
  - Integration cutover: IndexedDB populated, SRD baseline disabled in memory, zero duplicate races or classes
  - Sourcebook filtering: checking only enabled books are surfaced
  - Revert action: IndexedDB cleared, app returns cleanly to SRD baseline
- [x] Run `npm run check:all` (tests, TypeScript check, Expo lint) and ensure all checks pass with zero errors
