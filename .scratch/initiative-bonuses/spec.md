# Spec: Initiative Bonuses from the Catalog

**Status:** ready-for-agent
**Tracker:** local markdown (`.scratch/initiative-bonuses/`).
**Related:** ADR 0016 (this decision), ADR 0015 (grants extracted from prose, coverage test), ADR 0014 (non-SRD content comes from the Integrated Catalog), ADR 0013 (SRD Baseline), CODING_STANDARDS §7 (layout). GLOSSARY terms *Initiative Bonus*, *Proficiency Grant*, *Integrated Catalog*, *SRD Baseline*, *Catalog Format*, *Evaluated Character Engine*.

## Problem Statement

A player's initiative on the character sheet is only the Dexterity modifier. A Swashbuckler does not get Rakish Audacity's Charisma modifier, a War Wizard does not get Tactical Wit's Intelligence modifier, a Chronurgist does not get Temporal Awareness, a Gloom Stalker does not get Dread Ambusher's Wisdom modifier, a character with Alert does not get +5, a Harengon does not get Hare-Trigger's proficiency bonus, and an Oath of the Watchers paladin does not get Aura of the Sentinel. A Bard's Jack of All Trades and a Champion's Remarkable Athlete apply to every Dexterity check, initiative included, and neither reaches initiative. The player has to work the number out by hand and cannot tell where the shown number came from.

The developer cannot fix this by writing rule names into the app: every one of the named rules is non-SRD, and a hand-kept list would silently miss the next book.

## Solution

Each rule that adds a number to initiative carries an **Initiative Bonus** in the Catalog, extracted by the scraper from the rule's prose and reviewed once, the same way Proficiency Grants are. A scraper test fails when a feature's prose adds a number to initiative and the feature has neither an Initiative Bonus nor a reviewed mark, so a new book cannot ship with a silent gap. The character sheet shows initiative as the Dexterity modifier plus every Initiative Bonus that applies, plus Jack of All Trades or Remarkable Athlete. Tapping the Initiative box opens a breakdown that lists each part by the name of its source.

## User Stories

