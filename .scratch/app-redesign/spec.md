# Spec: App redesign — guided building and dice

**Status:** ready-for-human (approved 2026-11-08; the visual system stays open until map tickets 03, 04 and 05 resolve)

Map: `.scratch/app-redesign/map.md`. Terms: `GLOSSARY.md`, "Building and rolling".

## Problem

Building a character means jumping between four freely switchable builder sections, starting from the name. The player conceives a character the way cRPGs do, from class and race, and loses track of what is still missing. Levelling up has no guided path for the choices a level brings. Several themes fail contrast (the crimson accent is hard on the eyes), modals on phones leave almost nothing to tap outside them, and there is no way to roll dice in the app, neither for ability scores nor during play.

The player needs a Creation Flow that walks one step at a time from identity to name, a Level-Up Flow that asks only what the new level brings, readable themes, modals that close with a tap outside them, and dice for ability scores, hit points, attacks, damage, checks and free rolls.

## Decisions (verbatim)

Brief:

- "Leave details like name, gender, etc., for the very end. Look at how cRPGs handle this: the first thing you choose is your character’s "identity"—that is, RACE + CLASS—with everything else coming later."
- "Organize the character creation stages into a logical sequence—for example: LEVEL >> CLASS >> SUBCLASS >> RACE >> SUBRACE >> BACKGROUND >> ABILITIES >> FEATS >> EQUIPMENT. It should be a structured flow of steps, not a collection of panels that can be jumped between at will, as that makes building a character confusing."
- "Apply a similar approach to leveling up, specifically for choices that need to be made (subclass, ASI, feats, etc.)."
- "Adjust the rest of the application’s design to align with the new character builder; I’m trusting your sense of taste here."
- "Ensure that the contrast levels across all themes comply with WCAG standards; I’ve received feedback that, for instance, the current red isn't very easy on the eyes."
- "Clicking outside of a modal should close it whenever possible—searching for an "x" icon is tedious."
- "Add a "rolled abilities" feature. [...] please also include options for making rolls directly from the actions tab (e.g., for attack rolls or damage). Users should also be able to initiate a roll at any time by selecting dice via a "floating" button—for instance, one positioned in the bottom-right corner of the screen. [...] It should also be possible to disable the 3D dice rolling feature via the settings menu."

Round 1:

- Q1 Destination (one map, one spec, dice its own branch): "yes"
- Q2 Missing steps (Class → Subclass → Race → Subrace → Background → Abilities → Class Choices → ASI/Feats → Spells → Equipment → Details → Review; inapplicable steps skipped): "yes"
- Q3 Where level goes ((b) a level picker on the Class step, default 1): "b"
- Q4 Multiclassing during creation (single class; multiclass only through level-up): "yes"
- Q5 Going back (finished steps revisitable, later locked, invalidated picks released and flagged): "yes"
- Q6 Builder tab after creation (replaced by Level up and Edit Build): "yes"
- Q7 Rolled abilities (4d6 drop lowest, placed like Standard Array, unlimited rerolls): "yes"
- Q8 Where you can roll (abilities, Actions, floating button, Stats, level-up HP; advantage/disadvantage on every d20; session Roll Log): "by adv/dis you mean option to? yes"
- Q9 3D dice (text always, 3D optional, research picks the technique): "yes, i prefer option thats faster/lower on resources. Also dice look should depend on current theme"
- Q10 Contrast (AA, automated check, dark only): "yes"
- Q11 Closing modals (bottom sheet with swipe-down on phones, Escape on web, part of the visual system): "yes"
- Q12 Prototype location (throwaway Expo route after Impeccable init): "yes"

Round 2:

