# Spec: Race Ability Increase Choices and Subrace Replacement

**Status:** ready-for-human

## Problem

A race or subrace record states its ability increases as Fixed Increases plus an optional Increase Choice, and a subrace can replace its race's increases. The scraper keeps only the fixed numbers and the app always adds race and subrace together. Players see wrong scores:

- A SCAG Tiefling variant (Devil's Tongue, Hellfire, Infernal Legacy, Winged) gets INT +2 and CHA +2. It should get INT +1 and +2 to DEX or CHA.
- An MTF Tiefling (Dispater, Fierna, Glasya, Levistus, Zariel) gets CHA +4 plus the PHB Tiefling's INT +1.
- The EGW Dragonborn (Draconblood, Ravenite) and the replacing Half-Elf marks stack on their race.
- Changeling, Warforged, Simic Hybrid, Aetherborn and the Human dragonmarks (Handling, Making, Passage) lose their choice.

The app compensates by knowing Half-Elf, Variant Human and Custom Lineage by name. The player needs every ancestry to give exactly what its record says, with choices offered as choices. See ADR 0019 and GLOSSARY (*Fixed Increase*, *Increase Choice*, *Flexible Increases*, *Origin Swap*).

## Decisions (verbatim)

- Scope ("What scope should the fix cover?"): "All affected races (Recommended)"
- Process ("How should #4 be built?"): "Grill → spec → tickets (Recommended)"
- Q1 Catalog shape: "a" (fixed increases stay in `abilityScoreIncrease`; add `abilityScoreChoices: {from, count, amount}[]`; subrace flag `replacesRaceAbilityScores: true` from `overwrite.ability`; the app combines)
- Q2 Pools under Origin Customization: "ASI like two +1 or mpmm three +1 are not allowed to go to same ability score!"
- Q3 Invalid saved picks released with a notice: "yes"
- Q4 No notice for scores corrected by data: "as you said"
- Q5 Open choice shown by the picker, no auto-pick: "yes"
- Q6 Flexible Increases only when neither fixed nor choice: "yes"
- Q7 ADR 0019: "yes"
- Q8 Each pick carries its choice id; legacy picks go to the first fitting choice, else released: "yes"
- Q9 Picker lists all six whenever Origin Customization is available: "yes"
- Q10 One picker row per choice, today's copy, allowed scores only: "yes"
- Q11 A pick may not take a score above 20: "yes"
- Q12 Race card summary shows choices (`INT +1, +2 DEX or CHA`; `CHA +2, +1 to 2 others`): "yes"
- Q13 Same branch `fix/nov-2026-bugs`, Catalog Format bump folded into 14: "as you said"
- Q14 Stale catalog: picker hidden, picks kept and applied as stored, nothing released: "yes"

## Acceptance Criteria

### Scraper

### AC-1: A choice is copied from the record
**Given** a raw race record whose ability entry holds fixed scores and a `choose` block
**When** the races scrape runs
**Then** `abilityScoreIncrease` holds only the fixed scores, and `abilityScoreChoices` holds one entry `{from, count, amount}`, where `count` and `amount` default to 1 when the block omits them.

### AC-2: A replacing subrace is marked
**Given** a raw subrace record with `overwrite.ability`, and another without it
**When** the races scrape runs
**Then** the first subrace carries `replacesRaceAbilityScores: true` and the second carries no such field. Neither subrace's increases are merged with its race's.

### AC-3: An unknown choice shape is reported, not guessed
**Given** a raw `choose` block with a key other than `from`, `count` or `amount`
**When** the races scrape runs
**Then** the record is listed in the scrape report as unparsed, and no `abilityScoreChoices` entry is written for that block.

### AC-4: The live catalog states the real records
**Given** the catalog the in-app sync builds
**When** `npm run check:live` runs
**Then** these hold:
- Tiefling (Variant; Devil's Tongue) SCAG has fixed INT 1, a choice `{from: [dex, cha], count: 1, amount: 2}`, and replaces its race's increases.
- Tiefling (Dispater) MTF replaces its race's increases.
- Half-Elf PHB has fixed CHA 2 and a choice of 2 from the five others at +1.
- Human (Variant) PHB has a choice of 2 at +1 from all six.
- Every choice's `from` names only ability keys.

### AC-5: The SRD Baseline Half-Elf has its choice
**Given** the SRD Baseline (`src/data/races.json`), regenerated through `node scripts/prune-to-srd.mjs`
**When** the Half-Elf record is read
**Then** it has fixed CHA 2 and a choice of 2 at +1 from STR, DEX, CON, INT, WIS.

### Increases (one module combines race and subrace)

### AC-6: A replacing subrace gives only its own increases
**Given** a character holding an MTF Tiefling subrace that replaces its race's increases (fixed DEX 1, CHA 2), with base 10s
**When** its Effective Ability Scores are computed
**Then** DEX is 11, CHA is 12 and INT is 10.

### AC-7: A replacing subrace's choice applies with its fixed increase
**Given** a SCAG Tiefling variant (fixed INT 1, choice +2 to DEX or CHA), with base 10s
**When** the scores are computed with no pick, and again with a CHA pick
**Then** with no pick INT is 11 and nothing else is raised. With the pick INT is 11 and CHA is 12.

### AC-8: A non-replacing subrace still adds to its race
**Given** a Hill Dwarf (race CON 2, subrace WIS 1)
**When** the scores are computed
**Then** CON is 12 and WIS is 11, as before.

### Offers

### AC-9: Choices come from the catalog, not from names
**Given** a held ancestry with Increase Choices: Half-Elf from the catalog, a test race with a choice under an invented name, and a replacing subrace whose race also has a choice
**When** the ancestry state is resolved
**Then** each choice is offered with its own id, pool (`from`), count and amount, and the replacing subrace offers only its own choices. No code path recognises Half-Elf, Variant Human or Custom Lineage by name for its increases.

### AC-10: Origin Customization widens the pool
**Given** a held SCAG Tiefling variant, with Origin Customization available (TCE active and the rule's table in the catalog)
**When** the ancestry state is resolved
**Then** the choice's pool is all six scores, minus the scores AC-11 blocks. Without the rule it is DEX and CHA.

### AC-11: No two racial increases share a score, and none passes 20
**Given** a held ancestry with a Fixed Increase on INT, a choice of 2 at +1, one pick already on DEX, and base WIS 20
**When** the offers for the choice's second pick are resolved
**Then** INT (raised by the fixed increase, at its swap target if swapped), DEX (already picked) and WIS (20 + 1 > 20) are not offered. The same blocking applies to Flexible Increases picks.

### AC-12: Flexible Increases only without fixed increases or choices
**Given** an MPMM race with neither, a Variant Human (choice only), and Custom Lineage (choice only)
**When** the ancestry state is resolved
**Then** only the MPMM race offers Flexible Increases. Variant Human offers its choice of 2 at +1, and Custom Lineage its choice of 1 at +2.

### Picks

### AC-13: A pick is saved under its choice
**Given** an offered choice with count 1 that already has a pick
**When** the player picks a second score for it, and separately picks a score the offers block
**Then** each pick saved is stored with its choice id. A pick over the count or on a blocked score is refused, and the character is unchanged.

### Reconciling saved picks

### AC-14: A pick that no longer fits is released with a notice
**Given** a saved pick on WIS for a choice whose pool no longer includes WIS (or a choice the held ancestry no longer has, or a pick over the choice's count), with a current catalog
**When** the character is reconciled
**Then** the pick is removed and the review notice `Ability increase to Wisdom removed: ancestry no longer offers it` is added.

### AC-15: A legacy pick is assigned to the first fitting choice
**Given** a Half-Elf saved before this change, with picks `{key: str, amount: 1}` and `{key: dex, amount: 1}` and no choice id
**When** the character is reconciled against a current catalog
**Then** both picks are kept under the Half-Elf choice's id, the scores are unchanged, and no notice is added. A legacy pick that fits no choice is released with the AC-14 notice.

### AC-16: A stale catalog releases nothing
**Given** a Half-Elf with saved picks, and a catalog that is stale (saved below the required Catalog Format)
**When** the character is reconciled and its scores computed
**Then** the picks are kept and applied as stored, no notice is added, and the ancestry state offers no choice picker.

### AC-17: Corrected data changes scores silently
**Given** a saved MTF Tiefling (Dispater) character with no picks, created when its CHA got +4
**When** it is reconciled against the current catalog
**Then** its derived racial bonuses become DEX +1 and CHA +2, and no review notice is added.

### UI

### AC-18: One picker row per choice
**Given** the Builder's Ancestry section for a held SCAG Tiefling variant
**When** it renders
**Then** it shows one row with `Choose +2 to 1 ability score (0/1 chosen)` and buttons for DEX and CHA only (all six minus blocked scores with Origin Customization available). Tapping CHA reads `(1/1 chosen)`. No other text is added. The row fits at 320, 360, 393 and 412 px.

### AC-19: The race card summary names the choices
**Given** the race and subrace cards in the race picker
**When** they render
**Then** a SCAG Tiefling variant's card reads `INT +1, +2 DEX or CHA`, Half-Elf's reads `CHA +2, +1 to 2 others`, Variant Human's reads `+1 to 2 scores`, and a replacing subrace's card shows only its own increases. "others" is used when the pool is every score but the fixed ones; "scores" when the pool is all six; otherwise the pool is listed with "or".

## Architecture Constraints

- **Catalog fields.** `RaceData` and `SubraceData` gain `abilityScoreChoices?: { from: AbilityKey[]; count: number; amount: number }[]`. `SubraceData` gains `replacesRaceAbilityScores?: true`. `abilityScoreIncrease` keeps its shape and holds Fixed Increases only. The scraper copies the record; it never merges race and subrace.
- **Catalog Format.** It stays at 14, shared with the Sea Elf fix on `fix/nov-2026-bugs`. ADR 0015's amendment line and ADR 0019 both name 14. If 1–3 ship before this lands, the format moves to 15 here.
- **One combining module.** A new `src/rules/ancestryIncreases.ts` is the only code that combines a race's and a subrace's increases. It returns the Fixed Increases, the Increase Choices (with ids and resolved pools) and whether Flexible Increases apply. `effectiveScores` (`abilities.ts`), `ancestryEngine.ts`, `originCustomization.ts` slots and the race card summary read through it. A guard check in `checks/` fails when any other file under `src/` reads a race's or subrace's `abilityScoreIncrease`. Feat records (`leveling.ts`) are not race data and are exempt.
- **No names.** `CHOICE_ASI_RACES` and the `"Variant"` / `"Custom Lineage"` checks used for increases are removed. The Variant Human origin-feat check in `feats.ts` is out of scope and stays.
- **Pick storage.** `racialChoiceBonus` entries gain `choiceId?: string`. A choice id is persisted and never changes once shipped. It is built from the owner and the choice's position, like the Origin Customization slot ids, and is distinguishable from them (e.g. `choice|race|<name>|<source>|<index>`, `choice|subrace|<race>|<source>|<subrace>|<subraceSource>|<index>`).
- **Derived bonuses.** `racialAbilityBonuses` stays derived by `reconcileOriginAbilities`: Fixed Increases at their targets plus picks. Releasing picks (AC-14, AC-15) happens in the same reconcile pass, and never when `compendium.stale`.
- **Data.** Tracked data changes only through `npm --prefix dnd5eToolsScrap run scrape:races`, then `enrich:grants`, then `node scripts/prune-to-srd.mjs`, each in its own commit. The scrape's diff must contain only the new fields; upstream drift is reported, not committed.
- **ADR 0014.** No non-SRD names, rule text or lists in `src/`. Tests use invented names, except the live-catalog checks, which name real records.
- **UI copy.** Only the strings in AC-14, AC-18 and AC-19 (CODING_STANDARDS §8).

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1, AC-2, AC-3 | `scrapeRaces` on a raw fixture (`dnd5eToolsScrap/checks/`) | Invented records; expected fields and report entries; `npm --prefix dnd5eToolsScrap test` |
| AC-4 | `checks/liveCatalog.test.ts` | Real records; `npm run check:live` |
| AC-5 | `loadSrdCatalog("races")` in `checks/` | Half-Elf record fields; `npm run check:all` |
| AC-6, AC-7, AC-8 | `effectiveScores` with `makeChar()` and a test catalog | Hand-computed scores |
| AC-9 – AC-12 | `resolveAncestryState` (or the module's exported offer function) | Expected ids, pools and blocked scores |
| AC-13 | `setChoiceRacialBonus` (builder transition) | Saved picks with ids; unchanged character on refusal |
| AC-14 – AC-17 | `reconcile()` from `characterReconciler.ts` | Picks kept or released, `needsReview` notices, derived `racialAbilityBonuses`; stale compendium fixture |
| AC-18 | `npm run layout:check -- --integrated` with a SCAG Tiefling scenario; browser per `docs/agents/driving-the-app.md` | Row text and buttons; no overflow at the four widths |
| AC-19 | Exported summary formatter | Expected strings |
| Guard: one combining module | `checks/` guard test (like `proficiencyReadersGuard.test.ts`) | Fails on a planted read outside the module |
| Risk: Origin Customization slot ids move | Existing origin customization tests | Unchanged ids for non-replacing races; `npm run check:all` |

## Out of Scope

- Feat ability increases, and the Variant Human origin-feat detection in `feats.ts`.
- The shape of the Flexible Increases rule itself (+2/+1 or +1/+1/+1).
- 2024 (XPHB) races, and lineage replacement (`lineageReplacement`).
- A notice for scores that change only because data was corrected (Q4).

## Open Risks

- Origin Swap slot ids embed the race or subrace. A subrace that now replaces its race's increases drops the race's slots, so saved swaps on them are released with the existing notice. This is accepted per ADR 0019, and the reconciler already handles it.
