# 16: Disabled optional feature releases its pick

**What to build:** A proficiency pick stored for an optional feature that is turned off is released with a review notice, and asked for again when the feature is turned back on.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merged from `pr/16-optional-pick-release` (4e7f94b). The builder and Features tab now toggle optional features through a reconciling transition. The SRD layout check was green; integrated mode was not run for this ticket.

- [ ] Turning an optional feature off releases the proficiency pick stored for it and adds a notice.
- [ ] Turning it back on shows the choice as "Picked 0 / N" again; the old pick is not restored.
- [ ] The release runs inside the reconcile pass order, before Expertise is pruned, so an Expertise mark that depended on the pick is released too.
- [ ] Reconciling twice gives the same result, covered by a test.
- [ ] `npm run check:all` and `npm run layout:check` pass in both catalog modes.
