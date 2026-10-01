# D&D 5e (2014) character builder rework

Date: 2026-09-17
Status: Design sections approved in conversation; written specification awaiting review.
Authority: `cb.txt`. This document organizes that scope; it does not replace or reduce it.

## 1. Approved approach

Retain Expo SDK 57, React Native/TypeScript, Expo Router, the existing black/accent theme, useful UI components, and scraped data. Rework persistence and character rules before updating all seven tabs. This is not a clean-slate rewrite or a cosmetic lint cleanup.

Targets are Android and web. The default accent is red; settings allow another accent against black. No backend, accounts, cloud synchronization, unrelated platform migration, or new dependency framework is part of this work. Do not commit, reset, or discard the user's existing working tree.

Implementation order:
1. Persistence safety and data validation.
2. Builder choices and level progression.
3. Stats, spellcasting, and rests.
4. Inventory, features, journal, and actions.
5. Cross-platform acceptance verification and remaining integration repairs.

These are delivery stages, not optional scope cuts. Every requirement in `cb.txt` remains required.

## 2. Evidence from initial inspection

This is an initial code audit, not a completed runtime audit:
- TypeScript produced no diagnostics in the baseline checks.
- ESLint reports 19 errors and 35 warnings, including conditional hooks in several tabs. These findings require investigation; a lint diagnostic alone does not prove a runtime failure.
- Lint setup installed ESLint dependencies and generated `eslint.config.js`; these are changes made during discovery, not pre-existing app fixes.
- `BuilderTab.tsx` keeps standard-array assignments in component-local state and writes only the scores to the character. Assignment state therefore cannot survive remounting.
- Half-Elf choice handling writes choice bonuses in place of fixed bonuses.
- Starting equipment/gold currently selects a flag and directs the user to the PHB instead of granting inventory/currency.
- `storage.ts` swallows read/write failures; failed loads can look like an empty collection.
- `CharacterContext.tsx` constructs whole-array updates from captured state, creating a lost-update risk.
- `SpellsTab.tsx` uses one casting ability, a global preparation key, and a picker without class eligibility restrictions.
- `FeaturesTab.tsx` creates separate paladin and cleric Channel Divinity pools.
- The shared slot calculator always uses multiclass progression, including for single-class half-casters.
- Conditions data already exists. Audit its completeness and edition before scraping again.

Further source tracing and runtime reproduction are required within each implementation stage.

## 3. Architecture and ownership

### Character choices versus derived values

Persist player choices and play-state: identity, ancestry/background choices, class advancement order, class/subclass/feat selections, proficiency choices, spells, inventory, journal, HP, spent resources, and overrides.

Calculate derived values in shared TypeScript rules, not separately inside tabs: effective scores, level, proficiency bonus, HP maximum, armor class, movement, saves, skills/passives, granted features, resource maxima, attacks, and spellcasting profiles.

Reuse `src/services/dndRules.ts`, `src/services/dataService.ts`, `src/services/storage.ts`, and existing types/context where suitable. Split a module only when a real independent responsibility makes it necessary. No generic plugin/rule-engine framework is required.

Choices need stable source-aware identity. Advancement-dependent choices also retain their owning class and class level. Preserve advancement order where acquisition order affects rules, particularly Unarmored Defense. A shared pure transition/validation layer handles changes; UI renders choices, calls transitions, and displays validation failures.

### Persistence and migration

Keep AsyncStorage and introduce a versioned saved format with validation and migration of the current format. Preserve IDs, characters, folders, journal content, inventory, and settings. Back up original stored payloads before replacing them during migration.

Serialize writes and calculate updates against the latest state, including rapid edits and nested field updates. Coordinate shared settings updates so theme and book changes cannot overwrite one another.

Distinguish an absent save from a failed/corrupt load. Never replace unreadable saves with an empty collection or report a failed write as successful. Surface actionable load/save errors and allow retry without destroying original data. Prevent edits from silently overwriting data while initialization/recovery is unresolved.

Some old saves lack choice ownership or advancement history. Infer only unambiguous values; preserve ambiguous selections and flag them for review instead of inventing history or deleting choices. Retain legacy class order as the available evidence, with review required where missing order changes rules.

## 4. Source data and options

Use `dnd5eToolsScrap/data/` as the local source and inspect the scraper plus generated `src/data/` schema before changing ingestion. Verify actual fields rather than trusting TypeScript casts.

