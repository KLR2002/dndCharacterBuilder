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

**Status:** done

**Landed:** merge 8157c56 (92073d1, d7ea10e, ad29864, 33bd6ca).
- **The router:** `hitPointPatch` lives in the new `src/rules/hitPointPool.ts`, because `wildShapeHp.ts` already imports `hitPoints.ts`. With no target, the pool is the form while one is active. The Stats tab handlers and `useHpQuickEdit` call it; the header keeps its explicit target.
- **Decided with the user after the first screenshot**, which showed the form's HP in two cards and hid normal HP: while a form is active, the Active Wild Shape card is the one place to act (Damage, Heal, and a new Temp HP field). The Hit Points card shows normal HP read-only (no buttons, no temp field, the number inert), with HP Settings kept. With no form, the card is unchanged.
- **New scenario:** `Stats Wild Shape HP` checks that both cards show their own pool. `checks/androidRunner.test.ts` counts `ONLY=Stats` scenarios and went from 5 to 6.
- **Tests:** 9 in `checks/hitPointPool.test.ts`, red first.
- check:all passed; `ONLY=Stats` passed at 393, SRD and integrated; `ONLY="Wild Shape"` passed, SRD.

- [x] Tests, `checks/hitPointPool.test.ts`:
  - Without a form, damage uses temp HP first, then current HP.
  - With a form of 10 HP:
    - Damage 4 leaves the form at 6 and normal HP unchanged.
    - Damage 14 ends the form and takes 4 from normal HP, as `damageWildShape` does.
    - Heal goes to the form, capped at its max.
    - Temp HP goes to the form.
  - With `target: "character"` during a form, damage changes normal HP.
- [x] `npm run check:all` passes.
- [x] Scoped layout: find the scenarios that show a Wild Shape (`grep -n "activeWildShape" scripts/lib/scenarios.mjs`) and run them with `ONLY=Stats`, at `WIDTHS=393`, SRD and `-- --integrated`, green. If no scenario shows the Stats tab during a form, add `Stats Wild Shape HP` and open its screenshot.
