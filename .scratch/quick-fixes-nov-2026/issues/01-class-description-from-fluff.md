# 01: Class description from the class fluff file

**What to build:** The Info button next to a class in the builder (`src/components/builder/ClassProgressionSection.tsx`, it passes `cl.description` to the detail modal) shows "No description provided." for every class. The scraper builds `description` from the class record's `entries` (`dnd5eToolsScrap/src/scrapers/classes.ts`, the `classes.push({... description: renderEntries(raw.entries, "markdown") })` call), but 5e.tools class records carry no `entries`: a class's prose lives in a separate fluff file. `data/class/fluff-index.json` maps the same keys as `data/class/index.json` to `fluff-class-<key>.json`; each such file has a `classFluff` array whose items carry `name`, `source`, `entries` (and `images`, ignored). A fluff item belongs to the class record with the same `name` and `source` (the 2014 and 2024 prints of a class each have their own item). `scrapeClasses` reads the fluff index once, reads each listed fluff file for its class key, and gives each class `description = renderEntries(fluff.entries, "markdown")` from its matching item. A class record that has `entries` of its own keeps them. Fluff is optional: a missing or failing fluff index, a missing or failing fluff file, or no matching item leaves that class's description empty and the scrape carries on (the existing scraper tests' fake clients throw on any unknown endpoint, and must keep passing unchanged). The Catalog Format rises to 15 so a saved Integrated Catalog prompts a re-sync, following commit 8b6ff93 (`src/services/compendiumStorage.ts` doc line and constant, `checks/compendium.test.ts`, the ADR 0015 line). The SRD Baseline (`src/data/classes.json`) is not touched.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** 4866f8d (import tidy c062093). check:all (2123 app, 312 scraper tests), check:live 141/141, full layout:check green.

- [x] A new scraper test (`dnd5eToolsScrap/checks/class-fluff.test.ts`, invented names and sentences only) drives `scrapeClasses` with a fake client: two prints of one class (same name, different source) each get the description from their own fluff item; a class with no matching fluff item has an empty description; a fake whose fluff-index fetch throws still returns every class
- [x] `REQUIRED_CATALOG_FORMAT` is 15, with its doc line, and the tests that name the format pass
- [x] `checks/liveCatalog.test.ts` gains an invariant: each of the twelve SRD class names (Barbarian ... Wizard), in every print the live catalog holds, has a non-empty description
- [x] `npm run check:all` and `npm run check:live` pass