Normalize stable name/source identities, edition, subrace/subclass relationships, choices, spell associations, armor categories, weapon properties, and progression data needed by the app. Preserve rule text and source attribution. Repair missing scraped mechanics from inspectable source data rather than guessing from item names or prose fragments.

Target 2014 rules and compatible supplements; do not silently blend 2024 revisions into the rules. First-run book defaults must match `dnd5eToolsScrap/default_active_resource_books.txt`. The user can select/unselect sources initially and later in options.

Source selection filters new choices. Disabling a book must not remove existing benefits, spells, descriptions, or inventory sourced from that book. Persisted choices resolve against the full catalog. Distinct sources must not collide merely because names match.

Missing or unsupported mechanics are explicit validation/reporting items, not fabricated behavior. Required mechanics must be repaired before claiming completion; a warning is not a substitute for implementing requested scope.

## 5. Builder and progression

- Create a character with a required nonblank name; gender, alignment, and faction are optional. Navigate to the character page.
- Keep the required tab order: Builder, Stats, Spells, Inventory, Features, Journal, Actions cheatsheet.
- Point buy enforces the 2014 cost table, 8–15 base scores, and 27-point budget. Standard array assigns each value once and persists assignment state. Manual entry validates finite integer scores and provides clear input errors.
- Support races, source-aware subraces, fixed and chosen bonuses, Custom Lineage, and replacement lineages including Dhampir. Replacement applies its actual inheritance rules instead of stacking all old/new traits. Resolve race-granted choices and feats.
- Support backgrounds and custom backgrounds, including their skills, tools/languages, feature, and equipment choices. Choice slots retain their origin; duplicate proficiency grants follow replacement rules rather than disappearing or granting duplicate bonuses.
- Starting equipment presents actual choices and grants selected items once. Starting funds use the applicable class rules and credit the pouch once. Changing the starting choice reconciles its grants without removing independently acquired inventory or duplicating funds.
- Level-up applies class features, spell progression, subclass choices at the correct class level, ASI/feat opportunities, expertise, and applicable feature suboptions. ASI is class-level-based, not merely total-level-based; feat ability increases and prerequisite choices are included.
- Multiclass entry validates requirements for the existing and new classes, including alternative prerequisites. Initial class saving throws and proficiencies are distinct from the exact multiclass proficiency table in `cb.txt`.
- Advancement cannot exceed level 20. Changes/removal of levels must reconcile dependent choices, present consequences, and not silently retain illegal benefits or delete unrelated character content.
- Channel Divinity effects may combine, but uses share a pool and increase only at explicit class thresholds. Extra Attack does not add across classes or Thirsting Blade; explicit fighter progression applies. Only the first acquired Unarmored Defense is gained.

## 6. Stats, conditions, and rests

Display calculated maximum HP with current/max editing, temporary HP, conditions, effective ability scores and floor((score - 10) / 2) modifiers, movement, AC, proficiency bonus, initiative, hit dice, saves, and armor/weapon/tool proficiencies.

Group skills by ability. Distinguish proficiency, expertise, and Jack of All Trades. Show passive Investigation, Insight, and Perception in parentheses, including applicable feat bonuses. Apply applicable bonuses consistently, including initiative where appropriate.

Use armor category and equipment properties for AC/movement, including shields and restrictions on unarmored benefits. HP progression uses correct initial hit die and subsequent advancement; Constitution changes apply retroactively. Automatic fixed-average advancement may be used with the requested maximum-HP override available.

Track hit dice without double-counting shared die sizes across classes. Short rest spending consumes dice and heals according to the rules; reset eligible resources and Pact Magic only. Long rests restore eligible HP/resources/slots and at most half total hit dice (minimum one), allowing selection among available spent die types. Track exhaustion levels rather than clearing all exhaustion as a single boolean. Do not arbitrarily remove unrelated conditions on rest.

Resource counters derive their maxima/reset policy from current features while retaining consumption. Level changes must not freeze stale maxima or accidentally replenish spent resources. Unlimited features are represented explicitly rather than with a fake large number.

## 7. Spellcasting

Each eligible class/subclass has its own profile: casting ability, save DC, attack bonus, available spell levels, cantrips, known spells or spellbook, and prepared spells as appropriate. Class/source-aware keys allow the same spell in multiple classes without merging preparation or casting abilities.

Enforce each class's individual learning/preparation rules and limits. Prepared casters and wizard spellbooks are not treated as identical to spells-known casters. Include subclass spell grants and restrictions where applicable. A higher shared slot does not unlock higher-level spells for an individual class.

