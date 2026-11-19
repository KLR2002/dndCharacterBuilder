# 03: The Hit Point module decides the pool

**What to build:**

- **One function.** In `src/rules/hitPoints.ts` (or beside it, if an import cycle forces it), add `hitPointPatch(character, action, maxHp, target?)`:
  - `action` is `{ kind: "damage" | "heal" | "set" | "temp", amount }`.
  - `target` is `"character" | "wildShape"`. Without it, the pool is the form when `activeWildShape` is set, else the character.
  - Form pool: damage → `damageWildShape` (the excess carries over, as it does today), heal → `healWildShape`, set → `setWildShapeHp`, temp → `setWildShapeTempHp`.
  - Character pool: `damage`, `heal`, `setCurrentHp`, and temp HP as the Stats tab sets it today.
- **Callers.**
  - `src/components/tabs/StatsTab.tsx` (~180-198): Damage, Heal and temp HP call it with no target, so during Wild Shape they hit the form.
  - `src/hooks/useHpQuickEdit.ts`: `characterPatch` and `wildShapePatch` give way to it, keeping the hook's explicit target. The header's normal-HP box still edits normal HP.
- **The Stats tab's HP card.** While a form is active, check what the card shows next to the Damage and Heal buttons. If it shows normal HP while the buttons now change the form's, show the form's HP there, as the header does. Describe what you found and did.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests, `checks/hitPointPool.test.ts`:
  - Without a form, damage uses temp HP first, then current HP.
  - With a form of 10 HP:
    - Damage 4 leaves the form at 6 and normal HP unchanged.
    - Damage 14 ends the form and takes 4 from normal HP, as `damageWildShape` does.
    - Heal goes to the form, capped at its max.
    - Temp HP goes to the form.
  - With `target: "character"` during a form, damage changes normal HP.
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: find the scenarios that show a Wild Shape (`grep -n "activeWildShape" scripts/lib/scenarios.mjs`) and run them with `ONLY=Stats`, at `WIDTHS=393`, SRD and `-- --integrated`, green. If no scenario shows the Stats tab during a form, add `Stats Wild Shape HP` and open its screenshot.
