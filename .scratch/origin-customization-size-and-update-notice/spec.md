# Spec: Update Notice, Size Choice and Origin Customization

**Status:** done
**Tracker:** local markdown (`.scratch/origin-customization-size-and-update-notice/`).
**Related:** ADR 0003, 0013, 0014, 0015, CODING_STANDARDS §7 and §8. GLOSSARY terms *Origin Customization*, *Origin Swap*, *Size Choice*, *Catalog Format*, *Integrated Catalog*, *Proficiency Choice*, *Proficiency Sheet*, *Rule Choice*.

## Problem

1. After the app is updated (a new APK, a new web deployment) nothing tells a user with an Integrated Catalog that the update may have changed catalog data and that a re-sync in Settings is advisable.
2. Some races list more than one size (Small or Medium). The app always shows the first listed size and offers no choice.
3. A player who enabled Tasha's Cauldron of Everything cannot use its Customizing Your Origin rule: moving a race's ability score increases, replacing its languages, and replacing its skill, tool, weapon and armor proficiencies. The rule's proficiency table is a non-SRD table, so it must reach the app through the Catalog, not through code.

## Decisions (verbatim)

The user's answers, each with the question it answered. Questions are numbered as asked in the interview.

- Q1 (what "nothing hard-coded" means for the update stamp): "nothing hard-coded refers to not putting non-srd content in code (this should be stated in docs), for things like in quetions you can do what best practice tells."
- Q2 (how the web build and Android are released): "Web build is deployed by command eas deploy. But previously we have to export to make dist version."
- Q3 (what the update modal does): "yes"
- Q4 (where the chosen size lives): "yes"
- Q5 (does size change rules): "as you said"
- Q6 (what Customizing Your Origin covers): "no, customizing background is already implemented and it's not part of this rule, third part is swapping proficiency in skill/tool/weapon/armor. You can avoid hardcoding by parsing table from .../data/variantrules.json adress (analyze scraper to see what i mean)"
- Q7 (where the option lives and what gates it): "no, i think it's against rule about hard-coding non-srd content. When TCE is active, origin can be customized, cannot be otherwise, thats it."
- Q8 (races whose ability scores are already flexible): "First of all half-elf case is half-true because we can swap bonus to charisma. In cases of races that picker is not native, but added by this rule, default option should be already chosen. Also as a exception from all other builder choices, this choice should be hidden by default."
- Q9 (rule tables the catalog does not carry): "custom background is srd rule so it can be documented. I think languages can be solved similar to 'default' ASI: hidden by default choice with already chosen defaults."
- Added with Q1 to Q9: "Important notice: make sure that we swapping skills/languages/tools/weapons/armor only from races, not from background/class/subclass."
- Q10 (which races can be customized): "exclude standard human because swap is not possible in case when every ability score gets bonus."
- Q11 (ability swaps stored and applied): "yes"
- Q12 (cap of 20 at pick time): "yes"
- Q13 (swapped proficiencies and languages as Proficiency Choices): "yes"
- Q14 (race grants that are already choices): "solution with separation of any/narrower choices is good"
- Q15 (classifying armor and weapon grants): "yes"
- Q16 (where the parsed swap table lives in the Catalog): "yes"
- Q17 (UI placement and hiding): "yes, but number of active swaps is unneceserry"
- Q18 (invalid swaps): "yes"
- Q19 (update identification): "for now i only ship apks, this will change in the future but not now"
- Q20 (Standard Human keeps the language swap): "yes"
- Q21 (swapping the picked value of narrower choices): "yes"
- Q22 (one build stamp for both platforms): "yes"
- Q23 (does the stamp change on a data-only update): "yeah comparing catalog format is better"
- Q24 (Heavy-weapon marker for Small characters): "by single size you mean medium? yes"
- Q25 (glossary names): "yes"
- Q26 (work split): "you're getting ahead of yourself first of all you should /to-spec"
- Approval of the spec checkpoint: "i approve it"

Reconciliation recorded at the checkpoint: Q22 (a build stamp) and Q23 (compare the catalog format instead) disagree. The notice follows Q23 and drops the stamp. "Single size" in Q24 means any race that lists one size, not Medium: a character whose resolved size is Small gets the marker, whether the size was chosen or is the race's only size.

## Acceptance Criteria