1. As a Swashbuckler player, I want my Charisma modifier added to my initiative from 3rd Rogue level, so that the sheet matches Rakish Audacity.
2. As a War Wizard player, I want my Intelligence modifier added to my initiative from 2nd Wizard level, so that the sheet matches Tactical Wit.
3. As a Chronurgy wizard player, I want my Intelligence modifier added to my initiative, so that the sheet matches Temporal Awareness.
4. As a Gloom Stalker player, I want my Wisdom modifier added to my initiative, so that the sheet matches Dread Ambusher.
5. As a player who took the Alert feat, I want +5 on my initiative, so that the feat does what it says.
6. As a Harengon player, I want my proficiency bonus added to my initiative, so that Hare-Trigger works.
7. As an Oath of the Watchers paladin player, I want my proficiency bonus added to my initiative once Aura of the Sentinel is gained, so that the aura's effect on me shows.
8. As a player whose proficiency bonus grows with level, I want a proficiency-bonus Initiative Bonus to grow with it, so that I never update it by hand.
9. As a player whose ability score changes (ASI, feat, item-free score edit), I want an ability-modifier Initiative Bonus to follow the new modifier, so that the sheet stays right.
10. As a Swashbuckler with a negative Charisma modifier, I want Rakish Audacity to add nothing rather than lower my initiative, so that an optional bonus never hurts me.
11. As a multiclass Swashbuckler / War Wizard with Alert, I want every one of those bonuses added together, so that the sheet reflects every rule I hold.
12. As a player, I want a rule to add its bonus once, even if it appears to reach me in two ways, so that nothing is double-counted.
13. As a player below the level of a subclass feature, I want its Initiative Bonus absent, so that the sheet shows only what I have.
14. As a player who changes subclass, I want the old subclass's Initiative Bonus to disappear and the new one's to appear, so that the sheet follows my choices.
15. As a player whose ancestry trait is replaced (a variant or a lineage that drops the trait), I want that trait's Initiative Bonus gone with it, so that only traits I hold count.
16. As a player who switches off an optional feature, I want its Initiative Bonus gone, so that switched-off rules do nothing.
17. As a Bard of 2nd level or higher, I want half my proficiency bonus (rounded down) added to initiative, so that Jack of All Trades applies to this Dexterity check.
18. As a Champion of 7th level or higher, I want half my proficiency bonus (rounded up) added to initiative, so that Remarkable Athlete applies to this Dexterity check.
19. As a Champion, I want Remarkable Athlete's half proficiency bonus (rounded up) on Athletics, Acrobatics, Sleight of Hand and Stealth when I am not proficient in them, so that the skills list matches the feature.
20. As a Bard / Champion multiclass, I want only the higher of Jack of All Trades and Remarkable Athlete on any check, so that two half-proficiency rules do not stack.
21. As a player, I want the Initiative box to keep showing a single total, so that the sheet stays uncluttered.
22. As a player, I want to tap the Initiative box and see a breakdown, so that I know where my initiative comes from.
23. As a player reading the breakdown, I want one line per part, named after its source (Dexterity, Rakish Audacity, Alert, Jack of All Trades), with its value and the total, so that I can check it against my books.
24. As a player on a narrow phone, I want the breakdown modal to fit the screen at every supported width, so that I can read it anywhere.
25. As a player on the SRD Baseline only, I want initiative to work as before with Jack of All Trades and Remarkable Athlete, so that nothing breaks without an Integrated Catalog.
26. As a player with a stale Integrated Catalog, I want to be asked to re-sync, so that the Initiative Bonuses arrive.
27. As a player with a feature that gives advantage on initiative, I want its text to keep telling me, so that I know to roll with advantage (the sheet does not model it).
28. As a developer, I want the scraper to extract an Initiative Bonus from each "adds a number to initiative" sentence, so that the app names no rule.
29. As a developer, I want a reviewed override for any such sentence the extractor cannot read, so that unusual wording is still covered.
30. As a developer, I want a scraper test that fails on an "adds a number to initiative" sentence with neither an Initiative Bonus nor a reviewed mark, so that a new book is reviewed before it ships.
31. As a developer, I want the test to ignore advantage, "shares your initiative count" and "when you roll initiative" sentences, so that the review list holds only real gaps.
32. As a developer, I want a stale reviewed mark or override (naming no feature, or a feature that has a bonus) to fail the test, so that marks cannot hide gaps.
33. As a developer, I want `check:live` to confirm the named rules carry the expected bonus in the catalog the in-app sync builds, so that the extractor is proven against real data.

## Implementation Decisions

