# 01: Responsive Layout Foundation & Hook

**What to build:** A centralized responsive layout hook (`useResponsiveLayout`) that computes device viewport categories (`compact` < 380px, `phone` < 600px, `tablet` ≥ 768px), provides safe area insets, and includes automated unit tests verifying breakpoint thresholds against standard mobile screen dimensions (320px, 360px, 375px, 390px, 414px, 768px, 1024px).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Create `src/hooks/useResponsiveLayout.ts` with `width`, `height`, `isCompact`, `isPhone`, `isTablet`, and safe area insets.
- [ ] Add unit tests in `checks/responsiveLayout.test.ts` verifying breakpoint calculations.
- [ ] Verify zero TypeScript errors and zero lint errors.
