---
version: 1
slug: "src-app-prototype-creation-flow-tsx"
primary_target: "src/app/prototype-creation-flow.tsx"
related_targets: ["src/components/tabs/BuilderTab.tsx"]
---

## Scope

The Creation Flow (and later the Level-Up Flow, which inherits it). Mode: Operate. Phone-first on Android, same design on web. Dark only.

## Audience and task

Players preparing a character, step by step from identity (class, race) to name. Steps and rules: `.scratch/app-redesign/spec.md`. Keep: the d20 icon, dark-only, the sheet's tab set. Feels wrong: fantasy costume (parchment, ornate borders, medieval display faces) and anything toy-like or gamified.

## Direction contract

THESIS: Creation as a cRPG character-creation screen: the character's identity is always on screen and fills in as the player chooses, instead of a form that reveals the character only at the end. Refuses the category default of a progress bar over an anonymous list.

OWN-WORLD: The app's existing themes: the dark base theme and its accent palettes from `src/constants/theme.ts`, adjusted to WCAG AA (map ticket 04, ticket 11), not a new palette. The user chose this direction for its layout, not its colours. The accent fills the primary action and marks the current selection (accent border, accent glow fill); text and headings stay neutral. One serif voice, semibold, for the character's name, class and step titles only; the system sans for every label, control and number, numbers tabular. Hairline-framed panels, 10px radius, no textures, no ornament.

STORY: The player sees who they are building at every moment, picks one thing per step from large rows, and watches the identity panel answer. They finish knowing the character before naming it.

FIRST VIEWPORT: Top: close action. Then the identity panel: class and level in the serif, three slots (race, background, subclass) with dashes until chosen, and a six-cell ability strip. Below: the step title and its choice rows (64dp, name left, key fact right), the current pick tinted ember. Bottom: full-width bronze primary action; dice button bottom-right above it.

FORM: cRPG character-creation screen, my first-ranked grounded candidate (taken as Impeccable's pick over the assigned graph-paper map). seed:d38285188543ea40

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decided after the prototype

- Navigation: step chips across the top (finished tappable, current in accent, locked dim, needs-attention marked); the choice list fills the screen; a one-line identity summary above the primary action opens the full character panel in a bottom sheet (variant B, branch `prototype/creation-flow`).
- Choice rows and opened details show only what tells the options apart (no subclass level on classes, no speed on races).
- Wide screens get a designed layout, not a stretched phone column.

## Unresolved

- How the chips, list and identity sheet adapt at tablet and desktop widths: map ticket 04.

- Which accent palettes stay and how each is adjusted to AA: map ticket 04.
- Whether the serif voice stays: judged on the prototype.
