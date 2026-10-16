# 07: Prose-only tables get completeness tests; Pact Boon fallback removed

**What to build:** Rules that exist only as sentence text stay as curated name-and-number tables, each with a test that fails when a catalog option has no entry: Battle Master maneuver action types, the at-will invocation spells, and the Clockwork Soul and Aberrant Mind swap schools. The hand-written Pact Boon fallback list is deleted, since the SRD Baseline already holds the three SRD boons.

**Blocked by:** 02 (needs the fixture catalog)

**Status:** ready-for-agent

- [ ] Each curated table has a completeness test against the fixture catalog
- [ ] The Pact Boon module offers only catalog options; SRD mode still offers the three SRD boons
- [ ] No prose is parsed
- [ ] Existing suite passes (`npm run check:all`)
