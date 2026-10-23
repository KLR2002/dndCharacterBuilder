# Spec: Proficiency Sheet, grants from the Catalog

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/proficiency-sheet/`).
**Related:** ADR 0015 (this decision), ADR 0014 (non-SRD content comes from the Integrated Catalog), ADR 0013 (SRD Baseline), ADR 0008 (expertise and grouped proficiencies), CODING_STANDARDS §1, §3, §4, §7, §8. GLOSSARY terms *Proficiency Grant*, *Proficiency Sheet*, *Added Proficiency*, *Expertise*, *Categorical Weapon Proficiencies*, *Monk Weapon*, *Rule Choice*, *Integrated Catalog*, *SRD Baseline*, *Compendium*.

## Problem Statement

A player cannot trust the character card to show everything the character is proficient in. Tool, language and saving-throw proficiencies come from hand-written per-source code, and only race, background and the first class contribute. Subclass features and feats grant nothing. Concretely: Way of the Kensei's calligrapher's-or-painter's-supplies choice is missing, Diamond Soul gives no saving-throw proficiency, and the Resilient feat does not either. Expertise cannot be placed on proficiencies that came from the background. A character who learns a language or tool during downtime has no way to record it. Weapon proficiencies and Monk Weapons chosen through a feature (the Kensei's weapons, gained at 3rd, 6th, 11th and 17th level) do not exist.

The developer cannot fix this by checking rules one at a time. The Catalog carries subclass feature rules as prose only, and nothing says which of them still grant something the app ignores.

## Solution

One **Proficiency Sheet** answers "what is this character proficient in" for skills, tools, languages, weapons, armor and saving throws. It is derived on every read from the character and the Catalog. Each rule's **Proficiency Grants** are structured data in the Catalog, extracted by the scraper from the prose and reviewed once. A scraper test fails whenever a feature's prose mentions a proficiency grant that nobody has covered or explicitly marked "grants nothing", so a new book cannot ship with silent gaps. The player sees every proficiency on the card, can add tools and languages by hand, and can make the choices a rule offers (Kensei's brush, Kensei weapons) in the same place as other class choices.

## User Stories

1. As a player, I want every tool my character is proficient in listed on the card, so that I never have to check the rules to know what I can use.
2. As a player, I want every language my character knows listed on the card, so that I know what they can speak and read.
3. As a player with a Way of the Kensei monk, I want to choose calligrapher's supplies or painter's supplies when I take the subclass, so that the tool proficiency the subclass promises is on my sheet.
4. As a player with a Way of the Kensei monk, I want to choose a melee and a ranged weapon type as kensei weapons at 3rd level, so that I gain proficiency with them and they count as Monk Weapons.
5. As a player with a Way of the Kensei monk, I want to choose another kensei weapon at 6th, 11th and 17th level, so that my character keeps pace with the class.
6. As a Kensei player, I want the weapon pool to exclude heavy and special weapons and include the longbow, so that I cannot pick an illegal weapon.
7. As a player with Diamond Soul, I want proficiency in all saving throws applied, so that my saving-throw bonuses are correct.
8. As a player who took a feat that grants a saving-throw proficiency, I want that proficiency applied, so that the sheet matches the feat.
9. As a player, I want class and subclass features that grant a tool, language, skill, weapon, armor or saving-throw proficiency to apply as soon as I reach their level, so that the sheet is right at every level.
10. As a player, I want feats that grant proficiencies to apply on the sheet, so that taking a feat is reflected immediately.
11. As a player, I want a proficiency to disappear when the class, subclass, background, feat or level that grants it no longer applies, so that the sheet never shows something I no longer have.
12. As a player, I want rule-granted proficiencies to be impossible to remove by hand, so that I cannot accidentally delete something the rules give me.
13. As a player, I want to add a tool to my character by hand, so that I can record one learned during downtime.
14. As a player, I want to add a language to my character by hand, so that I can record one learned during downtime.
15. As a player, I want to type a custom tool or language name, so that I can record something not in the known lists.
16. As a player, I want to remove a tool or language I added, so that I can fix a mistake.
17. As a player, I want hand-added entries to carry a small "added" mark, so that I can tell them from rule-granted ones.
18. As a player, I want the picker for hand-added entries to hide what my character already has, so that I cannot add duplicates.
19. As a player who added a tool by hand and later gained it from a rule, I want it shown once as rule-granted, so that the sheet has no duplicate.
20. As a player in that situation, I want my hand-added entry to come back if the rule source goes away, so that I do not lose what I recorded.
21. As a player, I want to place Expertise on a tool I added by hand, so that downtime training can matter for Expertise.
22. As a player, I want to place Expertise on skill and tool proficiencies that come from my background, so that I can use all the proficiencies my character really has.
23. As a player, I want an Expertise pick to be released from its feature when the proficiency behind it disappears, so that the feature shows fewer picks used and I can choose again.
24. As a player, I want the decision to mark a returned proficiency as Expertise to be mine, so that nothing changes silently.
25. As a player, I want each new proficiency choice to appear as "Picked 0 / N" in the Class & Subclass Choices card, so that I notice it needs a decision.
26. As a player, I want unmade choices not to block anything, so that I can finish them later.
27. As a player, I want pickers to hide proficiencies I already have, so that a pick is never wasted on a duplicate.
28. As a player, I want a fixed grant that duplicates something I already have to be kept once, so that the sheet stays tidy without extra steps.
29. As a player, I want existing characters to show the same proficiencies as before, plus anything newly granted, so that updating the app does not break my sheet.
30. As a player, I want my saved picks kept when the catalog changes or is missing, so that I never lose a choice.
31. As an SRD-only player, I want the SRD classes, subclasses and feats to grant their proficiencies without the Integrated Catalog (for example the Life Domain's heavy armor), so that the baseline app is correct on its own.
32. As a player with the Integrated Catalog, I want non-SRD proficiencies to come from my catalog, so that what I see matches the books I loaded.
33. As a player, I want the card to show only the proficiencies themselves, the "added" mark and the remove control, so that the screen carries no explanatory notes.
34. As a player on a 320 px phone, I want the new "+" buttons, the picker and the added rows to fit without clipping, so that nothing is unreachable.
35. As the developer, I want a scraper test that fails when a feature's prose mentions a proficiency, language, tool or saving-throw grant and the feature is neither covered nor marked "reviewed, grants nothing", so that new books cannot ship with silent gaps.
36. As the developer, I want the scraper to extract clear sentences into structured grants automatically, so that I do not hand-write every one.
37. As the developer, I want a reviewed override file for sentences the extractor cannot parse, so that every real grant can be expressed.
38. As the developer, I want grant ids that never change once shipped and a guard test for them, so that saved picks never point at a renamed grant.
39. As the developer, I want a characterization test per slice, so that moving a reader to the sheet cannot change what existing characters show.
40. As the developer, I want one Proficiency Sheet function that every reader uses, so that the card, Expertise and attacks cannot disagree.
41. As the developer, I want the stale-catalog gate to force a re-sync after the catalog format changes, so that an old cached catalog cannot silently lack grants.
42. As the developer, I want the SRD baseline regenerated through the existing prune script in its own commit, so that the only change in `src/data/` is the added grants.

## Implementation Decisions

- **Grants are data on the Catalog's features.** Each class feature, subclass feature and feat can carry Proficiency Grants for six categories: skills, tools, languages, weapons, armor and saving throws. A grant is either fixed (a list of names) or a Proficiency Choice (a count plus a pool, where a pool can be a list of names or a rule such as "any simple or martial weapon without the heavy or special property, plus the longbow"). A grant has a stable id built from source, owner, feature name and position. Ids never change once shipped, like Rule Choice ids.
- **Race and background grants.** They already have structured fields. The Proficiency Sheet reads them through the same grant shape so there is one path, replacing the current separate readers.
- **Class base proficiencies.** The class-name if-chain for tools moves into the same shape, read from the class data the Catalog already carries, with the existing Multiclass proficiency table kept for additional classes.
- **Scraper extraction.** The scraper converts clear sentences ("You gain proficiency with…", "your choice of A or B", "you learn N languages of your choice", "Bonus Proficiency/Proficiencies") into grants. A reviewed override file in the scraper handles sentences it cannot parse. The override file holds names only, no rule prose. The catalog format number increases and the stale-catalog gate forces a re-sync.
- **Coverage gate.** A scraper test scans every feature (class, subclass, feat) for proficiency vocabulary (proficiency in skills, tools, weapons, armor or saving throws, and language learning). A match with neither a grant nor an explicit "reviewed, grants nothing" mark fails the test. Saving-throw proficiency is in scope.
- **The Proficiency Sheet.** One derived function returns, for the six categories, every entry the character has: rule-granted entries (from race, background, class levels, subclass features, feats, multiclass proficiencies) and Added Proficiencies. It is never stored. It reads a Compendium (Baseline or Integrated). It deduplicates, and applies the existing Categorical Weapon Proficiencies grouping.
- **Added Proficiencies.** Stored on the character as two optional lists, one for tools and one for languages. Free text is accepted. They are shown once, as rule-granted, if a rule also grants the same entry, and reappear when the rule goes away. No migration is needed because the fields are optional.
- **Saved choice picks.** A new optional store keyed by grant id holds the picks. The existing race, background and class buckets are still read and never rewritten, as with infusion picks. Picks survive a missing catalog.
- **Reconciler.** The existing reconcile seam releases Expertise picks whose proficiency is no longer on the sheet (the existing pruning of invalid Expertise, now reading the sheet), and releases grant picks whose grant no longer applies, each with a notice. Nothing re-marks Expertise automatically when a proficiency returns.
- **Expertise options** read the sheet, so background-granted proficiencies and Added tools are eligible. Skills are read from the sheet in the last slice; Expertise on skills keeps working through the current path until then.
- **Pending choices.** Unmade Proficiency Choices appear in the Class & Subclass Choices card as "Picked 0 / N", the same as other choices, and block nothing. Kensei weapon choices get a new pending entry at levels 3, 6, 11 and 17.
- **Kensei weapons.** A Proficiency Choice with a rule-based pool read from the Compendium's weapon properties. A chosen weapon adds weapon proficiency to the sheet and makes that weapon a Monk Weapon. It is the second user of the choice mechanism and ships after the mechanism exists.
- **Character card.** A "+" on the Tool Proficiencies and Languages headings opens the shared modal: the known list minus what is already held, plus a custom-name field. Added entries carry a small "added" mark and an "×". Rule-granted entries have neither. No source labels and no explanatory text (CODING_STANDARDS §8).
- **Slices.** (1) tools and languages: grant shape in the Catalog, extractor, coverage gate, sheet for those categories, Added Proficiencies, the Kensei brush choice. (2) saving throws (Diamond Soul, feats) and Expertise on background-granted proficiencies. (3) weapons and armor, and the Kensei weapons. (4) skills. Each slice starts with a characterization test.
- **SRD baseline.** Regenerated once through the existing prune script as its own commit, with a check that the only difference in `src/data/` is the added grants field. Hand edits to `src/data/` stay forbidden.
- **UI.** All new rows follow CODING_STANDARDS §7: fluid, wrapping, no fixed widths.

## Testing Decisions

- **A good test** drives external behavior: given a character and a Compendium, what the sheet lists; given a scraped feature, what grant results. No test asserts on internal helpers or on rendering.
- **Seam 1: the Proficiency Sheet function** over `makeChar()` and the catalog fixture. Covers each grant kind, level gating, removal when a source goes away, duplicates, Added Proficiencies, precedence when a rule grants the same entry, and Categorical Weapon Proficiencies.
- **Seam 2: `reconcile()`.** Covers releasing Expertise and grant picks with a notice, idempotence, and that nothing is re-marked when a proficiency returns.
- **Seam 3: the scraper tests.** Covers the extractor on invented sentences (no real 5e prose in fixtures), the coverage gate against the tracked scraped data, and the grant-id guard.
- **Characterization per slice.** The recorder pattern used for the subclass choice baseline: record what existing characters show, prove it unchanged, and never hand-edit the baseline.
- **UI** is covered by `npm run layout:check`, with seed characters that show the new rows.
- **Prior art:** the subclass pointer table guards and recorder, the stale-catalog gate tests, the existing expertise and reconciler tests, and the `choiceCatalogFixture` helpers.

## Out of Scope

- Derived-stat bonuses: Rod of the Pact Keeper spell bonuses, Swashbuckler initiative, the Hexblade hex weapon marker (a separate spec).
- Class equipment choices (a separate spec).
- Manual add for skills, weapons or armor. Only tools and languages can be added by hand.
- Proficiency source labels on the card.
- Automatic replacement picks for duplicate fixed grants.
- Re-marking Expertise automatically.
- The three UI bugs, the Giant barbarian cantrip bug and full heal on level up. They are separate quick changes tracked outside this spec.

## Further Notes

- The quick changes ship first and independently: the ASI/feat row overlap and the Half-Elf language heading overlap (with a `layout:check` seed that shows them), the Giant barbarian cantrip duplication, and the "Full heal at level up" setting (default on; sets current HP to the new maximum, clears death saves, leaves temp HP and hit dice alone).
- Sentences that mention proficiency without granting any (for example a feature that only refers to a proficiency you already have) are marked "reviewed, grants nothing". The one-time review of the roughly 80 candidate class and subclass features is done by the main session with a Sonnet reviewer, and only ambiguous items go to the user.
- Fixtures use invented wording, never real 5e prose.
