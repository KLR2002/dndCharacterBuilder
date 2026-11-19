# 0026 Saved Picks Migrate on Load and Catalog Change, Not on Every Edit

## Context
Each time a pick moved to a new shape (Proficiency Choices, grant ids, Rule Choice ids, innate counters), a pass that moves the old shape was added to `reconcile`, which runs after every transition. Nine such passes ran on every edit, though no current transition writes their input. The only new input they see comes from outside the edit: a character saved by an older version, or a catalog whose grant ids changed (aliases), which appears on a sync.

## Decision
- One step, `migrateSavedPicks(character, compendium, activeBooks)`, holds every pass that moves a saved shape no current transition writes, including the SRD name rename.
- It runs when characters load, and in `reconcileForActiveBooks`. That runs when the active books or the catalog change, and when a character is opened, so a sync in session reaches every character as it is opened.
- `reconcile` keeps only the rules passes: releases, prunes and syncs that follow from the character's current state.
- A pass whose input a current transition still writes stays in `reconcile` until that writer is gone.
- A guard test names the files allowed to write the legacy fields (`chosenSkills`, `skillChoices`, `chosenTools`, `chosenLanguages`, ...). A transition that writes one fails it.

## Considered Options
Keeping the passes in `reconcile` was simple but ran them on every edit. Running them only on load would miss a catalog synced in session, whose aliases need moving before the next launch.