Use individual progression when only one class grants Spellcasting. Otherwise use the 2014 multiclass table, rounding each class's contribution according to its rule. Pact Magic is separate, short-rest rechargeable, and usable interchangeably with Spellcasting for eligible spells. Preserve higher-level warlock features separately from pact slots where required.

Expose current/used shared slots and pact slots. Sorcerer points and metamagic are available at the appropriate levels, with selection limits, costs, and applicable source options. Font of Magic conversions must validate costs and slot limits if exposed as part of the sorcery controls.

## 8. Remaining screens and shell

- Home starts empty, with corner add action for characters/folders. Create/move/delete folder and character flows preserve unrelated records and confirm destructive actions on Android and web.
- Inventory separates equipped/carried items, tracks quantities and pouch denominations, and retains item mechanics used by other tabs. Weight limit is off by default; enabled behavior includes carried/equipped weight and coins with the applicable capacity rules. Avoid negative/invalid quantities or currency.
- Features lists currently granted race, subrace/lineage, background, class, subclass, feat, and selected option features with their descriptions. Counters include at least rage and wild shape and all automated resources used elsewhere in the app; custom counters remain available.
- Journal contains every field in `cb.txt`: name, uploaded art, alignment, gender, faction name/rank/renown/notes, description, backstory, traits, ideals, bonds, flaws, read-only race information, and additional notes. Selected art must survive reload/relaunch rather than depending on an expired temporary URI.
- Actions cheatsheet lists relevant actions, bonus actions, and reactions from actual equipment/features. Weapon attacks use appropriate proficiency, ability, properties, and damage. Two-weapon fighting is conditional on valid equipment/features, not simply owning two weapons. Avoid presenting situational actions as always usable.
- Preserve configurable black/accent styling and add accessible labels, usable touch targets, keyboard support on web, readable contrast, and narrow-screen layout. No independent visual redesign or visual companion is needed for the approved direction.

## 9. Verification and acceptance

Use small runnable regression checks against production rules and transitions, preferably Node's existing tooling rather than a new test framework. Follow failing-check → minimal fix → passing-check. Tests must not merely mirror implementation or use invented source fixtures in place of testing actual catalog integration.

Required regression scenarios include:
- Standard-array assignment survives leaving/reopening the tab and app reload.
- Half-Elf fixed Charisma bonus is preserved alongside legal distinct choice bonuses.
- Source filtering never strips an already-created character's benefits.
- Invalid multiclass entry is rejected; initial versus multiclass proficiencies differ correctly.
- Fighter-specific ASI/Extra Attack progression and combined Channel Divinity behave correctly.
- Unarmored Defense acquisition order is respected, including when neither contributing class was the initial class.
- Single-class ranger/paladin progression differs from multiclass slot calculation where required; individual fractional contributions round correctly.
- Ranger 4/wizard 3 has slots [4, 3, 2], only first-level ranger spells and up to second-level wizard spells; Intelligence 16 permits six prepared wizard spells.
- The same spell can belong to two classes with independent preparation and casting stats.
- Warlock pact slots remain separate; short versus long rest resets are correct.
- Shared-size hit dice, low-Constitution healing, exhaustion recovery, and resource maxima do not regress.
- Armor type, shield use, weapon properties, and two-weapon eligibility drive stats/actions consistently.
- Rapid updates preserve both changes; failed writes are visible; failed loads do not overwrite originals; legacy migration retains user content.
- Starting grants are applied once, not just described.

Run typecheck, lint, regression checks, and web production build. Exercise actual web UI at desktop and phone widths: first-run sources, creation/folders, every tab, level-up, spell selection, equipment, rest, journal/art, theme changes, and reload persistence. Run and exercise Android on an available device/emulator, including navigation, inputs, dialogs, art, and relaunch persistence. A successful JS bundle alone is not Android runtime verification.

Record actual command results and runtime observations. If platform tooling or source availability blocks a required check, report the blocker and unverified scope explicitly; do not claim completion from a build or lint result alone.

## 10. Specification self-review

- All seven tabs and shell requirements map to `cb.txt`; no requested subsystem is deferred out of scope.
- Shared rules are distinct from persisted choices and consumption; UI cannot own a competing rule calculation.
- Preservation of old data takes priority over migration convenience; ambiguous legacy choices require review.
- Book filtering applies to acquisition, not retroactive character deletion.
- Stage order is approved. Detailed task boundaries and commands belong in the implementation plan after written-spec approval.
- No commits are authorized. The existing uncommitted implementation and data must remain intact throughout the rework.
- This document records intended behavior, not a claim that any app bug has been fixed.