- Q1 Level-up steps (Class → Hit Points → Subclass → ASI/Feat → Class Choices → Spells → Review, applied on confirm): "yes, but in case on spells don't remove option to customize it from spells tab, i think it will be easier for spellcasters"
- Q2 Edit Build on a multiclass character (lowers levels; only Level up adds): "yes"
- Q3 Unfinished characters (drafts resume at their step, no sheet until Review): "yes"
- Q4 Old-builder characters (count as finished): "yes"
- Q5 Details step (name required, gender and alignment optional): "yes"
- Q6 Floating dice button (every screen): "yes, but hidden while in character sheet feels annoying, i dont want it" — clarified: it stays visible on the character sheet; only an open modal's overlay covers it.
- Q7 Rolls spend nothing: "yes"
- Q8 Roll Log (one per session, each entry names character and source): "yes"
- Map and spec: "yes please do that"

Prototype review (map ticket 03):

- Visual direction pick: "when i choosing design, i was more focusing on layout than coloring, i think we should adapt themes that we already have (with previously mentioned contrast changes)"
- Visual system, round 1 (map ticket 04): "1 and 2 - i feel like proposed colors are less expressive, especially new crimson that is not even red or silver that is super close to white. Could you propose some more distinct tones that still pases on metrics?, 3 - yes, 4 - yes, 5 - a, 6 - yes, 7 - yes, 8 - yes"
- Visual system, round 2 (two-tone accents; fill for the one primary action, ink for selection and icons): "yes to both"
- Creation Flow variant: "I think B it's nice meet in the middle, please refrain from unnecesery description like subclass level on class choices or speed info on race choices. Also i know we focus more on mobile, but sheet looks terrible at wider screen, remember about that"

## Acceptance Criteria

### Creation Flow

#### AC-1: Steps follow the order and skip what does not apply

**Given** a new Character whose class is Wizard at level 1
**When** its Creation Steps are listed
**Then** they are Class, Race, Subrace (only when the race has subraces), Background, Abilities, Class Choices (only when the class offers any at that level), Spells, Equipment, Details, Review, in that order, with no Subclass and no ASI/Feats step

**Given** a Cleric at level 1, or a Fighter at level 4
**When** its Creation Steps are listed
**Then** the Cleric's include Subclass right after Class; the Fighter's include Subclass after Class and ASI/Feats after Class Choices, and no Spells step unless the chosen subclass grants a Spellcasting Profile

#### AC-2: The Class step offers one class and a starting level

**Given** a new Character on the Class step
**When** the player picks a class
**Then** the level defaults to 1, can be set from 1 to 20, and no second class can be added

#### AC-3: Later steps stay locked until the current step is valid

**Given** a Character on the Race step with no race picked
**When** the player tries to open Background or any later step
**Then** the step does not open; finished earlier steps can still be opened

#### AC-4: Changing an earlier step releases what it invalidates

