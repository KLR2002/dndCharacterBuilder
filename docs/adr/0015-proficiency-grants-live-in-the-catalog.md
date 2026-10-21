# 0015 Proficiency Grants Live in the Catalog; the Proficiency Sheet Is Derived

## Context
Skills, tools, languages, weapons, armor and saving throws were granted by per-source code branches (for example a class-name if-chain for tools). Subclass features and feats granted nothing, because the Catalog carries subclass feature rules only as prose. Every new rule meant finding and hand-coding the grant, and nothing told us which rules were still missing.

## Decision
- A rule's Proficiency Grants are structured data on that rule's feature in the Catalog. The scraper extracts them from prose, with a reviewed override file in `dnd5eToolsScrap/` for sentences it cannot parse. The app reads the grants and encodes no non-SRD rule content, consistent with ADR 0014.
- A scraper test fails when a feature's prose mentions a proficiency, language, tool or saving-throw grant and the feature has neither a grant nor an explicit "reviewed, grants nothing" mark. A newly scraped book is therefore reviewed before it ships.
- The Proficiency Sheet is computed from the character and the Catalog on every read and is never stored. Rule-granted entries vanish with their source and cannot be removed by hand. Only Added Proficiencies (tools and languages) are stored, and saved picks are kept under ids that never change once shipped.
- The Catalog format number increases, so the stale-catalog gate forces a re-sync; the SRD baseline is regenerated through `scripts/prune-to-srd.mjs` as its own commit.
- The Proficiency Sheet (`src/rules/proficiencySheet.ts`, with private sources in `src/rules/proficiencySources/`) is the only reader of race, background and class proficiency fields. `checks/proficiencyReadersGuard.test.ts` fails any other read, except the Builder's own picks and the card displays its allowlist names.

## Known exceptions
None remain. The Totem Warrior's option gate and the Kensei weapon rule are read from the Catalog: a grant on an option of a feature's choice carries its own requirement, and the Monk weapon rule is the shape of a Monk subclass's weapon choice.

## Considered Options
A hand-written grants table inside `src/` was rejected: it would bundle non-SRD rule content in the app, and nothing would reveal gaps. Parsing prose at runtime was rejected as unreviewable and slow.