- **Initiative Bonus shape** (type-only, shared by the scraper models and the app catalog types, beside the Proficiency Grant types): `{ kind: "ability"; ability: AbilityKey } | { kind: "proficiency" } | { kind: "flat"; value: number }`. It is its own optional field on a class feature, subclass feature, feat and ancestry trait, beside `grants`. It has no id: there is no pick to save. A rule carries at most one.
- **Extraction** lives in the scraper's parser beside the proficiency-grant extractor and runs wherever features are built: the scraper CLI, the tracked-data enrichment tooling and the in-app sync. The vocabulary matches only sentences that add a number to initiative ("a bonus to your initiative rolls equal to your <Ability> modifier", "add your <Ability> modifier / proficiency bonus to your initiative rolls", "a +N bonus to initiative", "a bonus to initiative equal to your proficiency bonus"). Sentences about advantage, sharing an initiative count, or triggering on rolling initiative are not matched.
- **Overrides and reviewed marks** live in the scraper's override area, in their own list for Initiative Bonuses, keyed by owner, feature and level like the proficiency overrides. An override or mark that names no feature, or a mark on a feature that has a bonus, throws.
- **Race traits**: the race scraper writes the bonus on the trait (Hare-Trigger), not on the race record, so a replaced trait drops it.
- **Catalog Format** rises from 7 to 8, so a cached catalog without Initiative Bonuses is stale and Settings asks for a re-sync. The SRD Baseline carries no Initiative Bonus (no SRD rule adds a number to initiative); if regenerating it changes bytes, that is its own commit through the prune script.
- **App reading**: `grantedFeatures` carries the feature's Initiative Bonus on each feature instance, as it carries `grants`. Level gating, subclass, replaced traits and switched-off optional features therefore apply unchanged. No rule name appears in app code for Initiative Bonuses.
- **Evaluated Character Engine**: `initiative` stays a number (the total). A new `initiativeBreakdown` is a list of `{ label, value }` parts: Dexterity first, then each Initiative Bonus labelled with its feature's name, then Jack of All Trades or Remarkable Athlete when one applies. An ability-modifier bonus is `max(0, modifier)`. Bonuses are deduplicated by feature instance id.
- **Jack of All Trades and Remarkable Athlete** are SRD rules and stay in code, matched the way Jack of All Trades already is (class and level; Remarkable Athlete is Champion level 7). Jack of All Trades is half the proficiency bonus rounded down, Remarkable Athlete rounded up; when both apply only the higher counts, on initiative and on skills. Remarkable Athlete reaches non-proficient Strength, Dexterity and Constitution skills.
- **UI**: the Initiative box on the Stats tab keeps its single total and becomes tappable; tapping opens a breakdown modal built on the shared Modal shell, listing each part's label and signed value and the total. Copy is mechanics only (no explanatory notes).

## Testing Decisions

- Tests check external behaviour: the evaluated initiative and breakdown, the extracted bonus for a sentence, the coverage gaps over data, the rendered layout. They do not assert on private helpers.
- **Evaluated Character Engine** is the main seam. Characters from `makeChar()` are evaluated against a small test catalog whose features carry Initiative Bonuses, so no non-SRD text enters the repo. Cases: each kind; level gating; subclass change; replaced trait; switched-off optional feature; negative modifier counts 0; stacking across classes and a feat; one rule counted once; Jack of All Trades, Remarkable Athlete, and both together; the breakdown's labels and order. Prior art: the evaluation tests and the proficiency sheet tests with their fixtures.
- **Skills**: Remarkable Athlete on non-proficient STR/DEX/CON skills and the higher-of rule with Jack of All Trades, beside the existing Jack of All Trades skill test.
- **Scraper extractor**: sentence-level tests for each kind and for sentences that must not match. Prior art: the proficiency-grant parser tests.
- **Coverage**: a test over the tracked data fails on uncovered sentences and on stale marks or overrides. Prior art: the proficiency coverage test and the enrichment test.
- **`check:live`**: Rakish Audacity, Tactical Wit, Temporal Awareness, Dread Ambusher, Alert, Hare-Trigger and Aura of the Sentinel carry the expected bonus; a Swashbuckler 3 with DEX 14 and CHA 16 evaluates to initiative +5.
- **Layout**: a `layout:check` scenario opens the breakdown modal at the four widths.
- Verification per AGENTS.md: `npm run check:all`, `npm run check:live`, and `npm run layout:check` for the UI ticket.

## Out of Scope

- Advantage and disadvantage on initiative: the feature text tells the player.
- Magic items (Scorpion Armor, Shield of the Silver Dragon, Weapons of Warning and others): their bonuses depend on equipped and attuned state; a later spec.
- Bonuses that cost or trigger (the Ambush maneuver, Spindle of Fate, Vigilant Blessing) and bonuses that reach only allies (Avatar of Battle).
- Remarkable Athlete's running long jump distance.
- Jack of All Trades and Remarkable Athlete on ability checks other than initiative and skills (raw ability checks and tool checks are not shown on the sheet).

## Further Notes

- Every sentence in the current tracked data that mentions initiative was reviewed during design; none that adds a number falls outside the planned vocabulary.
- Jack of All Trades on skills already exists; only its reach to initiative is new.
