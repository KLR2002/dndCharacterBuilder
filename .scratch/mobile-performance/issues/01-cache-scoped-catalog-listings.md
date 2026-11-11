# 01: Cache the book-scoped catalog listings

**What to build:** On a phone (release build) a pick in the Creation Flow or Level-Up Flow takes a visible moment to show. Measured in Node against the live Integrated Catalog (`.cache/live-catalog/catalog.json`), one render of the build screen spends about 30 ms (V8 with JIT) or 70 ms (V8 interpreter only, closer to Hermes) in rules code, and a pick costs two renders. A CPU profile puts most of it in `scoped()` in `src/services/compendium.ts` (~119-145): `compendium.for(activeBooks)` builds new listing functions on every call, and every `races()`, `classes()`, `items()`, `spells()`... call re-filters (and for races and classes re-copies) the whole catalog. The Proficiency Sheet calls these many times per render, and `proficiencyChoiceOffers` builds one sheet per choice.

A compendium caches its scoped listings: `for(activeBooks)` returns the same listings object for the same book list (keyed by the books in order, e.g. `activeBooks.join("|")`), and each listing computes its array once, on first call, and returns that same frozen array afterwards (`Object.freeze` on the array, shallow). A new compendium (`createCompendium`, which `integrate` and `revertToSrd` swap in) starts with an empty cache, so a catalog change never serves stale lists. The unscoped listings are unchanged. Measured with this exact change applied temporarily: one pick drops from about 143 ms to 33 ms interpreter-only, and from 62 ms to 22 ms with JIT.

Add the measurement as a tracked script so later tickets can rerun it: `scripts/perf-rules.mjs`, adapted from `.scratch/mobile-performance/bench.ts` (copy it; it imports the rules by absolute path, make those repo-relative), with an npm script `perf:rules` (`node --experimental-strip-types scripts/perf-rules.mjs`) and a second one `perf:rules:interp` that adds `--no-opt --no-sparkplug --no-maglev`. It exits 2 with a message naming `npm run catalog:live` when the cache file is missing. It is not part of `check:all`.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** e2370d7. One pick (perf:rules, integrated with 02): 62-89 ms -> 11 ms with JIT, 143-198 ms -> 21-24 ms interpreter-only. check:all and check:live 141/141 pass. Open: listing types stay mutable (arrays are frozen at runtime).

- [x] A test (in `checks/compendium.test.ts`) shows: two `for(books)` calls with equal book lists return listings whose `items()` (and `races()`) are the same array; the array is frozen; a different book list gives a different array; a new `createCompendium` of the same bundle gives a new array. Use a small invented bundle, not the live catalog
- [x] Every existing test passes unchanged; a test that now throws on a frozen array is a caller mutating a shared listing: fix the caller to copy first and name it in the report
- [x] `npm run perf:rules` and `npm run perf:rules:interp` run, and the report pastes both outputs before and after the change
- [x] `npm run check:all` and `npm run check:live` pass
