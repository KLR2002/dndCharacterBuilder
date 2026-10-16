# 01: Compendium module and current-Compendium owner (expand)

**What to build:** A concrete Compendium value built from a collections bundle. Listings can be scoped to active books; name lookups stay unscoped. The SRD Baseline and the Integrated Catalog both produce collections bundles, and the per-collection SRD fallback keeps working. A single owner holds the process-wide default, with `integrate` and `revertToSrd` replacing the existing set/clear/init store functions. The existing data-service helpers delegate to the new owner so no caller changes yet (expand step).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Compendium built from in-memory collections returns scoped lists and unscoped lookups
- [x] Dataset swap: integrated mode returns no SRD records
- [x] Per-collection SRD fallback when an integrated collection is missing
- [x] integrate / revertToSrd switch the default and are observable through existing data-service getters
- [x] Existing test suite passes unchanged (`npm run check:all`)
