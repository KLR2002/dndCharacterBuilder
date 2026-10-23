# 03: Header name fits at 320 px

**What to build:** On a 320 px phone the character name in the header is readable and never overlaps the HP badge. A long name is shortened with an ellipsis. The case is part of the layout check.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merged from `pr/03-header-name` (787f740). The name shrinks with an ellipsis and never pushes the badges; the layout check has a long-name screen. Open: at 320 px the name still has only about 65 css px next to the HP group and level badge (about six characters); the web check cannot reproduce the native-only defect, so a device pass is needed.

- [ ] At 320 px a long character name is shortened with an ellipsis and does not overlap or push the HP badge.
- [ ] A layout-check screen exercises a long name, so a regression fails the check.
- [ ] The layout rules in CODING_STANDARDS section 7 are followed (wrap or shrink, Android text props).
- [ ] `npm run check:all` and `npm run layout:check` pass in both catalog modes.