**Given** a Character that finished every step up to Equipment as a Fighter
**When** the player returns to Class and changes it to Rogue
**Then** the picks that depended on Fighter (class skills, Class Choices, ASI/Feats beyond the new class's levels, starting equipment) are released, their steps are marked as needing attention and must be finished again, and the race, background and ability picks are kept

#### AC-5: A draft resumes at its step

**Given** a Character that left the Creation Flow on the Background step
**When** its current step is asked for
**Then** it is Background

#### AC-6: A draft opens into the flow, not the sheet

**Given** that draft in the character list
**When** the player opens it
**Then** the list shows it as a draft naming its step, the Creation Flow opens on Background, and no sheet tab (Stats, Actions, Spells, Inventory, Features, Journal) is reachable

#### AC-7: Details asks only for name, gender and alignment

**Given** a Character on the Details step
**When** the name is empty
**Then** the step is not valid and Review cannot open; gender and alignment may stay empty

#### AC-8: Review finishes the character

**Given** a Character on Review with every step valid
**When** the player confirms
**Then** the Character is finished, its sheet opens, and its header offers Level up and Edit Build in place of the Builder tab

#### AC-9: Characters from the old builder count as finished

**Given** a saved Character that has no creation progress recorded
**When** it is loaded
**Then** it is finished: its sheet opens and Level up and Edit Build are offered

### Edit Build

#### AC-10: Edit Build reopens the flow at a chosen step

**Given** a finished Character
**When** the player chooses Edit Build and the Background step
**Then** the Creation Flow opens on Background with every other step reachable, and the same release-and-flag rule as AC-4 applies to changes

#### AC-11: Edit Build lowers levels but never adds them

**Given** a finished Fighter 3 / Wizard 2 in Edit Build on the Class step
**When** the player lowers Wizard to 1
**Then** the picks of Wizard level 2 are released through the Character Reconciler, and the step offers no way to raise a level or add a class

### Level-Up Flow

#### AC-12: Level-up asks only what the level brings

**Given** a finished Fighter 3
**When** a Fighter level-up is planned
**Then** its steps are Class, Hit Points, ASI/Feat, Review

**Given** a finished Wizard 1
**When** a Wizard level-up is planned
**Then** its steps are Class, Hit Points, Subclass, Spells, Review

#### AC-13: A new class must meet multiclass requirements

**Given** a finished Fighter with Intelligence 12
**When** the player picks Wizard on the level-up Class step
**Then** the pick is refused with the unmet requirement named

#### AC-14: Hit Points are rolled or averaged

**Given** a level-up on the Hit Points step for a class with a d10 Hit Die and Constitution 14
**When** the player takes the average
**Then** the level adds 8 hit points

**When** the player rolls instead
**Then** the level adds the d10's face plus 2, never less than 1

#### AC-30: A level-up Hit Points roll is logged

**Given** a level-up on the Hit Points step
**When** the player rolls
**Then** the Roll appears in the Roll Log with the character and "Hit Points" as its source

#### AC-15: Nothing applies until Review is confirmed

**Given** a level-up with picks made on every step
**When** the player cancels
**Then** the Character is exactly as before the level-up

**When** the player confirms on Review instead
**Then** the level and every pick apply together

#### AC-16: The Spells tab still learns and swaps spells

**Given** a finished spellcaster after a level-up
**When** the player opens the Spells tab
**Then** learning, forgetting and swapping spells work there as before

### Rolls

#### AC-17: Rolled Abilities rolls six sets of 4d6, dropping the lowest

**Given** a Character on the Abilities step with Rolled Abilities chosen
**When** the player rolls
**Then** six results appear, each the sum of the highest three of four d6 (3 to 18), every die shown with the dropped one marked

#### AC-18: Rolled results are placed like Standard Array, and rerolls are unlimited

**Given** six rolled results
**When** the player places them
**Then** each result goes to exactly one Ability Score; rerolling replaces all six and clears every placement, as often as the player likes

#### AC-19: A Roll totals a dice pool and a modifier

**Given** the pool `2d6+1d8+3`
**When** it is rolled
**Then** the Roll shows each die's face and a total equal to their sum plus 3

#### AC-20: Advantage and disadvantage keep the higher or lower d20

**Given** a d20 Roll with advantage (or disadvantage)
**When** it is rolled
**Then** two d20s are shown and the higher (or lower) is used for the total

#### AC-21: A critical hit doubles the damage dice

**Given** an attack Roll whose kept d20 shows 20
**When** its damage is rolled
**Then** the number of damage dice doubles and the flat modifier does not

#### AC-22: The Actions tab rolls attacks and damage

**Given** a finished Character's Actions tab
**When** the player rolls an attack, then its damage
**Then** the attack Roll uses the attack's bonus with the chosen advantage or disadvantage, and the damage Roll uses its damage dice and modifier

#### AC-31: The Stats tab rolls checks, saves and skills

**Given** a finished Character's Stats tab
**When** the player rolls an ability check, a saving throw or a skill
**Then** the d20 Roll uses that bonus with the chosen advantage or disadvantage

#### AC-32: The floating dice button opens a tray on every screen

**Given** any screen, including the character sheet, the Creation Flow and the Level-Up Flow
**When** the player taps the floating button at the bottom-right
**Then** a tray opens that builds and rolls any pool; the button is covered only by an open modal's overlay

#### AC-23: Rolls spend nothing

**Given** a spellcaster with spell slots and limited-use features
**When** the player rolls an attack or damage for a spell or feature
**Then** no slot, use or ammunition changes

#### AC-24: The Roll Log names character and source, for this session only

**Given** Rolls made from Kara's Longsword attack and from the dice tray
**When** the Roll Log is opened
**Then** the entries read with the character and the source ("Kara · Longsword attack", "Dice tray"), newest first; after the app restarts the log is empty, and no Roll is saved with the Character

#### AC-25: The result never waits for the dice

**Given** 3D dice switched on
**When** a Roll is made
**Then** the total is decided before any animation and shown as text, and the dice land on the faces of that Roll in the current accent colour

#### AC-26: 3D dice can be switched off

**Given** 3D dice switched off in Settings, or no setting saved while the system asks for reduced motion
**When** a Roll is made
**Then** no dice animation plays and the text result appears at once

### Readability and modals

#### AC-27: Every accent meets WCAG AA

**Given** each accent palette combined with the base theme
**When** the contrast of its colour pairs is measured
**Then** on `background`, `surface`, `surfaceRaised` and `surfaceHighlight`, the primary, secondary and muted text, the four status colours and the accent's ink each reach 4.5:1, and the label on the accent's fill reaches 4.5:1; hairline borders are not tested

#### AC-28: Tapping outside a modal closes it, and Escape closes it on web

**Given** any modal open on a phone width or on the web
**When** the player taps the visible background outside it, or presses Escape on the web
**Then** the modal closes, except a modal whose closing would discard work, which asks first

#### AC-29: Phone modals sit as bottom sheets and close on swipe down

**Given** a modal open on an Android phone
**When** the player swipes the sheet down
**Then** it closes, and a strip of background stays visible above it to tap

## Architecture Constraints

- The flow logic lives in pure, React-free modules in `src/rules/`: one for the Creation Flow (its steps, their status, the current step), one for the Level-Up Flow (its steps for a class, and applying a confirmed plan), and one for dice (pools, Rolls, advantage, criticals, Rolled Abilities). Components read them; they never decide step order or roll faces themselves.
- Step changes reuse the transitions in `src/rules/builderTransitions.ts` and the Character Reconciler for releasing invalidated picks. No second release path.
- A level-up builds a plan and applies it in one Character update, through the existing level-up transitions (`confirmLevelUp`, `addMulticlassLevel`, `applyAsiWithHitPoints`, `validateMulticlass`).
- The Character gains one optional creation-progress record. Its absence means finished, so old saves need no rewrite; `migrateCharacter` keeps that true.
- The Roll Log lives in app state, never in the Character or its storage.
- Dice take an injectable random source; the Roll is complete before the renderer receives its faces. The renderer sits behind one component interface so the technique chosen by map ticket 02 can be swapped, and it is not loaded while 3D dice are off.
- The 3D dice setting is stored with the other app options, next to `fullHealOnLevelUp`.
- Theme tokens stay in `src/constants/theme.ts`; the contrast check reads them from there. The visual system is the one `DESIGN.md` records (map ticket 04).
- No non-SRD content in `src/` (ADR 0014): steps list options from the Compendium.
- Layout follows `CODING_STANDARDS.md` section 7 and ADRs 0001 and 0002; interface copy carries only essential mechanics (section 8). Choice rows show only the facts that tell the options apart.
- The Creation Flow uses the layout of map ticket 03, variant B: step chips, the choice list, an identity bar opening a bottom sheet. Every surface has a designed layout at tablet and desktop widths, not a stretched phone column (map ticket 04).

## Verification Map

| Criterion or risk | Seam | Oracle and evidence |
| --- | --- | --- |
| AC-1, AC-3, AC-5, AC-7 | Creation Flow rules module | `checks/` test: fixture characters from `makeChar()` give the expected step list, statuses and current step; `npm test` |
| AC-2 | Creation Flow rules module | `checks/` test: the Class step's offer has a level 1–20 default 1 and no add-class action |
| AC-4, AC-10 | Creation Flow rules module over `builderTransitions` | `checks/` test: changing class on a finished Fighter releases the listed picks, keeps race, background and abilities, flags the steps |
| AC-6, AC-8 | App in the browser | `layout:check` scenario: a seeded draft opens on its step with no sheet tabs; confirming Review opens the sheet with Level up and Edit Build |
| AC-9 | `migrateCharacter` | `checks/` test: a save with no creation progress loads as finished |
| AC-11 | `removeClassLevel` and the Edit Build Class step offer | `checks/` test: lowering Wizard 2→1 releases its picks; the offer has no raise or add-class action |
| AC-12, AC-13 | Level-Up Flow rules module | `checks/` test: planned steps for Fighter 3→4 and Wizard 1→2; Wizard refused at Intelligence 12 |
| AC-14 | Level-Up Flow rules module with a fixed random source | `checks/` test: average adds 8; a seeded roll adds face + 2, minimum 1 |
| AC-30 | App in the browser | `layout:check` level-up scenario: rolling Hit Points adds a "Hit Points" entry to the Roll Log |
| AC-15 | Level-Up Flow rules module | `checks/` test: an unapplied plan leaves the Character deep-equal; applying sets the level and every pick |
| AC-16 | App in the browser | `layout:check` Spells scenario after a seeded level-up: learn and swap controls present and working |
| AC-17, AC-18, AC-19, AC-20, AC-21 | Dice rules module with a fixed random source | `checks/` test: known faces give known totals, kept dice and dropped die; reroll clears placements |
| AC-22, AC-31 | App in the browser | `layout:check` scenarios: an attack, its damage, a check, a save and a skill roll with the expected bonus; advantage shows two d20s |
| AC-32, AC-24 | App in the browser | `layout:check` scenarios: the floating button visible on the sheet and in both flows at all four widths, the tray rolls a pool; log entries name character and source |
| AC-23 | Dice rolls from the sheet | `checks/` test: rolling an attack leaves slots, uses and ammunition unchanged |
| AC-25, AC-26 | Dice renderer and the 3D setting | Browser check: with 3D on, the text total appears before the animation ends and the faces match it; with 3D off or reduced motion emulated, no animation runs |
| AC-27 | Theme tokens | `checks/` test over every accent: computed WCAG ratios of each listed pair reach 4.5:1; `npm test` |
| AC-28 | Shared modal | `layout:check`: tapping the backdrop and pressing Escape close each modal; a work-discarding modal asks first |
| AC-29 | Shared modal on Android | `layout:android` with `ONLY` set to the modal scenarios: swipe down closes the sheet, background strip visible |
| Old saves | `migrateCharacter` | the existing character fixtures in `checks/` still load and evaluate unchanged |

## Out of Scope

- A light theme.
- Multiclassing during creation.
- Saving the Roll Log with the Character.
- Rolls that spend spell slots, feature uses or ammunition.
- New Details fields (backstory and appearance stay in the Journal tab).

## Open Risks

- The visual system: resolved by map ticket 04 (two-tone accents, base fixes, Source Serif 4 for names and titles, sheets and dialogs by width, wide layouts). `DESIGN.md` is written from the built result; until then ticket 04's answer holds the values.
- The dice technique: resolved by map ticket 02 as 2.5D dice with Reanimated transforms (no WebGL). Still to measure: the real bundle delta (`npx expo export`) and Reanimated 4.5.1 against the SDK 57 library list.
- How the Level-Up Flow, the dice tray and the roll triggers on Actions and Stats look and behave: map ticket 05.
- How the visual system reaches the Home list, Options and the sheet's tabs (beyond ticket 04's wide-screen rules): map ticket 20. Where the Roll Log sits: map ticket 05.
