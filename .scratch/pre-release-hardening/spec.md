# Spec: Pre-release hardening, Proficiency Sheet follow-ups and tooling

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/pre-release-hardening/`).
**Related:** ADR 0015 (Proficiency Grants live in the Catalog, including its Known exceptions), ADR 0014, ADR 0013, CODING_STANDARDS §1, §3, §4, §7, §8, `.scratch/pre-release-hardening/decisions.md` (the decisions behind this spec), `.scratch/proficiency-sheet/` (the spec this follows up). GLOSSARY terms *Proficiency Grant*, *Proficiency Choice*, *Proficiency Sheet*, *Added Proficiency*, *Expertise*, *Monk Weapon*, *Integrated Catalog*, *SRD Baseline*, *Compendium*.

## Problem Statement

The Proficiency Sheet is built and merged, but it is not yet something to ship on trust.

A player with an Eberron character can be handed the wrong class: the app looks classes up by name, and the data now has two Artificers. Several proficiencies still come from hand-written tables in the app (class starting tools, race and background skills, Githyanki and Drow weapons, Githyanki armor, the Totem Warrior Tiger grant, the Kensei subclass name), so a book that adds the same kind of rule has to wait for a code change. A class's saving throws, hit die and caster kind come from a name-keyed table, not from the class the player actually picked. The Kensei weapon pool offers only weapons from the app's own simple/martial lists, so a weapon from another book is never offered. A saved proficiency pick can point at a grant that a re-scrape renumbers. A pick stored on an optional feature the player later turns off stays in the data, invisible. On a 320 px phone the character name in the header is cut off.

The developer has the same problem from the other side: tests are not type-checked at all (`checks/` is outside every tsconfig), every subagent brief repeats the same boilerplate, a few guard tests have known blind spots, and `AGENTS.md` does not say where the UI lives.

## Solution

Finish the move to the Catalog. Every proficiency a rule grants is a Proficiency Grant read by the Proficiency Sheet; the hand tables are deleted and the guard says so. A class's base data comes from the Catalog class the character actually holds. The Kensei pool reads weapon categories from the Compendium. Grant ids stop depending on position, and saved picks keep working through the change. Turning off an optional feature releases its stored pick with a notice, as Expertise already does when a book is turned off. The header name fits at 320 px. The tooling gaps close: tests are type-checked with a ratchet, the subagent boilerplate lives in one document and one script, the remaining guards see their blind spots, and `AGENTS.md` points at the UI.

Already done and not part of this spec: catalog format 4, Expertise released when a book is disabled, classes resolved by name and source, Kensei pickers showing held weapons, and the scraper accepting same-named classes from different sources.

## User Stories

1. As a player, I want every tool my class starts with on the card, so that I never check the book to know what I can use.
2. As a player of a class from any book, I want its starting tools to come from the Catalog, so that a new book needs no app change.
3. As a player, I want my race's tools and languages to appear through the same grants as every other source, so that the card cannot disagree with itself.
4. As a player, I want my background's tools, languages and skills to appear through the same grants, so that they are never missed.
5. As a Githyanki or Drow player, I want my racial weapon and armor proficiencies on the card, so that attacks and AC use them.
6. As a Totem Warrior barbarian, I want the Tiger proficiencies to apply once I pick the aspect that grants them and only then, so that the sheet matches the feature.
7. As a Way of the Kensei monk, I want my kensei weapons to be Monk Weapons without the app knowing the subclass by name, so that the rule keeps working if the data renames it.
8. As a player with an Artificer from either source, I want my class's saving throws, hit die and spellcasting to come from the class I actually hold, so that the two Artificers never mix.
9. As a player of a class that exists only in the Integrated Catalog, I want its saving throws, hit die and caster kind read from the Catalog, so that they are right without a hand-written entry.
10. As an SRD-only player, I want the same values from the SRD Baseline, so that the app is correct without the Integrated Catalog.
11. As a player, I want my existing character's saves, hit points and spell slots to be exactly what they were, so that updating the app changes nothing I did not choose.
12. As a Kensei player, I want every simple or martial weapon without the heavy or special property offered, whichever book it comes from, so that I can pick the weapon my table allows.
13. As a Kensei player, I want a weapon's simple or martial category to come from the data, so that no weapon is offered or hidden by an out-of-date list in the app.
14. As a player, I want my saved proficiency picks to survive a catalog re-sync, so that a re-scrape never silently drops a choice.
15. As a player, I want picks saved by an earlier version of the app to keep working after ids change, so that I do not have to choose again.
16. As a player who turns an optional feature off, I want the pick I stored on it released with a notice, so that no invisible choice keeps affecting my sheet.
17. As a player who turns the optional feature back on, I want it to ask for the pick again, so that I decide again knowingly.
18. As a player on a 320 px phone, I want my character's name readable in the header, so that I can tell characters apart.
19. As a player, I want a long name to be shortened with an ellipsis rather than overlap the HP badge, so that the header stays usable.
20. As the developer, I want the hand tables deleted and the readers guard to fail if one returns, so that rules stay in the Catalog.
21. As the developer, I want ADR 0015's Known exceptions list emptied or shortened to what really remains, so that the ADR tells the truth.
22. As the developer, I want a grant id to depend on what the grant is, not on its position in the feature, so that adding or reordering a grant in a re-scrape cannot move a saved pick.
23. As the developer, I want a guard test that fails when a shipped grant id would change or vanish without an alias, so that a data change cannot orphan saves unnoticed.
24. As the developer, I want the scraper to carry each weapon's category, so that nothing in the app hard-codes the simple and martial lists for a rule decision.
25. As the developer, I want the saving-throw characterization baseline re-recorded only through its recorder, with every changed row reviewed, so that behavior changes are deliberate.
26. As the developer, I want the layout check to catch a scroll height written in a style object, so that nested scrolling on Android is not missed.
27. As the developer, I want a guard that the beast browser reads its list through the adopted path, so that the browser cannot drift from the Compendium.
28. As the developer, I want the readers guard to see a namespace import of a guarded table, so that `import * as` is not a way around it.
29. As the developer, I want `checks/` type-checked in `check:all`, so that a type error in a test is caught before commit.
30. As the developer, I want today's type errors in `checks/` recorded and only new ones to fail, so that the check is useful now and the debt can be burned down.
31. As the developer, I want the type-check ratchet to name each new error with file and line, so that fixing it is quick.
32. As the developer, I want the subagent boilerplate (no `--no-verify`, do not touch the data folders, the commit trailer, the worktree setup) in one document, so that a brief says "follow the tiering doc" and nothing more.
33. As the developer, I want a script that sets up a worktree with the right dependency links, so that implementers stop hitting stale bundles and missing modules.
34. As the developer, I want `AGENTS.md` to point at the UI layout (tabs, builder sections, shared UI components, the header), so that I find a screen without a grep tour.
35. As the developer, I want every change in this spec to keep the 320 px layout check green in both catalog modes, so that nothing regresses on small phones.
36. As the developer, I want the catalog format bumped exactly once for the whole release, so that players re-sync once.

## Implementation Decisions

**A. The remaining hand tables become Catalog grants.**
- Class starting tools, race and background tools and languages, race and background skill proficiencies, Githyanki and Drow weapons, Githyanki armor, and the Totem Warrior Tiger grant are expressed as Proficiency Grants in the scraped data (extracted from prose where the extractor can, reviewed overrides where it cannot), and the Proficiency Sheet reads them through the same grant path as every other source.
- The Totem Warrior Tiger grant is gated on the Aspect of the Beast pick through the existing option-feature gate; the gate's data comes from the Catalog, not an app table.
- The Kensei weapon rule is identified by the shape of its grant (a weapon choice on a subclass feature whose pick also marks a Monk Weapon), declared in the data, not by the subclass's name in app code.
- The tables and the class-name tool chain are deleted from the app. The readers guard now forbids importing them anywhere, and its allowlist shrinks accordingly.
- The SRD Baseline is regenerated through the existing prune script in its own commit, and the Integrated Catalog through the enrich step, so the SRD-only app is correct without the Integrated Catalog.
- Behavior for existing characters does not change. The per-source characterization baselines from the Proficiency Sheet work are the proof; any difference is reviewed row by row, never re-recorded by hand.
- ADR 0015's Known exceptions section is updated to list only what remains.

**B. Class base data comes from the Catalog class.**
- Saving throws, hit die, caster kind and spell ability are read from the Catalog class resolved by name and source, with the existing fallback for a saved class that has no source.
- The name-keyed constant tables for these are removed once nothing reads them.
- The saving-throw characterization baseline changes only where the Catalog and the old table genuinely disagree. It is re-recorded through its recorder environment variable, and the diff is reviewed and explained in the ticket.
- Hit points, hit dice, spell slots and spellcasting stay identical for every existing character and class.

**C. Kensei categories from the Compendium.**
- The items scraper carries each weapon's simple or martial category from the source data. The Kensei pool uses that category plus the properties and attack type it already reads.
- The app's standard simple and martial lists stay only where they serve display or the Categorical Weapon Proficiencies grouping, not the Kensei rule.
- A weapon from another book that the category data places in the pool is offered; magic variants are still never taken for their base weapon.
- Items are re-scraped through the scraper, never edited by hand. The catalog format is bumped once, at the end of this spec, if the data changed (see story 36).

**D. Stable grant ids.**
- A grant's id is derived from what the grant is (its category, kind and what it names or picks from), not from its position in the feature, and stays unique within the feature.
- Every id shipped so far remains resolvable: each grant carries its former position-based id as an alias, and loading a character rewrites saved `proficiencyPicks` keys from the alias to the new id once, in the migration step that already exists for saved characters.
- A guard test pins the shipped ids and their aliases for the tracked data, so a data change cannot drop or move one without a deliberate update.
- Overrides keep working; an override's grants get ids by the same rule.

**E. A disabled optional feature releases its pick.**
- When an optional feature is off, the proficiency pick stored for its grant is released through the reconciler, with a review notice, the same way picks are released when a subclass, level or feat goes. Turning the feature on again asks for the pick again.
- The release runs inside the existing reconcile pass order, before Expertise is pruned.

**F. Polish and guards.**
- The header name is shortened with an ellipsis at 320 px so it never overlaps the HP badge, following the layout rules in CODING_STANDARDS §7, and is covered in the layout check.
- The layout check's nested-scroll guard also reads scroll heights set in style objects.
- The beast browser adoption guard is added alongside the other adoption guards.
- The readers guard also flags `import * as` access to a guarded table.

**Retro item 4: type-checking `checks/`.**
- A second tsconfig covers `checks/` (and the type-checkable parts of `scripts/`), `check:all` runs it, and the first run's errors (966 today, mostly possibly-undefined, missing Node types, unknown object properties and argument mismatches in tests built from partial fixtures) are recorded as a baseline of known errors.
- The check fails on any error not in the baseline and prints file and line; errors fixed since the baseline was recorded are dropped from it by the same recorder, and the baseline never grows by hand.
- The cheap, mechanical classes (such as the missing Node types) are fixed outright so the baseline starts as small as possible.

**Retro item 6: subagent boilerplate.**
- `docs/agents/subagent-tiering.md` gains one section with the rules every implementer brief repeats: never skip the pre-commit hook, do not edit the data folders by hand, how to end a commit message, and how to set up a worktree.
- A `scripts/worktree.sh` creates the dependency links a worktree needs (root and scraper `node_modules`) and verifies them, so an implementer runs one command.
- A brief then points at the document instead of restating it.

**Retro item 8: navigation.**
- `AGENTS.md` gains one navigation line for the UI: the character tabs, the builder sections, the shared UI components, the header and the modals, with the folders that hold them.

**Sequencing and format.**
- The catalog format is bumped once, in the last ticket that changes scraped data, not per ticket; it moves from 4 to 5 once, in the release gate.
- The data tickets (A, C) run before B and D, since both read the new data. E, F and the retro items are independent.

## Testing Decisions

- A good test drives the external behavior: what the Proficiency Sheet returns for a character, what the picker offers, what the reconciler leaves behind, what the scraper emits for a feature. It does not assert on private helpers or file layout, except where the point of the test is a guard.
- **Seam for A, B, C:** the Proficiency Sheet characterization tests (the per-source baselines recorded during the Proficiency Sheet work, including saving throws, weapons and armor, skills) plus the scraper's coverage gate and grant-extraction tests. Every move must leave the existing baselines green or change them only through their recorders with a reviewed diff.
- **Seam for D and E:** the `reconcile` seam and the grant-id guard test (`proficiencyGrantIds`); D adds alias coverage, and E adds pick-release cases next to the existing release tests.
- **Seam for F:** the layout check in both catalog modes and the existing guard tests (the readers guard, the beast adoption guards).
- **Seam for the retro items:** `check:all` itself runs the new type check; the worktree script is exercised by running it in a throwaway worktree; the doc and navigation line need no test.
- Prior art: `checks/proficiencySheet*.test.ts`, the characterization tests and their recorder pattern, `checks/proficiencyGrantIds.test.ts`, `checks/proficiencyReadersGuard.test.ts`, `checks/expertiseActiveBooks.test.ts`, the scraper tests under `dnd5eToolsScrap/checks/`.
- New tests use invented class, feature and weapon names and invented sentences; no real rules prose in tests or fixtures.

## Out of Scope

- Derived stat bonuses (Rod of the Pact Keeper, Swashbuckler initiative, Hexblade hex weapon) and class equipment choices: parked specs.
- Fixing the 966 test type errors in one pass: the ratchet records them and they are burned down separately.
- Expertise on tools other than Rogue's Thieves' Tools.
- Cavalier and Samurai either/or grants, the three-skill Skilled feat, and sidekick classes: accepted limits of the Proficiency Sheet.
- Merging to `master` and pushing: a decision for after a device check.

## Further Notes

- Native Android and on-device behavior of the new UI are unverified; the 320 px layout check is the only automated evidence. The release needs a device pass by the product owner.
- Implementation must not edit `src/data/` or `dnd5eToolsScrap/data/` by hand. The sanctioned paths are the prune script, the enrich step and a scraper run for items when ticket C says so.
- Everything is local and unpushed: `spec/proficiency-sheet` carries all the work and `spec/non-srd-options-from-catalog` is its base.
