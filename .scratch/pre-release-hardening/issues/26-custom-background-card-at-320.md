# 26: The Custom Background card fits at 320 px

**What to build:** The new Background picker layout scenario is RED at 320 px in both catalog modes: on the card that opens the Custom Background form, the description is squeezed into a 136 px column (about six lines of 19 characters) beside the "Create Custom" button. At 360, 393 and 412 px it passes. Fix the card header in `src/components/builder/BackgroundSection.tsx` so the text and the button follow `CODING_STANDARDS.md` section 7 (rows wrap or shrink; fluid, not breakpoint-driven), for example by letting the header row wrap so the button drops below the text when the text would be narrower than a readable width.

**Blocked by:** None

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `npm run layout:check` and `npm run layout:check -- --integrated` are GREEN, including "Builder Background picker" at 320 px; look at the 320 and 393 px screenshots of that card and the open form.
- [ ] `npm run check:all` passes.
