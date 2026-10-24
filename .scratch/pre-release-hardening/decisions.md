# Pre-release hardening: decisions

Source for `/to-spec`. The product owner decided each item below one by one. An item is built only where it says "built" and names the ticket that built it.

## Done

- **Catalog format 5** (release gate, ticket 17). One bump for the whole release. Forces one re-sync of every cached Integrated Catalog: a format 4 cache loses the class, race, background, skill, weapon, armor and Tiger grants, and resolves no grant ids, until it is re-synced.
- **Catalog format 4** (merged, `af6e772`). The previous release's format.
- **Kensei weapon pickers show held weapons** (merged). A kensei weapon is also a Monk Weapon, so held weapons stay offered.
- **Artificer duplicate subject** (merged). Same-named classes from different sources no longer collide in grant resolution.
- **Classes resolve by name and source** (merged). Base saves, hit die, caster kind and spell ability come from the held Catalog class (B, ticket 14).

## Also done

- **Expertise follows active books** (merged, `a62aefd`). Decision: disabling a book removes an Expertise mark that only that book's skill backed, with a review notice. Re-enabling the book does not bring the mark back. Only Expertise is scoped; stored proficiency picks stay.
- **Choice grant ids are keyed by kind, not pool** (ticket 20, owner decision before the release gate). A choice's id does not change when its pool or count changes. The ids that named the pool stay as aliases.

## To spec (all chosen for this release)

A. **Move the remaining hand tables to Catalog grants.** Built by tickets 08 (class starting tools), 09 (race and background tools and languages), 10 (race and background skills), 11 (racial weapons and armor) and 12 (Totem Tiger, Kensei subclass name). The app tables and the class-name tool chain are deleted, and the readers guard fails if one returns. ADR 0015's Known exceptions now lists only `MULTICLASS_PROFICIENCIES` (see Deferred).

B. **Class base data from the Catalog.** Built by ticket 14. Saves, hit die, caster kind and spell ability come from the Catalog class by name and source. The saving-throw baseline was re-recorded through its recorder, and its allowlist is empty. HP, hit dice, spell slots and spellcasting are identical across 3,810 old-vs-new cases.

C. **Kensei categories from the Compendium.** Built by ticket 07. The items scraper carries each weapon's simple or martial category, and the Kensei pool reads it.

D. **Stable grant ids.** Built by tickets 15 and 20. A grant's id is derived from what it is, not its position. Each shipped id stays resolvable as an alias, and saved picks move to the new id on reconcile. `checks/fixtures/proficiencyGrantIds.json` pins every shipped id and alias.

E. **Disabled optional feature releases its pick.** Built by ticket 16. Turning an optional feature off releases its stored pick through the reconciler, with a notice. Turning it on asks for the pick again.

F. **Polish and guards.** Built by tickets 03 (the header name shortens with an ellipsis at 320 px), 04 (the nested-scroll guard reads heights in style objects), 05 (the Wild Shape adoption guard) and 06 (the readers guard flags `import * as` access to a guarded table).

## Skill choices and Expertise (owner bug report, tickets 33 to 35)

- **Multiclass skill choice** (ticket 33). A later class's "choose a skill" multiclass grant (Rogue, Ranger, Bard) is a Proficiency Choice read from the class record, offered in the Class card and stored with the other picks.
- **Expertise follows the skill grant** (ticket 34). A skill grant whose feature doubles the proficiency bonus carries an `expertise` mark in the catalog (catalog format 7). The skills picked are the skills with Expertise; the Knowledge Cleric's separate Expertise picker is removed, and the same data rule covers Scout's Survivalist and Royal Envoy. Owner decision: all such features, not Blessings of Knowledge alone.
- **Skill choices shown together** (ticket 35). The Class tab shows the starting, multiclass and subclass skill choices in one "Skills" card, each named by its source.

## Retro items (now in the spec)

- 4: type-check `checks/` with a second tsconfig, ratcheted against a recorded baseline. Built by ticket 02. The baseline holds 322 known errors at the release. Burn-down is separate.
- 6: subagent boilerplate in `docs/agents/subagent-tiering.md` (section "Implementer Rules") plus `scripts/worktree.sh`. Built by ticket 01.
- 8: one UI navigation line in `AGENTS.md`. Built by ticket 01.

## Deferred (not in this release)

- **Race and background skill picks as Proficiency Choices** (ticket 18, needs-triage). The text-parse offers and the `skillChoices` / `chosenSkills` path for race and background stay until then.
- **Multiclass proficiencies read from the Catalog class** (ticket 19, needs-triage). `MULTICLASS_PROFICIENCIES` stays.

## Not decided

- **Device and Android verification** is the product owner's task.
- **Merge to `master` and push**: not before the above and the device check.

## Out of scope

Derived-stat bonuses (Rod of the Pact Keeper, Swashbuckler initiative, Hexblade hex weapon) and class equipment choices stay parked. Expertise on tools other than Rogue's Thieves' Tools, the Cavalier and Samurai either/or grants, the three-skill Skilled feat and sidekick classes are accepted limits of the Proficiency Sheet.
