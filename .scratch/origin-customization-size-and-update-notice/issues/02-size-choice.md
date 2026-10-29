# 02: Size Choice

**Status:** ready-for-agent

Spec: `../spec.md` (decisions Q4, Q5; GLOSSARY *Size Choice*).

## What to build

A race or lineage whose record lists two or more sizes offers those sizes in the Ancestry section, read from the record, with the first selected until the player picks. The resolved size shows on the Ancestry banner and the character header. A race change to a race that does not list the picked size releases the pick. A race listing one size offers no choice. The resolved size is exposed by a single function other rules can read.

## Owns

- AC-4: Size offered
- AC-5: Size shown and released
- AC-7: SRD Baseline

## Acceptance Criteria

- [ ] AC-4: offered sizes equal the record's sizes; first selected by default; single-size race offers nothing.
- [ ] AC-5: pick shown on the banner and the character header; released on a race change to a race not listing it.
- [ ] AC-7: on the SRD Baseline no size picker appears and nothing regresses (a character saved on the SRD loads on the Integrated Catalog and back with the same size).
- [ ] Size Choice is a plain optional character field, not a Rule Choice; no size name is written in code.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-4, AC-5, AC-7 | the ancestry state (`resolveAncestryState`) and the race-change transition | red-green tests in both modes: multi-size race, single-size race, lineage replacement, race change, SRD |
| AC-5 | the Ancestry banner and character header | `npm run layout:check` (both modes) and a browser run |

## Constraints

Dual-mode invariant. The record's sizes are the only source of options. Saved sources are never rewritten. Copy per CODING_STANDARDS §8.

## Blocked by

None
