# 02: Modal Shell Unification & HomeScreen Dialogs

**What to build:** Enhance the shared `<Modal>` component with unified safe area padding, keyboard avoidance, and flexible responsive footers. Migrate `HomeScreen` inline `newFolderModal` and `moveCharModal` from raw `<RNModal>` to `<Modal>`, preventing keyboard occlusion and button clipping on narrow viewports.

**Blocked by:** 01-responsive-layout-foundation

**Status:** ready-for-agent

- [ ] Ensure `<Modal>` applies safe area bottom padding and flexible body shrinking.
- [ ] Migrate `newFolderModal` in `src/app/index.tsx` to `<Modal>` with standard buttons.
- [ ] Migrate `moveCharModal` in `src/app/index.tsx` to `<Modal>` with scrollable folder list.
- [ ] Verify clean layout on 320px viewport without horizontal or vertical clipping.
- [ ] Verify all tests, type checks, and lint pass.
