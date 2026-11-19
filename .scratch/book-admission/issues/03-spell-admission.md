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

**Status:** ready-for-agent

- [ ] Before changing the code, run the existing spell tests and record the count: `checks/spellcasting.test.ts`, `subclassSpells*`, `spellGrantsCharacterization.test.ts`, `spellPage.test.ts`, `learnableSpells*`. They must all pass after, unchanged, except where a test pins an empty book list as "every book"; say which.
- [ ] New tests:
  - `pickSpell` with a PHB and an SRD copy and books `["phb"]` gives the PHB copy.
  - With books `["XGE"]` and `activeOnly`, it gives the SRD copy.
  - An empty list admits SRD spells only, in the spellcasting reader at ~427.
- [ ] Paste `grep -nE "toUpperCase|SRD_SOURCE|activeBooks\??\.(includes|some)" ` over the four files. What remains must not be admission.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: `ONLY=Spells WIDTHS=393 npm run layout:check` green, SRD and `-- --integrated`.
