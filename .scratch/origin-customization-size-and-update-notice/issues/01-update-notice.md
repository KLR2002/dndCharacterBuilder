# 01: Update notice

**Status:** ready-for-agent

Spec: `../spec.md` (decisions Q3, Q19, Q22, Q23).

## What to build

After the app is updated, a user with an Integrated Catalog that is stale (saved below `REQUIRED_CATALOG_FORMAT`, or with no format) sees a modal once per required format: the app was updated, syncing the catalog in Settings is advisable. "Open Settings" navigates to Settings, "Later" closes. Either one saves the format the user was informed of; the modal returns only when `REQUIRED_CATALOG_FORMAT` is raised again. No build stamp, no changelog, no explanatory text.

## Owns

- AC-1: Notice shown after an update
- AC-2: Notice withheld
- AC-3: Notice dismissed

## Acceptance Criteria

- [ ] AC-1: stale catalog and an uninformed required format show the modal on app open, with "Open Settings" and "Later".
- [ ] AC-2: the SRD Baseline only, a current catalog, or an already-informed format show no modal.
- [ ] AC-3: either button saves the informed format; "Open Settings" navigates to Settings; the modal does not return until the required format is raised; Settings keeps its own re-sync hint.
- [ ] Settings saved by an older build (no informed-format field) load unchanged.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-1, AC-2 | a pure notice-decision function over catalog state and settings | red-green `node --test` cases: stale, stale with no format, current, SRD only, already informed |
| AC-3 | settings normalization and persistence round trip | red-green test: informed format saved and reloaded; an older settings object loads |
| AC-1 to AC-3 | the running app | browser run per `docs/agents/driving-the-app.md` with a seeded stale catalog: modal shows, "Later" hides it, a reload does not bring it back |

## Constraints

Optional `AppSettings` field with a default; `schemaVersion` handling stays valid. Reuse the shared `Modal` shell; copy follows CODING_STANDARDS §8. UI change: run `npm run layout:check`.

## Blocked by

None