### Update notice

**AC-1: Notice shown after an update**
**Given** an Integrated Catalog saved below `REQUIRED_CATALOG_FORMAT` (or with no format) and the user not yet informed of the required format
**When** the app opens
**Then** a modal says the app was updated and suggests syncing the catalog in Settings, with "Open Settings" and "Later". It carries no changelog and no explanatory text.

**AC-2: Notice withheld**
**Given** the SRD Baseline only, or a current Integrated Catalog, or a required format the user has already been informed of
**When** the app opens
**Then** no modal appears.

**AC-3: Notice dismissed**
**Given** the modal is showing
**When** the user taps "Open Settings" or "Later"
**Then** the informed format is saved, "Open Settings" navigates to Settings, and the modal does not return until `REQUIRED_CATALOG_FORMAT` is raised again. Settings keeps showing its own re-sync hint.

### Size Choice

**AC-4: Size offered**
**Given** a held race or lineage whose record lists two or more sizes
**When** the Ancestry section shows
**Then** it offers exactly those sizes, read from the record, with the first selected until the player picks. A race listing one size offers no choice.

**AC-5: Size shown and released**
**Given** a size picked
**When** the character is viewed
**Then** the Ancestry banner and the character header show it. **When** the race changes to one that does not list the picked size, **then** the pick is released and the first listed size applies.

**AC-6: Small and Heavy weapons**
**Given** a character whose resolved size is Small (picked, or the only size its race lists)
**When** an attack with a Heavy-property weapon is shown
**Then** it carries a disadvantage marker with a short label and no explanation. A Medium character and a character with no race show none.

**AC-7: SRD Baseline**
**Given** the SRD Baseline
**When** the races are listed
**Then** no size picker appears and nothing regresses.

### Origin Customization

**AC-8: Swap table in the Catalog**
**Given** the Customizing Your Origin record of `data/variantrules.json`
**When** the scraper (the CLI and the in-app sync) runs
**Then** it emits an `originRules` Catalog collection holding the Proficiency Swaps table as structured rows (what is replaced, what may replace it), with no prose. The scrape fails when the record or the table is missing or a cell is not recognized. The Catalog format becomes 12, and a catalog saved below it is stale.

**AC-9: Card availability**
**Given** TCE in the active books, an `originRules` collection, and a held race or subrace
**When** the Ancestry section shows
**Then** a "Customize origin" card appears, collapsed, with every swap at its default. The ability rows appear only for a race or subrace with an ability score increase; language and proficiency rows appear for any race that has them. Without TCE, without `originRules`, or without a held race, or when no row applies, the card is absent. The card shows no count of active swaps.

**AC-10: Ability swaps**
**Given** the open card
**When** the player moves an increase to another score
**Then** the increase keeps the amount the race gives it, effective ability scores show the move, and a Half-Elf's fixed increase is movable beside its two chosen +1s. All of the race's increases must land on different scores, and a score is blocked as a target when its base plus the increase would exceed 20. A race whose increases already cover all six scores (Standard Human) has no ability section. No amount and no race name is written in code.

**AC-11: Ability swap lifecycle**
**Given** saved ability swaps
**When** TCE is turned off
**Then** they are kept and not applied. **When** the race changes, **then** they are released with a notice. A swap equal to its default is not stored.

**AC-12: Language swaps**
**Given** the open card on a customizable race (Standard Human included)
**When** the player replaces a fixed race language
**Then** the Proficiency Sheet holds the replacement and not the original. Replacements come from the SRD languages the character does not already hold. A choice over an "any" pool offers no swap.

**AC-13: Language swap lifecycle**
**Given** saved language swaps
**When** TCE is turned off, the race changes, a replacement is also granted by another source, or a swap equals its default
**Then** the swap is kept and ignored, released with a notice, dropped with a notice, or not stored, respectively.

**AC-14: Proficiency swaps**
**Given** the open card
**When** the player replaces a fixed skill, tool, weapon or armor grant of the race or subrace, or the pick of a choice with a narrower pool (such as one of three tools)
**Then** the replacement is limited to what the table row for that proficiency allows, and the Proficiency Sheet holds it instead of the original. Weapons are classified simple or martial through the Compendium items, and a grant the Compendium cannot classify offers no swap. A choice over an "any" pool offers no swap.

