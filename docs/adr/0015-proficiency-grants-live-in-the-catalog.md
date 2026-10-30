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

- A skills grant whose feature text doubles the proficiency bonus for the skills it grants carries an `expertise` mark, written by the scraper (catalog format 7). The Proficiency Sheet marks those skills, fixed or picked, as having Expertise and stores nothing. A scraper test fails when a feature's text doubles the bonus and the feature has neither the mark nor a review entry (`REVIEWED_NOT_A_SKILL_GRANT`). The Expertise milestones stay for features that double the bonus on a skill the character already holds.
- A later class's skill choice from its `multiclassing` record is a Proficiency Choice on a `Multiclass Proficiencies` feature of that class entry, with a grant id built from the class's source and name.

## Known exceptions
None remain.

## Considered Options
A hand-written grants table inside `src/` was rejected: it would bundle non-SRD rule content in the app, and nothing would reveal gaps. Parsing prose at runtime was rejected as unreviewable and slow.

## Amendment: gated race and subrace grants
- A race's or subrace's fixed proficiency grant may carry a reviewed `gatedBy` (a Rule Choice id and an option). The scraper writes it from `PROFICIENCY_GRANT_GATES`, a reviewed list of subrace, trait and option that names the category of fixed grants it gates, and a tracked-data check fails a gate that names no such grant or an option its trait does not offer. The Half-Elf descents' weapons are the first: they are held only while the Variant Feature picks Elf Weapon Training.
- A gated grant is read only while the character's pick on the named choice includes the option. The gate test is one leaf module, `src/rules/grantGate.ts`, shared with the spell reader of ADR 0017. The Proficiency Sheet, the Proficiency Picks and the lineage check read a race's or subrace's grants through it, so the Origin Customization swap rows and any saved swap of a gated grant follow the pick; a swap whose grant leaves the character is released with the usual notice.
- The Catalog Format is 13: a catalog saved at format 12 carries no `gatedBy` and is stale.
