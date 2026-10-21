# 0015 Proficiency Grants Live in the Catalog; the Proficiency Sheet Is Derived

## Context
Skills, tools, languages, weapons, armor and saving throws were granted by per-source code branches (for example a class-name if-chain for tools). Subclass features and feats granted nothing, because the Catalog carries subclass feature rules only as prose. Every new rule meant finding and hand-coding the grant, and nothing told us which rules were still missing.

## Decision
- A rule's Proficiency Grants are structured data on that rule's feature in the Catalog. The scraper extracts them from prose, with a reviewed override file in `dnd5eToolsScrap/` for sentences it cannot parse. The app reads the grants and encodes no non-SRD rule content, consistent with ADR 0014.
- A scraper test fails when a feature's prose mentions a proficiency, language, tool or saving-throw grant and the feature has neither a grant nor an explicit "reviewed, grants nothing" mark. A newly scraped book is therefore reviewed before it ships.
- The Proficiency Sheet is computed from the character and the Catalog on every read and is never stored. Rule-granted entries vanish with their source and cannot be removed by hand. Only Added Proficiencies (tools and languages) are stored, and saved picks are kept under grant ids. A grant's id is derived from what the grant is: its category and kind, and for a fixed grant the names it grants. A choice's id leaves out the pool it picks from, so a re-scrape that reorders grants or changes a pool does not move a pick. Each grant keeps the position-based id it had before as an alias, a choice whose id changed also keeps the id that named its pool, and loading a character moves a pick saved under an alias to the grant's id once.
- A grant on an option of a feature's choice carries its own requirement (the Totem Warrior's Tiger is gated on the Aspect of the Beast pick), and the Monk weapon rule is the shape of a Monk subclass's weapon choice, so no subclass name lives in app code.
- The Catalog format number increases, so the stale-catalog gate forces a re-sync; the SRD baseline is regenerated through `scripts/prune-to-srd.mjs` as its own commit.
- The Proficiency Sheet (`src/rules/proficiencySheet.ts`, with private sources in `src/rules/proficiencySources/`) is the only reader of race, background and class proficiency fields. `checks/proficiencyReadersGuard.test.ts` fails any other read, except the Builder's own picks and the card displays its allowlist names.

## Known exceptions
- `MULTICLASS_PROFICIENCIES` (`src/constants/rules.ts`) is still a hand-written table: the armor, weapon, tool and skill grants of a later class's multiclassing. The Catalog class records carry a multiclassing field (`multiclassing.proficienciesGained`) that the sheet does not read yet. The sheet's class-base source reads the table, and the readers guard allowlists the one use outside the sheet (`builderTransitions.ts`).

## Considered Options
A hand-written grants table inside `src/` was rejected: it would bundle non-SRD rule content in the app, and nothing would reveal gaps. Parsing prose at runtime was rejected as unreviewable and slow.