**AC-15: Race only**
**Given** a background, class, subclass or feat that grants the same name as a swapped race grant
**When** the swap is made
**Then** that grant is untouched and no swap is offered on it.

**AC-16: Proficiency swap lifecycle and reset**
**Given** saved proficiency swaps
**When** TCE is turned off, the race changes, a replacement is also granted by another source, or a swap equals its default
**Then** the swap is kept and ignored, released with a notice, dropped with a notice, or not stored, respectively. **When** the player taps "Reset", **then** every swap on the card (ability, language and proficiency) returns to its default.

## Architecture Constraints

- No non-SRD content in `src/` (AGENTS.md, ADR 0014). The swap table reaches the app only as Catalog data. The language pool is the SRD list in `constants/languages.ts`. Tests and fixtures use invented names and table text, never real rules prose.
- The Proficiency Sheet stays the only reader of race proficiency fields (ADR 0015). Swaps are Proficiency Choices on Race and Subrace features, saved under `proficiencyPicks`, and `checks/proficiencyReadersGuard.test.ts` passes unchanged. Only Race and Subrace features are ever swapped.
- No per-character on/off flag. Availability derives from TCE being active, `originRules` being present and the held race. Ability swaps are a new optional `Character` field. All saved swaps are kept when unavailable and applied only while available.
- The new Catalog collection is `originRules`. `REQUIRED_CATALOG_FORMAT` goes to 12 with its comment, and the in-app sync gains an 11th step. The SRD baseline is not regenerated except through `scripts/prune-to-srd.mjs`.
- The update notice adds one optional field to `AppSettings` (the format the user was last informed of) and no build stamp, `app.config` or native module. Older saved settings load unchanged.
- `CollapsibleCard` gains a `defaultExpanded` prop whose default keeps the current open behavior.
- Size Choice is a plain optional `Character` field, not a Rule Choice. Its options come from the race record.
- Dual-mode invariant (CODING_STANDARDS): every ancestry change is verified on the SRD Baseline and on the Integrated Catalog. Saved sources are never rewritten.
- UI copy carries only essential mechanics (CODING_STANDARDS §8). Layout rules are in §7.

## Verification Map

| Criterion | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1, AC-2, AC-3 | the notice decision function and the settings round trip | `node --test checks/`: stale, current, SRD and already-informed cases; saved settings from an older save load. Browser check with a seeded stale catalog (`docs/agents/driving-the-app.md`) |
| AC-4, AC-5, AC-7 | `resolveAncestryState`, the race-change transition | unit tests in both modes: multi-size, single-size and SRD races; release on race change. `npm run layout:check` for the banner and header |
| AC-6 | the weapon attack builder | unit tests: Small with a Heavy weapon, a fixed-Small race, Medium, no race |
| AC-8 | the races-and-rules scraper on a fixture, and the live catalog | `npm --prefix dnd5eToolsScrap test` (including the fail-on-missing and unrecognized-cell cases); `npm run check:live` finds the real table |
| AC-9 | the Ancestry section | unit test of the availability function; `npm run layout:check` in both modes shows the card collapsed |
| AC-10, AC-11 | effective ability scores and the swap transition | unit tests: duplicate targets, the cap, Half-Elf, an all-six race, TCE off, race change |
| AC-12, AC-13 | `proficiencySheet` and the reconciler | unit tests incl. Standard Human, "any" choices, conflicts; reconcile is idempotent |
| AC-14, AC-15 | `proficiencySheet` | unit tests per table row, narrower choice, unclassifiable weapon, same name in a background; `checks/proficiencyReadersGuard.test.ts` |
| AC-16 | `proficiencySheet`, reconciler, the card | unit tests; browser check of "Reset" |

## Out of Scope

Custom Lineage changes, the background part of the rule, the personality part of the rule and DM-added languages, size effects other than the Heavy-weapon marker, a changelog in the update modal, a build stamp, OTA updates and iOS.

## Open Risks

- The table-cell parser could break if the source rewords a cell. `check:live` catches it. Owner: main session, at review.
- A data-only update that does not raise the Catalog format shows no notice. Revisit if that proves too quiet.
- Swapping the picked value of a narrower choice widens its pool to the table's allowed set. If review finds a rule the table does not state, the main session decides.
