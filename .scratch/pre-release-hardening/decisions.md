# Pre-release hardening: decisions

Source for `/to-spec`. The product owner decided each item below one by one. Nothing here is built yet unless it says "done".

## Done

- **Catalog format 4** (merged, `af6e772`). Forces one re-sync of every cached Integrated Catalog.
- **Kensei weapon pickers show held weapons** (merged). A kensei weapon is also a Monk Weapon, so held weapons stay offered.
- **Artificer duplicate subject** (merged). Same-named classes from different sources no longer collide in grant resolution.
- **Classes resolve by name and source** (merged). Base saves, hit die, caster kind and spell ability are still name-keyed (see B).

## In flight

- **Expertise follows active books.** Branch `feat/expertise-follows-active-books`. Decision: disabling a book removes an Expertise mark that only that book's skill backed, with a review notice. Re-enabling the book does not bring the mark back. Only Expertise is scoped; stored proficiency picks stay.

## To spec (all chosen for this release)

A. **Move the remaining hand tables to Catalog grants.** Class starting tools (the class-name if-chain), race and background tools and languages through the grant shape, the race and background skill tables, Githyanki and Drow weapons and Githyanki armor, the Totem Warrior Tiger table, and the Kensei subclass name constant. Delete the app tables, tighten the readers guard, update ADR 0015's Known exceptions.

B. **Class base data from the Catalog.** Base saves, hit die, caster kind and spell ability come from the catalog class by name and source, not the name-keyed table. The saving-throw baseline is re-recorded with its recorder env var only (never by hand), and the allowlist diff is reviewed.

C. **Kensei categories from the Compendium.** The items scraper carries each weapon's simple/martial category, so weapons from other books are offered. Needs an items re-scrape.

D. **Stable grant ids.** Ids stop depending on a grant's position in its feature. Ids already shipped must keep working for saved `proficiencyPicks`.

E. **Disabled optional feature releases its pick.** A stored pick for an optional feature that is turned off is released with a notice, not kept invisible.

F. **Polish and guards.**
   - The character name in the header truncates at 320 px.
   - The nested-scroll layout guard misses heights written as inline style objects.
   - The beast browser adoption guard.
   - The proficiency readers guard misses `import * as ns`.

## Not decided

- **Retro items 4, 6 and 8** from an earlier session: the text was not recoverable. Run `/retro` or restate them.
- **Haiku `5.5` trailers** on some commits: leave as is unless rewriting local history is wanted.
- **Device and Android verification** is the product owner's task.
- **Merge to `master` and push**: not before the above and the device check.

## Out of scope

Derived-stat bonuses (Rod of the Pact Keeper, Swashbuckler initiative, Hexblade hex weapon) and class equipment choices stay parked.
