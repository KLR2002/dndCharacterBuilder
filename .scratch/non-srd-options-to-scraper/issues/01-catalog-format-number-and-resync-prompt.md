# 01: Catalog format number and re-sync prompt

**What to build:** The stored Integrated Catalog carries a format number, and the application declares the minimum format it requires. A catalog below that minimum is *stale* (see GLOSSARY *Integrated Catalog*). Settings shows "Re-sync to get the latest class options" for a stale catalog, and the Compendium and character context expose a stale flag that later tickets read. The in-app scraper stamps the current format on every sync. No migration and no forced re-sync.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Saving a catalog stores the current format number; loading a catalog returns it
- [x] A catalog stored without a number, or with a lower one, loads as stale and is still usable
- [x] The context exposes whether the loaded catalog is stale; the SRD Baseline is never stale
- [ ] Settings shows the re-sync prompt only for a stale catalog, and a successful sync clears it
- [x] Catalog storage tests (save, load, stale, current) pass, using the existing storage test hooks
- [x] Existing suite passes (`npm run check:all`)
