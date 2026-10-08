# Declarative Rule Choices: Half-Elf variants, Eladrin seasons, Aasimar revelations

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/declarative-rule-choices/`). GitHub publishing is unavailable — the `gh` CLI is not installed on this machine and installing it requires sudo.
**Related:** ADR 0003 (declarative Rule Choices in scraped race data), GLOSSARY terms *Rule Choice*, *Ancestral Variant*, *Season*, *Revelation*

## Problem Statement

Three ancestry options that 5e.tools already models cannot be made on a character at all.

A **Variant Half-Elf** gets no choice whatsoever. Selecting one of the four SCAG descents (Aquatic, Drow, Moon/Sun, Wood) records the subrace, but the subrace's entire content — a trait called *Variant Feature (Choose 1)* listing Skill Versatility plus the descent's own feature — arrives as a single markdown blob. Nothing in the app reads it. Worse, the app is looking for a trait literally named *Skill Versatility* on the subrace, and SCAG variants don't have one, so **a Variant Half-Elf has no skill proficiencies of any kind**. The player sees no way to take Skill Versatility and no way to take Swim, Drow Magic, Fleet of Foot, or the Moon/Sun Elf options. The choice the rules explicitly offer is simply absent from the sheet.

An **Eladrin** has no **Season**. The MToF version offers Autumn, Winter, Spring, and Summer, each adding a distinct extra effect to Fey Step at 3rd level, and — uniquely among these three — lets the player change season whenever they finish a long rest. The Season exists in the source data only as an italic instruction line and a nested list. Two subraces both named *Eladrin* exist (DMG and MToF, different Fey Step text), and the app matches subrace by name without source, so the two collide.

An **MPMM Aasimar** cannot pick its **Revelation**. Celestial Revelation's three options — Necrotic Shroud, Radiant Consumption, Radiant Soul — live in a markdown bullet list inside the trait description, with the 3rd-level requirement expressed only as prose. The character sheet shows the trait and none of its options.

Underneath all three is a structural cause worth naming: the scraper flattens 5e.tools' structured `inset` and `list` nodes into single description strings at the point where traits are built, so the shape that would drive all three rules never reaches the app. And the app's existing answer to special cases is a hardcoded name set — which is why the variant check matches **1 of 13** variant subraces (it tests for the exact string `"Variant"`, while the other twelve are named `Variant; <X>`), so tiefling variants, human's Variant Human siblings, and half-orc variants are all missed too.

## Solution

Introduce one domain concept — a **Rule Choice**: a selection from a fixed set of options granted by a single rule, of which exactly one takes effect. Declare Rule Choices declaratively in the scraped race data, nested on the trait that grants them, and render them with the app's existing generic choice picker.

All three gaps then fall out of one mechanism. The aasimar revelation hangs off *Celestial Revelation*; the half-elf descent options hang off *Variant Feature (Choose 1)*; the eladrin Season hangs off *Fey Step*. Same code path, three rules, no per-rule special cases.

Two supporting changes come with it. The scraper normalises the `Variant; ` naming convention away, so "variant" becomes a flag rather than a string to pattern-match — which fixes the tiefling, human, and half-orc variants that the current check misses. And selections are recorded on the character in the same shape the codebase already uses for skill and class choices, so a saved character carries its choices through migration like everything else.

The scraper is the source of truth, not a one-off data edit: the change lands in the scraper and its model types together, so deleting the data and re-running the scrape reproduces it.

## User Stories

1. As a player building a Variant Half-Elf with the Drow descent, I want to choose one feature from that descent's offered set, so that my character reflects the variant rule instead of silently getting nothing.
2. As a player building a Variant Half-Elf, I want Skill Versatility to be one of the options I can choose, so that I am not forced into a descent feature I did not want.
3. As a player who chooses Skill Versatility as a variant Half-Elf's feature, I want the normal two-skill picker to appear, so that I gain the proficiencies the rules grant me.
4. As a player who chooses a descent feature such as Swim or Drow Magic, I want that feature's text to appear on my sheet, so that I know what my character can do.
5. As a player who chooses a descent feature, I want Skill Versatility **absent** from my sheet, so that my sheet does not show a feature the variant replaced.
6. As a player building a Variant Half-Elf, I want to be able to change my choice without rebuilding the character from scratch, so that I can correct a misclick.
7. As a player who selects an Aquatic descent Half-Elf, I want to see the subrace listed by its descent name rather than as "Variant; Aquatic Elf Descent", so that the sheet is readable.
8. As a player browsing tiefling variants, I want them to be recognised as variants, so that their features behave correctly rather than being silently mis-handled.
9. As a player browsing human variants, I want Variant Human and its Mark siblings to behave consistently, so that the human ancestry works the way the rules describe.
10. As a player browsing half-orc variants, I want Mark of Finding to be recognised, so that it is not mistaken for a plain half-orc.
11. As a player selecting an Eladrin, I want to choose a Season, so that my Fey Step gains the effect my season grants.
12. As a player selecting an Eladrin, I want to see all four Seasons offered — Autumn, Winter, Spring, and Summer — so that I can weigh them.
13. As a player selecting an Eladrin, I want to see what each Season's extra effect does before choosing, so that I choose knowingly.
14. As a player whose Eladrin is below 3rd level, I want my chosen Season recorded but its extra effect withheld, so that my sheet does not show an effect I have not earned.
15. As a player who reaches 3rd level with an Eladrin, I want my Season's extra effect to appear on my sheet, so that I can use it.
16. As a player with an Eladrin, I want to change my Season when I finish a long rest, so that the sheet reflects the rule allowing seasonal change.
17. As a player taking a long rest on a character with no Eladrin, I want nothing to change, so that rest has no unexpected effects.
18. As a player taking a short rest on a character with an Eladrin, I want my Season preserved, so that only long rest offers a change.
19. As a player with an MPMM Aasimar, I want to choose a Revelation at 3rd level, so that my transformation has the effect I chose.
20. As a player with an MPMM Aasimar, I want to see all three Revelations — Necrotic Shroud, Radiant Consumption, Radiant Soul — offered, so that I can weigh them.
21. As a player with an MPMM Aasimar, I want to see each Revelation's effect before choosing, so that I choose knowingly.
22. As an Aasimar player below 3rd level, I want the Revelation choice absent from my sheet, so that I am not shown a choice I cannot yet make.
23. As an Aasimar player who reaches 3rd level, I want the Revelation choice to appear, so that I can make it.
24. As an Aasimar player, I want my chosen Revelation's effect shown alongside the Celestial Revelation trait, so that I can see both the rule and my selection.
25. As a player who has chosen a Revelation, I want to change it, so that I am not locked into a misclick.
26. As a player with a DMG or VGM Aasimar, I want them to behave as they do today, so that this change does not alter unrelated ancestry content.
27. As a player with an existing saved character, I want my character to load without error after this change, so that upgrading the app does not lose my work.
28. As a player with an existing Variant Half-Elf who never had a choice available, I want to be told that my character needs review, so that I know to go and pick a feature.
29. As a player with an existing character that has no choices at all, I want nothing to be flagged, so that review notices stay meaningful.
30. As a player who has made choices, I want them to survive saving and reloading, so that my sheet is stable.
31. As a player who has made choices, I want them to survive changing my background or class, so that unrelated edits do not clear them.
32. As a player who changes my ancestry, I want my previous ancestry's choices cleared, so that stale choices do not apply to a different ancestry.
33. As a player who uses the app with books other than MPMM, I want ancestry choices to appear only when their source book is active, so that I am not offered content from a book I excluded.
34. As a player, I want a choice I have not yet made to be visibly incomplete, so that I know my character is unfinished.
35. As a player, I want the choice's option text readable without leaving the sheet, so that I can compare options.
36. As a player, I want to inspect any option's full rules text, so that nothing is truncated into ambiguity.
37. As a player making a choice on a narrow screen, I want the option chips to wrap rather than run off the edge, so that every option is reachable.
38. As a player making a choice, I want a counter showing how many options I still must pick, so that I know when I am done.
39. As a player who has picked my option, I want to be able to unpick and repick while I still owe picks, so that I can change my mind.
40. As a player who has completed my pick, I want the remaining options locked rather than silently accepted, so that I cannot accidentally take two.
41. As a player whose choice has a level requirement, I want the requirement shown when I am eligible, so that I understand why it appeared.
42. As a developer running the scraper, I want the scrape to emit choice data so that deleting the data and re-running it reproduces the feature, so that the data never becomes an unreproducible hand-edit.
43. As a developer running the scraper, I want the choice's unlock level to come from a curated table rather than prose parsing, so that a source reformatting cannot silently change when a choice unlocks.
44. As a developer, I want a test that fails when a scraped choice has no curated level, so that an unmapped choice is caught rather than shipped broken.
45. As a developer, I want the scraper's emitted choice data to be asserted against a fixture, so that a refactor cannot quietly drop it.
46. As a developer adding a fourth Rule Choice later, I want to need only data changes, so that I do not write another special case.
47. As a player, I want the sheet's Features tab to show my chosen options under the feature that grants them, so that the sheet reads coherently.
48. As a player, I want a replaced feature genuinely suppressed rather than shown alongside its replacement, so that my sheet does not grant two contradictory features.

## Implementation Decisions

**Declarative Rule Choices in scraped data.** A trait gains an optional `choices` field: `{ pick: number, options: Array<{ name, description }>, level: number }`. The choice lives *on the trait that grants it* rather than at race or subrace level, because in the source data the options live inside that trait's `entries`. This is what lets the aasimar revelation and the half-elf descent options share one code path.

**Scraper and data change together.** The scraper's race and subrace trait-building steps are where the structured `inset` and `list` nodes are currently flattened into one description string. Choices are lifted out at that point, and the model types gain the field. Re-running the scrape regenerates the data; no data file is hand-edited to deliver this feature.

**Curated level table, not parsed prose.** "When you reach 3rd level" exists in the source only as an English sentence inside a description. A choice's `level` therefore comes from a hand-maintained override table keyed by source, race, subrace, and trait — deliberately curated, sitting alongside the scraper output. A test asserts that every scraped choice has a level in that table, so an unmapped choice fails the build instead of silently unlocking at 1st level.

**Selected options stored as an entry array.** The character gains an optional `ruleChoices` array of entries `{ id, origin, choose, from, picked }`. This deliberately mirrors the existing `SkillChoiceEntry` and `ClassChoice` shapes rather than introducing a `Record<string, string>` — the codebase already has two precedents for the array form, and it accommodates `pick > 1` without a second field.

**Choice identity includes source, first.** The entry `id` is built as `source__race__subraceSource__trait`. Source leads because DMG and MToF both ship a subrace named *Eladrin* with different Fey Step text; matching on name alone is precisely how they collide today. Ancestry selection already records subrace source, and every consumer of a choice must key on the full id.

**Subrace name normalisation in the scraper.** The `Variant; ` prefix is a 5e.tools naming convention, not a rules term. The scraper strips it and sets a boolean variant flag on the subrace. This retires the four existing exact-string `Variant` comparisons — which currently match only 1 of 13 variant subraces, missing every tiefling, human, and half-orc variant — and it means the picker labels a subrace by its descent ("Drow Descent") instead of printing a rules-irrelevant prefix. The one entry literally named `Variant` (Human's Variant Human) becomes the flag too, so all thirteen are handled identically.

**Choose in the builder, read on the sheet.** The existing generic choice picker is reused verbatim — no new component. It is already used for race languages, race tools, background choices, and class choices, and already renders a "n/choose" counter, a wrapping chip grid, and lock icons for auto-granted options. Choices are presented in the ancestry section of the builder alongside the other ancestry picks. On the Features tab, the chosen option's text appears under the feature that granted it, and where the source data marks an overwrite, the replaced feature is suppressed.

**Replace versus annotate comes from the data.** Half-elf variants carry an overwrite marker naming Skill Versatility, so that trait is suppressed once a different option is chosen. The aasimar revelation annotates Celestial Revelation, which continues to show its own prose with the chosen Revelation beneath. This distinction is read from the scraped data, not hardcoded per race.

**Level-gated choices are hidden, not locked.** Below the choice's level the picker is absent entirely. The player learns the choice exists by reaching the level, rather than meeting a disabled control.

**Migration back-fills and flags.** The character migration defaults the new field to an empty list. A character whose recorded ancestry carries a Rule Choice it has no recorded pick for is flagged through the existing review mechanism — the same mechanism already used for ambiguous legacy skill choices — because a Variant Half-Elf saved before this change has no Skill Versatility recorded at all and would otherwise look complete while missing a racial feature. Characters with no choices are not flagged.

**ASI logic is untouched.** Choice-ASI determination and the existing per-ancestry ASI sets stay exactly as they are. This change is confined to skill choices and feature display.

**Book filtering applies.** Choices are offered only when their source book is active, matching how the rest of the ancestry content is filtered.

**Rest integration is minimal and additive.** Long rest makes a changeable choice re-promptable rather than auto-changing it, and short rest leaves choices untouched. The rest application is where this lives, since that is where the existing short/long rest rules already live.

## Testing Decisions

**A good test asserts externally observable behaviour only.** No test reaches into internal state to verify that a helper ran. The question a test asks is "given this character, what does the sheet show?" — which lands on the highest existing seam in the codebase and keeps these tests resilient to refactoring the rules layer.

**The primary seam is the resolved feature list.** `grantedFeatures(character, catalog)` already returns everything the Features tab renders, and the existing rules test suite already drives it against the real shipped race data. This single seam covers the bulk of the spec: an Eladrin's Fey Step shows its chosen Season's effect; an MPMM Aasimar shows its chosen Revelation; a Variant Half-Elf shows its chosen descent feature **and does not show Skill Versatility** when a different feature was chosen; an under-leveled character shows neither the Revelation choice nor the Season effect. Prefer this seam for every display assertion rather than introducing component-level tests.

**The second seam is the racial skill-choice resolver.** `getRacialSkillChoices(...)` is the function whose exact-name lookup currently causes the half-elf bug. A Variant Half-Elf selecting Skill Versatility must yield a two-skill choice; a Variant Half-Elf selecting a descent feature must yield none. Both directions matter, since the current failure is an absence.

**The third seam is character migration.** Assert that a character record without the new field migrates without error, that a Variant Half-Elf with no recorded choice is flagged for review, and that a character with no ancestry choices is not flagged.

**One new seam at the scraper boundary.** Nothing tests the scraper today, and without a seam there the "re-running the scrape reproduces this" decision is unverifiable. Add a focused test over the choice-extraction logic against a fixture reproducing the three shapes — a variant feature inset, a revelation list, and an Eladrin Season list — asserting that names, option counts, and option descriptions survive extraction. Separately, assert that every choice present in the shipped race data has a curated level, which is the guard that keeps the curated table honest.

**The choice picker itself is not unit tested.** It is an existing, already-trusted presentation component; testing it would assert implementation detail. Its behaviour is covered indirectly through the resolved-character seams above.

**Prior art.** The rules test suite already establishes the pattern this spec follows: table-driven assertions over real shipped catalog data, using the shared character factory for arrangement. Follow it rather than introducing a new style. Run the existing suite plus lint to confirm no regression in ancestry, skill, and rest behaviour.

## Out of Scope

- **The DMG Aasimar's 1st-level kind** (Celestial, Asiatic, Deepborn). The kind determines the ancestry's ability score increases, and the scraped data hardcodes the Celestial values — correct for one of three kinds. Out of scope; the spec covers the MPMM Revelation only.
- **Ability score increase logic for variants.** Deliberately untouched.
- **Any change to the DMG or VGM Aasimar.**
- **The out-of-bounds layout defects** in the settings screen (title-and-badge rows that do not wrap, and a floating button overlapping a list row). Already covered by the mobile responsiveness work and handled as a separate implementation pass.
- **Rest as a tracked event.** Long rest offers a season change; it does not record when rests happened, and no other feature gains rest-awareness from this.
- **Re-publishing or migrating the existing local ticket sets** to the configured GitHub tracker.
- **Any other 5e.tools construct that flattens the same way** — this spec fixes the three reported rules, not the general flattening problem across all scraped categories.

## Further Notes

The `gh` CLI is not installed on this machine and installing it requires elevated privileges, so this spec is published as a local markdown file rather than as a GitHub issue. `docs/agents/issue-tracker.md` records GitHub as the tracker. Either install `gh` and re-publish, or switch the configured tracker to local markdown so the recorded configuration matches reality — worth settling before implementation so blocking edges land in one place.

`docs/agents/`, `GLOSSARY.md`, and `docs/adr/` are currently untracked in git. ADR 0003 records the reasoning behind the decisions above and should be committed with them.