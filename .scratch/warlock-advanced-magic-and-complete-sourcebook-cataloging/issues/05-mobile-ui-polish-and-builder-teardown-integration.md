# 05: Mobile UI Polish & Builder Teardown Integration for Epic 5

**What to build:**
Comprehensive UI polish and teardown resilience across all new screens and components. Ensure touch targets on Mystic Arcanum cards, Ritual Book ledger, and Settings category accordions adhere to $\ge 44\text{px}$ touch targets with appropriate hitSlop, prevent text truncation on compact mobile viewports (320px–360px), and verify that disabling sourcebooks or changing classes/pacts adds clear explanatory notices to `character.needsReview`.

**Blocked by:** 01 (Complete 2014 Sourcebooks Ingestion), 02 (Pact of the Tome Cantrips Selection), 03 (Book of Ancient Secrets Ritual Ledger), 04 (Mystic Arcanum Selection Milestones)

**Status:** closed

- [x] Add `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` to all interactive buttons, toggle chips, and cast toggles in Mystic Arcanum, Ritual Book, and Settings accordions.
- [x] Verify that Mystic Arcanum cards and Ritual Book cards wrap gracefully without clipping on 320px–360px mobile viewports.
- [x] Verify that Settings category accordions expand and collapse smoothly with clear headers and count indicators (e.g. `12 / 14 Active`).
- [x] Verify that teardown transitions in `builderTransitions.ts` properly detect orphaned features (Arcanum spells, Tome cantrips, Ancient Secrets rituals, disabled book subclasses) and populate descriptive warnings in `character.needsReview`.
- [x] Run full project verification `npm run check:all` (`npm test`, `npm run typecheck`, and `expo lint`) ensuring 0 errors across the entire test suite.
