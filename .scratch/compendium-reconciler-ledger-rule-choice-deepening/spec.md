# Spec: Deepen the Compendium, Character Reconciler, Spellbook Ledger and Rule Choice modules

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/compendium-reconciler-ledger-rule-choice-deepening/`).
**Related:** ADR 0003 (declarative Rule Choices), ADR 0013 (SRD Baseline & IndexedDB integration), CODING_STANDARDS §2, §3, §4, §6. GLOSSARY terms *Compendium*, *Spell Owner*, *Spellbook Ledger*, *Rule Choice*, *Character Reconciler*, *SRD Baseline*, *Integrated Catalog*, *Dataset Swapping*, *Sourcebook Gating*.

## Problem Statement

The rules engine is correct in most places, but four concepts are smeared across many modules, so a change to one of them means editing many files and bugs hide between them.

- **Catalog access** is a module-level mutable store with nine near-identical get/find groups. Seven rules modules read it directly, so supposedly pure rules depend on hidden state. Tabs assemble catalogs by hand in different ways, there are two competing `CharacterCatalogs` shapes, and the Dual-Mode (SRD vs integrated) tests have to mutate a global.
- **Teardown** is promised to be a single-pass Character Reconciler, but several call sites bypass it, several transitions (removing an origin feat, replacing an ASI or feat, clearing a background) never reconcile, builder components inline multi-field transitions that cannot be tested without the component, and subclass teardown decides what to delete by substring-matching names and ids.
- **Known and prepared spell identity** is a string key rebuilt by hand in about ten places across the spells tab, the rules and migration. The rule that is tested for toggling a prepared spell is dead code; the tab runs its own divergent version. Forgetting a spell for one class can unprepare the same spell for another class, and the Giant Barbarian's owner key is derived differently in the tab than in the rules.
- **Subclass and class Rule Choices** are a 300-line hand-written conditional chain keyed on name substrings, with picks routed by testing the choice id for substrings, while ancestry Rule Choices are already declarative. A second import cycle was expected from where the pick-recording function lives; on inspection no such cycle exists (see Rule Choice below).

For the player, this shows up as stale or wrongly-removed choices after changing build decisions, and for maintainers as slow, risky changes.

## Solution

Deepen four modules, each behind one small interface that callers and tests share, and migrate callers to them.

1. A **Compendium**: one synchronous, read-only view over the active catalog (SRD Baseline or Integrated Catalog), built from plain collections, with scoped listings and unscoped lookups.
2. A **Character Reconciler** module that is the single seam every state-changing builder transition ends in, with the existing passes as its internals and the component-inlined transitions moved into the rules layer.
3. A **Spellbook Ledger** that owns learning, forgetting and preparing spells, spell identity, and the gating rules, driven by an explicit **Spell Owner**.
4. A **Rule Choice** module with one availability and pick interface over ancestry choices, a declarative table of class and subclass choices, and the existing specialised choice modules as dynamic sources.

Players see the same app, except that several multiclass and teardown bugs are fixed (see Further Notes).

## User Stories

1. As a player, I want removing a feat that granted a choice (such as Fighting Initiate or Martial Adept) to remove the dependent picks, so that my sheet never shows options I no longer qualify for.
2. As a player, I want replacing an Ability Score Improvement or feat selection to prune choices that depended on the old selection, so that stale styles, maneuvers or invocations disappear.
3. As a player, I want clearing my background to remove the choices and grants that depended on it, so that my character stays consistent.
4. As a player, I want a descriptive notice in the character's review list whenever something is automatically removed, so that I understand what changed and why.
5. As a player, I want changing my subclass to clear the old subclass's choices, counters, swaps and granted spells, so that I do not carry features from a subclass I no longer have.
6. As a player, I want removing a class level or the whole class to clean up everything that depended on those levels (skill picks, invocations, infusions, arcanum, rituals), so that de-leveling is safe.
7. As a player, I want changing my race to clear race-origin choices and skill picks, so that the new race starts clean.
8. As a multiclass player, I want to prepare the same spell separately under two classes, so that each class's preparation list is independent.
9. As a multiclass player, I want forgetting a spell for one class to leave the same spell prepared and known under my other class, so that I do not lose spells by accident.
10. As a player, I want a spell I try to learn or prepare that is not on my class's list (or not allowed by my active books) to be rejected without changing my character, so that illegal builds are not possible.
11. As a player, I want always-prepared subclass spells to be impossible to toggle and never counted against my preparation limit, so that the budget stays correct.
12. As a player, I want the prepared-spell counter to keep warning me when I exceed my limit rather than blocking me, so that behaviour is unchanged from today.
13. As a Path of the Giant Barbarian, I want my Giant Power cantrip and its owner to be consistent everywhere, so that the cantrip appears, prepares and forgets correctly.
14. As a Warlock, I want Pact of the Tome cantrips, Book of Ancient Secrets rituals and Mystic Arcanum to stay in sync after any change that affects them, so that they never go stale.
15. As a player who loaded an older cached catalog, I want any missing collection (such as conditions) to fall back to the SRD data, so that the app keeps working.
16. As a player with an Integrated Catalog, I want lists to respect my active books while a character's existing picks from a now-disabled book still display, so that disabling a book warns me instead of breaking the sheet.
17. As a player, I want Rule Choices from ancestry, class and subclass to appear and be picked through the same experience, so that choosing is consistent.
18. As a player, I want a Circle of the Land biome, Divine Soul affinity, Genie kind, Elemental Discipline, Totem tier or Giant Power pick that I already made to survive this refactor unchanged, so that saved characters are not damaged.
19. As a player with saved characters, I want every persisted choice id to keep working, so that I need no migration.
20. As a player, I want Elk and Tiger totem options to appear only when their book is active, so that book gating is respected.
21. As a player, I want a domain cantrip choice (Nature, Death, Arcana) to offer the right spell-list cantrips from the active catalog, so that options are correct in both SRD and integrated modes.
22. As a player, I want a Rule Choice id that no table recognises to be left alone, so that data from newer versions is never silently deleted.
23. As a maintainer, I want to add a new subclass Rule Choice by adding one table row, so that I do not touch availability, pick and teardown code separately.
24. As a maintainer, I want to change how spell keys are formatted in exactly one module, so that I never grep for string templates.
25. As a maintainer, I want to add a new teardown pass in one place and have every transition get it, so that I cannot forget a call site.
26. As a maintainer, I want rules modules to receive a Compendium rather than read a global, so that I can test them with small in-memory catalogs.
27. As a maintainer, I want Dual-Mode tests to construct an SRD Compendium and an integrated Compendium side by side, so that neither mode's tests depend on test ordering.
28. As a maintainer, I want one catalog-bundle shape, so that there is no ambiguity about which `CharacterCatalogs` a function takes.
29. As a maintainer, I want the dead spell-toggle rule and the dead evaluation delegates removed, so that the codebase does not suggest behaviour the app does not use.
30. As a maintainer, I want components to call pure transitions instead of assembling multi-field state changes, so that those transitions are testable without a component.
31. As a maintainer, I want the module dependency graph to have no cycle between the choice modules, the transitions and the Reconciler, so that module loading is predictable.
32. As an agent working in this repo, I want glossary terms (Compendium, Spell Owner, Spellbook Ledger, Rule Choice, Character Reconciler) to match the code, so that I can navigate by domain language.
33. As a maintainer, I want a test that snapshots every shipped Rule Choice id, so that accidentally renaming a persisted id fails the build.
34. As a maintainer, I want idempotency tested at the Reconciler interface, so that running it twice never changes a valid character.
35. As a maintainer, I want the specialised choice modules (fighting styles, maneuvers, Warlock, Artificer) to remain intact behind the new interface, so that this work does not rewrite working code.

## Implementation Decisions

**Compendium**
- A concrete value, not a TypeScript interface with adapter classes. It is built from a collections bundle; the SRD Baseline is just another bundle, and the integrated bundle is what storage already produces.
- Listings are scoped by active books when the Compendium is scoped (`for(activeBooks)`). Lookups by name are not scoped, so existing character picks always resolve.
- Per-collection fallback to the SRD data is kept for collections missing from an integrated catalog. The clauses that can never match (SRD records inside an already-stripped integrated set) are dropped.
- The module owns the process-wide default through a current-Compendium accessor plus `integrate` and `revertToSrd`, replacing the existing set/clear/init store functions. The character context and the scraper runner call these; the context keeps its own `isIntegrated` state.
- Rules modules take an optional Compendium parameter that defaults to the current one during migration. Done means no rules module imports the old singleton helpers; UI, context and test helpers may still use the default. Removing the default is a follow-up.
- A single catalog-bundle type replaces the two `CharacterCatalogs` interfaces. Evaluation and ancestry functions take a Compendium. The evaluation adapter and its seven unused delegates are removed, and its one live caller is inlined.
- Storage stays untouched and synchronous lookups are preserved, as required by ADR 0013.

**Character Reconciler**
- Its own module, importing the choice modules directly, which breaks the cycle with the rule-choice module. Its interface is `reconcile(character, compendium)`.
- The eight existing passes (fighting styles, maneuvers, invocations, Mystic Arcanum, infusions, Tome cantrips, Ancient Secrets rituals, expertise) become internal passes in one explicit order with the Warlock ordering dependency documented. Nested pass calls inside individual passes are removed.
- Every state-changing transition in the rules layer ends in the Reconciler. The transitions that currently do not (remove origin feat, replace an ASI or feat selection, clear background) are fixed. The context's generic update does not reconcile on every write.
- Component-inlined transitions move into the rules layer as pure transitions that end in the Reconciler: remove class level (including skill-choice pruning), change subclass (including unlearning orphaned spells), change race, clear background.
- The existing subclass-teardown heuristics move into the Reconciler unchanged in this spec; the Rule Choice module later replaces them with owner-based derivation (below).
- Passes keep appending descriptive review notices to the character when they remove something.

**Spellbook Ledger**
- Gains learn spell, forget spell, toggle prepared, is-known and is-prepared, alongside the existing slot, pact, sorcery, arcanum and ritual operations.
- The stored format is unchanged: prepared spells remain `name`-`source`-`owner` keys with legacy two-part keys still accepted; known spells keep their shape. No data migration.
- One matching rule everywhere: a prepared entry matches the canonical key or the legacy key exactly. Forgetting a spell for one Spell Owner removes only that owner's prepared entry.
- Gating moves in: class-list and active-book availability (including the Fighter and Rogue mapping to the Wizard list) and the always-prepared guard. A rejected transition returns the character unchanged. Transitions take a Compendium.
- The class spell profile carries its Spell Owner key, derived once (including the Giant Barbarian owner). The tab and the Ledger read it instead of rebuilding it.
- Transitions end in the Reconciler. The prepared limit stays a soft warning.
- The dead toggle rule and the tab's duplicate prepared-check and known-check code are removed; the tab renders and delegates.

**Rule Choice module**
- One availability and one pick interface over two sources: ancestry choices (scraped trait data) and class/subclass choices. The pick-recording function (`setRuleChoicePick`) stays in `choices/types.ts`: the specialised modules use it, and moving it into this module would make them import the Reconciler. No cycle exists today, and `checks/rulesImportCycles.test.ts` keeps it that way. The `origin` field already distinguishes sources. UI callers (class progression, ASI/feat section, rest dialog, ancestry engine, builder tab) use the one interface.
- Class and subclass choices that are currently a hand-written conditional chain become table rows with: a frozen id, source book, owner (class and optional subclass), trait name, availability level, effect level, choose count, and options. Options are a static list (with optional per-option book requirement) or a named resolver for compendium-derived options (domain cantrips) and state-derived options (Primal Knowledge's unchosen skills).
- The four specialised modules (fighting styles, maneuvers, Warlock, Artificer) are not rewritten; they plug in as dynamic sources behind the same interface.
- The default pick records the choice then reconciles. Id-substring dispatch is removed because the derived-state syncs are Reconciler passes; the Giant Power known-spell sync becomes a Reconciler pass. Fighting style and Artificer infusion keep a specialised pick.
- Choice ids are a frozen contract. Each row's owner lets the Reconciler remove choices by id lookup instead of name matching. Ids no table recognises are never pruned. Book gating uses an explicit source field, not the id prefix. No data migration.
- Row contents are moved as-is: no new content is added.

**Glossary** (already updated): *Compendium*, *Spell Owner*, *Spellbook Ledger* (widened), *Rule Choice* (origins, persisted id).

## Testing Decisions

- A good test drives the module's interface with a character (and Compendium) and asserts the observable result: the returned character, what is offered, what is rejected. It does not assert which internal pass ran, how a key string is built, or component structure.
- **Seams (four, all already exist as test files):**
  1. Compendium: constructed from small in-memory collections. Cover scoped listings versus unscoped lookups, dataset swap, per-collection SRD fallback, and that SRD records are absent after swap.
  2. Reconciler and builder transitions: cover idempotency on a valid character; each loss case (feat, pact boon, level, subclass, class, race, background, ASI replacement) prunes dependents and records a review notice; lower-tier choices are kept and higher-tier absent below unlock levels.
  3. Spellbook Ledger: gating rejection (foreign class list, inactive book, level-gated, always-prepared), the same spell prepared under two owners, forgetting under one owner, legacy-key spells counted as prepared, the Giant Barbarian owner, and SRD plus integrated modes.
  4. Rule Choice: availability and picks for every table row, book-gated options, resolver-derived options, picks across ancestry and class sources, an id snapshot guard, and unknown ids left untouched.
- Per CODING_STANDARDS §4, each suite includes negative cases and the Dual-Mode SRD versus integrated check.
- Existing tests that call the individual passes, the old toggle rule, or the data-service store directly are migrated to these interfaces.
- Prior art: the existing builder-transition, character-spells, rule-choice, SRD-baseline-integrity, integration-lifecycle and compendium-storage tests; the shared character fixture builder; the glossary-consistency test.
- Done = the project verification command passes (tests, typecheck, lint).

## Out of Scope

- **Non-SRD option text.** Hand-written option descriptions for non-SRD subclass content (for example Totem Warrior, Four Elements, Divine Soul, Genie) are moved as-is. Removing them from source is scraper work, to be done later: extend the scraper (in the style of ADR 0003) so the non-SRD data fetched from the 5e.tools repo produces class and subclass Rule Choice definitions that the Compendium consumes. The table's option field is shaped so catalog-derived options can replace inline ones.
- Removing the default singleton from UI, context and test helpers.
- Hard enforcement of the prepared-spell limit.
- Changing the stored format of known or prepared spells.
- Rewriting the specialised fighting style, maneuver, Warlock and Artificer modules.
- Reconciling on every character write.
- Splitting the large tab components beyond what delegation to the Ledger and the extracted transitions requires.
- Any new gameplay content.

## Further Notes

- **Build order and dependencies:** Compendium, then Reconciler, then Spellbook Ledger, then Rule Choice. The Reconciler needs the Compendium as its parameter; the Ledger needs both; the Rule Choice module needs the Reconciler passes and the Compendium. Suggested one ticket per module, with the dependency edges above.
- **Intentional behaviour changes** (call out in PR descriptions): forgetting a spell no longer unprepares the same spell for another class; the Giant Barbarian owner is consistent; removing an origin feat, replacing an ASI or feat, and clearing a background now prune dependent choices.
- Candidate "delete the pass-through evaluation delegates" from the architecture review is folded into the Compendium work.
- The cycle between the choice modules, the transitions and the Reconciler should be gone by the end; a quick import-graph check is worthwhile.
- Consistent with ADR 0003 and ADR 0013; no ADR is contradicted. An ADR recording "Compendium is a value built from collections, not an interface with adapters" is optional.
