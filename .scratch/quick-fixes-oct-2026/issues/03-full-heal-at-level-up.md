# 03: Full heal at level up, with an app setting

**What to build:** A new app setting "Full heal at level up", on by default. With it on, confirming a level-up sets the character's current HP to the new maximum and clears death saves. Temp HP and hit dice are left alone. With it off, level-up behaves as today. Interface copy is the setting's label only (CODING_STANDARDS section 8).

**Blocked by:** None (can start immediately)

**Status:** done
**Landed:** 8b91de9, check:all passed (831 app, 85 scraper) and layout:check green. Beyond the ticket: with the setting on, an ASI or feat that raises max HP lifts current HP only when the character was at full HP before the pick (decided by the main session). Not seen on a device.

- [x] Settings stored by older versions load with the setting on; no data migration is needed.
- [x] With the setting on, a level-up in single-class and multiclass cases sets current HP to the new maximum, including when the new maximum is raised by Constitution or a feat at that level.
- [x] Death saves are cleared by the full heal, and temp HP and hit dice are unchanged.
- [x] With the setting off, current HP is unchanged by level-up.
- [x] The setting appears in app settings with a plain label and no explanatory sentence, and fits at 320 px.
- [x] Tests cover the pure HP rule through the existing hit point functions and the setting's default.
- [x] `npm run check:all` and `npm run layout:check` pass.
