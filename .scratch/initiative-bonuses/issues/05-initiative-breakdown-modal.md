# 05: Tapping the Initiative box shows where the number comes from

**What to build:** The Initiative box on the Stats tab keeps showing one total, and becomes tappable. Tapping it opens a modal, built on the shared modal shell, that lists each part of `initiativeBreakdown` with its label and signed value (Dexterity, then each source by name), and the total. Numbers only, each line named after its source; no explanatory text (CODING_STANDARDS section 8). The modal fits the screen at every supported width.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-a29f6392eed83de2d` (tip 8181057). `check:all` passes; `layout:check` GREEN at four widths on the SRD baseline and `--integrated`. The Initiative box is tappable and opens a modal on the shared shell listing each part and the total; a scenario with a Rogue 3 Swashbuckler / Wizard 2 War Magic character shows Dexterity +2, Rakish Audacity +3, Tactical Wit +3, Total +8. Screenshots at 320 and 393 px viewed by the main session. Open items: the longest bonus name in the seeded catalog is 15 characters, so the 320 px check does not exercise the longest real name (labels shrink and wrap); no component test harness exists, the layout scenario is the test.

- [x] The Initiative box is a pressable with an accessibility label; a character with only Dexterity opens a modal showing "Dexterity" and the total.
- [x] A character with bonuses (use the same invented fixtures as the engine tests, or a seeded integrated catalog) shows one line per part in breakdown order and the total, each value signed.
- [x] A `layout:check` scenario opens the modal at the four widths with a multi-part breakdown (include a long source name) and nothing clips or overflows at 320 px.
- [x] A rules-free change: no rule module is touched.
- [x] Screenshots at 320 and 393 px are reviewed by the main session; `npm run layout:check` passes (SRD, and `-- --integrated` if the scenario needs the catalog).
- [x] `npm run check:all` passes.
