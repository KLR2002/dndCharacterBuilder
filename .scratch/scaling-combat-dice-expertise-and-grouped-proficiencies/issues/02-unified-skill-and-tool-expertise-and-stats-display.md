# 02: Unified Skill and Tool Expertise and Stats Display

**What to build:** Tool expertise is integrated into character evaluation alongside skill expertise. Players with expertise in tools (such as Rogue with Thieves' Tools or Artificer level 6+ Tool Expertise) see double-dot badges `[●●]` and calculated modifiers for their tools on the Stats tab.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] `character.chosenExpertise` supports both skill names and tool names (e.g. `"Thieves' Tools"`).
- [x] Tool proficiencies on `StatsTab.tsx` display calculated check modifiers using canonical abilities: Thieves' Tools $\rightarrow$ DEX, Musical Instruments $\rightarrow$ CHA, Herbalism Kit / Navigator's Tools $\rightarrow$ WIS, or flat proficiency bonus for flexible artisan tools.
- [x] If a tool is in `chosenExpertise`, its proficiency bonus is doubled ($2 \times \text{PB}$) and a double-dot badge `[●●]` is displayed.
- [x] At Artificer level 6 and higher, *Tool Expertise* automatically applies double proficiency bonus ($2 \times \text{PB}$) and double-dot badges to all proficient tools without requiring manual selection.
- [x] Skills on `StatsTab.tsx` continue to display double-dot badges `[●●]` and doubled proficiency bonus for all skills in `chosenExpertise`.
- [x] Tested via `checks/expertise.test.ts`.
