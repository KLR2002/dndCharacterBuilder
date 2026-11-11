# 02: No empty band above the sheet's tab bar on phones

**What to build:** On the phone character sheet a blank band sits between the tab content and the bottom tab bar, with the floating dice button inside it; content is cut off at the band's top. Two causes, both in the phone branch:

1. The band is reserved outside the scroll view. `src/app/character/[id].tsx` pads the tab content's wrapper by `tabBarHeight + 72` (72 = the dice button's 56dp plus its 16dp margin), so every tab's ScrollView ends 72dp above the bar and the rest is background. The Creation Flow solves the same problem inside the scroll content instead (`useFlowStepScrollContentPadding` in `src/components/creationFlow/FlowShell.tsx`): the content scrolls under the button, and the scroll content's bottom padding (`DICE_BUTTON_SIZE + DICE_BUTTON_EDGE_MARGIN`) lets the last row scroll clear of it.
2. On Android the bottom safe-area inset is counted twice. `SheetTabBar` (`src/components/sheet/sheetChrome.tsx`) is absolutely positioned at `bottom: 0` inside the sheet's `SafeAreaView` and pads its own bottom by `insets.bottom`, so it extends under the inset and its measured height includes it. Both consumers of that height add the inset again: the content wrapper already sits above the `SafeAreaView`'s bottom padding, and `DiceOverlay` computes `insets.bottom + 16 + bottomObstruction`. On a phone with a 48dp navigation bar the band is about 120dp instead of 72 and the button floats about 64dp above the bar instead of 16 (measured from a device screenshot: band 122dp, button 66dp above the bar).

The fix: `SheetTabBar`'s `onLayout` reports the bar's height above the bottom inset (`layout.height - insets.bottom`), and its doc comment says so; the phone wrapper pads by that height only; a `useSheetScrollContentPadding()` hook beside `SheetTabBar` returns `{ paddingBottom: DICE_BUTTON_FOOTPRINT }` on phones (the sheet's own `!isTablet` from `useResponsiveLayout`) and `{}` at wide widths, and each tab's main ScrollView adds it to its `contentContainerStyle` (`StatsTab` ~1043, `ActionsTab` ~84, `SpellsTab` ~807, ~827, ~962, `InventoryTab` ~296, `FeaturesTab` ~428, `JournalTab` ~110; not the horizontal or modal scroll views). Comments that say the button never sits over content are updated: it never sits over the bar or a tab. The wide layout (rail) is unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `checkSheetChrome` in `scripts/layout-check.mjs` (phone branch) fails today and passes after the fix on: the tab content's scroll view bottom is within 1px of the bar's top (give the wrapper View in `[id].tsx` a `testID="sheet-tab-content"` and measure its first child); the dice button's bottom is 16px (plus or minus 1) above the bar's top
- [ ] `ONLY="Sheet chrome,Dice button on sheet" WIDTHS=320 npm run layout:check` passes, and the same at 393
- [ ] `npm run check:all` passes
- [ ] On Android (main session, at the gate): a screenshot of the Stats tab shows no band and the button 16dp above the bar
