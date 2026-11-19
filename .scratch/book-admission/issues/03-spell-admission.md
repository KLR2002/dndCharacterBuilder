# 03: Spell readers ask `admits`

**What to build:** Every book comparison in these spell readers goes through the listings' `admits`:

- `src/rules/spellcasting.ts` ~427, ~455
- `src/rules/subclassSpells.ts`:
  - `pickSpell` ~59. It prefers a copy from an active book, then, with `activeOnly`, an SRD copy, then the first copy. Keep that order. "From an active book" means admitted and not `"SRD"`, so an SRD copy never wins over an active book's copy.
  - ~284, ~715, ~740/749
- `src/rules/spellGrants.ts` ~168: feat ordering, "active book first".
- `src/rules/choices/featSpells.ts` ~720

These functions take `activeBooks` and often a Compendium. Where one has no Compendium, add a parameter defaulting to `currentCompendium()` rather than reworking its callers.

**Blocked by:** 01

**Status:** done

**Landed:** merge 2abe67d (3f91170).
- **Spell readers:** `isSpellAvailableForClass` takes an optional Compendium and asks `admits`, for the spell's book and for variant grants. `pickSpell` (exported) takes the listings; an active copy is admitted and not SRD.
- **Feats:** `featOfSelection` ranks feats by `admits`; `featSwitchedOff` asks `admits`. Callers pass their Compendium, including `BackgroundSection`.
- **Decided in review: gating fixtures.** Eight pre-existing gating tests used in-memory compendia holding non-SRD books while flagged non-integrated, a state the app never reaches. Those fixtures are now integrated, with assertions unchanged.
- **Decided in review: baseline re-record.** `subclassChoiceBaseline.json` re-recorded for one SRD-fixture row (Genie, Mystic Arcanum 17). The expanded list used to be read from the process-wide Compendium, not the caller's; it now comes from the same bundle. A probe on the real SRD Baseline gives identical offers before and after.
- **Tests:** 6 in `checks/spellBookAdmission.test.ts`.
- check:all, check:live, and `ONLY=Spells` at 393 passed, SRD and integrated.

- [x] Before changing the code, run the existing spell tests and record the count: `checks/spellcasting.test.ts`, `subclassSpells*`, `spellGrantsCharacterization.test.ts`, `spellPage.test.ts`, `learnableSpells*`. They must all pass after, unchanged, except where a test pins an empty book list as "every book"; say which.
- [x] New tests:
  - `pickSpell` with a PHB and an SRD copy and books `["phb"]` gives the PHB copy.
  - With books `["XGE"]` and `activeOnly`, it gives the SRD copy.
  - An empty list admits SRD spells only, in the spellcasting reader at ~427.
- [x] Paste `grep -nE "toUpperCase|SRD_SOURCE|activeBooks\??\.(includes|some)" ` over the four files. What remains must not be admission.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Scoped layout: `ONLY=Spells WIDTHS=393 npm run layout:check` green, SRD and `-- --integrated`.
