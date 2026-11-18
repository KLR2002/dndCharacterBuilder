# Spec: The Class Choices step reads one view

**Status:** done (pending the full layout gate)

Decided with the user on 2026-11-18 (architecture review candidate 3). Builds on `.scratch/feat-slot/` (ADR 0023).

## Problem

- `src/rules/classChoices.ts` (`classChoicesAtLevel`) is the shared reader both flows use for "which choices does this class bring": the Creation Flow's skip and completeness of the Class Choices step (`src/rules/creationFlow.ts` ~202, ~255, ~293) and the Level-Up Flow's `plan.classChoices`. `src/components/builder/ClassProgressionSection.tsx` (1222 lines, 25 props, hosting the Class, Subclass, Class Choices, ASI/Feats and Equipment steps behind `step` checks) does not read it: its Class Choices part (~556-780) assembles `offeredRuleChoices` + `proficiencyChoiceOffers` (origins class, subclass **and feat**) + `skillPickOffers` itself, so the screen and the gate can disagree (a feat's skill pick can sit in a step the gate skipped).
- The part sorts choices into five cards by id substring (`id.includes("Fighting Style" | "Blessed Warrior" | "Druidic Warrior" | "Maneuver" | "Superior Technique" | "Pact Boon" | "Pact of the Tome" | "Ancient Secrets" | "Mystic Arcanum")` plus `isManeuverChoiceId`, `isInvocationChoiceId`, `isInfusionChoiceId`), each card with an explanatory subtitle.
- Expertise (~783-870) and optional features (~923+) render in the same step but count for nothing, and the Level-Up Flow offers neither: a Rogue reaching 6 gets the Expertise pick only through Edit Build. The Level-Up Class Choices step (`src/components/levelUpFlow/ClassChoicesStep.tsx`) is a flat list without groups or chosen-option descriptions.

## Decisions

1. One view, `classChoicesStepView` in `src/rules/classChoices.ts`, extends `classChoicesAtLevel`: skill picks, rule choices by group, proficiency choices, Expertise picks, optional features, and `complete`. Unpicked Expertise makes the step incomplete; optional features never do. The Creation Flow's skip and completeness read it.
2. Each choice builder tags its choices with a `group` (`"fightingStyle" | "maneuver" | "warlock" | "infusion"`, else `"other"`) where it builds them; nothing groups by id text. The card subtitles go; titles and badges stay.
3. A feat's proficiency choices (Skilled, Skill Expert) leave the class view and show with the feat: the Feat Slot module reports them, the feat cards render them, and they never block confirming a feat.
4. `ClassProgressionSection` splits into one component per Creation Step it serves; the Class Choices part becomes `ClassChoiceCards`, fed by the view.
5. The Level-Up Class Choices step renders `ClassChoiceCards` from the view for the new level, and its plan holds the new level's Expertise picks and optional-feature toggles, applied at Review.
6. The class starting skill pick (`toggleSkill`, `skillChoices`, `autoGranted` from `BuilderTab`) passes through unchanged; candidate 7 moves it.

## Tickets

1. `01-choice-groups-from-builders.md`
2. `02-class-choices-step-view.md`
3. `03-feat-proficiency-choices-with-the-feat.md`
4. `04-split-class-progression-section.md`
5. `05-level-up-class-choice-cards.md`
6. `06-level-up-expertise-and-optional-features.md`
7. `07-level-up-replans-choices-on-subclass-pick.md`: found during 05.
