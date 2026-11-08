# 01: Product context for the redesign

**Type:** grilling

**Blocked by:** None (can start immediately)

**Status:** resolved

## Question

What product truth does the redesign serve: who uses the app, at the table or while preparing, on which devices, and what must never regress? Captured as `PRODUCT.md` through `/impeccable init`, with the user.

## Answer

`PRODUCT.md` at the repo root. Users: players preparing (building, levelling, often on a bigger screen) and players at the table (phone, quick lookups and rolls). Positioning the user made binding: free, no ads, offline; phone-first. Strict 2014 rules and SRD-plus-synced-catalog are recorded as constraints, not positioning. Platform: `android` (one custom look on Android and web; Android conventions win where they differ). Accessibility: WCAG AA, 44pt/48dp targets, 320px minimum, reduced motion honoured. No image generation is available, so new surfaces are built code-first; nothing is recorded in `.impeccable/config.json`.
