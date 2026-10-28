# 09: Layout scenario and wrap-up

**What to build:** A `layout:check` scenario opens the Spells tab with several granted-spell cards (a race, Magic Initiate and a Strixhaven Initiate with long names) and the pick controls in the feat picker, ancestry section and background section, at the four widths on the SRD Baseline and on the integrated catalog. The ADR 0004 text that describes the race table points to ADR 0017. Leftovers from the earlier tickets (dead helpers, stale tests) are removed.

**Blocked by:** 04, 07, 08

**Status:** done

**Landed:** "Spells granted cards" layout scenario (SRD and integrated, four widths, green), ADR 0004 annotated to point to ADR 0017, dead helpers and ticket references removed. `check:all` and `check:live` (82/82) green.

- [x] The scenario passes at all four widths, SRD and `-- --integrated`.
- [x] ADR 0004 is annotated; no dead code remains from the old race table.
- [x] `npm run check:all` and `npm run check:live` pass on the integrated branch.
