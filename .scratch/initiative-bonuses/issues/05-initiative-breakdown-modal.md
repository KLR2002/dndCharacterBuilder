# 05: Tapping the Initiative box shows where the number comes from

**What to build:** The Initiative box on the Stats tab keeps showing one total, and becomes tappable. Tapping it opens a modal, built on the shared modal shell, that lists each part of `initiativeBreakdown` with its label and signed value (Dexterity, then each source by name), and the total. Numbers only, each line named after its source; no explanatory text (CODING_STANDARDS section 8). The modal fits the screen at every supported width.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The Initiative box is a pressable with an accessibility label; a character with only Dexterity opens a modal showing "Dexterity" and the total.
- [ ] A character with bonuses (use the same invented fixtures as the engine tests, or a seeded integrated catalog) shows one line per part in breakdown order and the total, each value signed.
- [ ] A `layout:check` scenario opens the modal at the four widths with a multi-part breakdown (include a long source name) and nothing clips or overflows at 320 px.
- [ ] A rules-free change: no rule module is touched.
- [ ] Screenshots at 320 and 393 px are reviewed by the main session; `npm run layout:check` passes (SRD, and `-- --integrated` if the scenario needs the catalog).
- [ ] `npm run check:all` passes.
