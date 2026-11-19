# 03: One Eldritch Blast formula, one spell detail text

**What to build:**

- **One damage formula.** Every Eldritch Blast damage text reads `getEldritchBlastDamage` (`src/rules/attacks.ts:594`). It gives `"1d10 force"`, `"1d10 + 3 force"` or `"1d10 - 1 force"`. If importing `attacks.ts` from `spellPage.ts` creates an import cycle (`checks/rulesImportCycles.test.ts`), move `getEldritchBlastDamage` beside `hasInvocation` in `src/rules/choices/warlockChoices.ts` and re-export it from `attacks.ts`.
- **On the Spell Page:** each Eldritch Blast row, whether in the level list, an at-will card or a granted card, carries the damage text once in its subtitle when Agonizing Blast is held: `"… • 1d10 - 1 force"`. It also gets one badge, `"Agonizing Blast"` (tone accent). Today's badge is `"[Agonizing Blast: +N dmg]"`, which shows "+-1".
- **`spellDetailText(spell, character)`** in `src/rules/spellPage.ts` returns `{ title, subtitle, content }` for the detail modal. Move today's `showSpellDetail` formatting (`src/components/tabs/SpellsTab.tsx` ~476-500). The damage line `"• Damage: 1d10 - 1 force"` reads the same formula. Every detail opener in the tab uses it.

Delete `hasAgonizingBlast`, `chaModifier` and every `"eldritch blast"` comparison from `SpellsTab.tsx`.

**Blocked by:** 02

**Status:** done

**Landed:** merge 8ea6ab5 (6318424). Level rows, granted-card spells (`SpellPageGrantedCard`, a `blast` field per spell) and at-will cards carry the badge "Agonizing Blast" and the damage from `getEldritchBlastDamage`; `spellDetailText` serves the tab's detail openers, the Add Spells detail and the swap rows (the inscribe picker keeps its own Ritual/Classes text). The detail subtitle no longer repeats the damage. No node test covers the granted-card and at-will damage fields (no fixture grants Eldritch Blast that way). `ONLY=Spells` green at 320; check:all passed.

- [x] Tests:
  - A Warlock with Agonizing Blast and Charisma 8: the row subtitle ends with `"1d10 - 1 force"`, and `spellDetailText` has `"Damage: 1d10 - 1 force"`.
  - With Charisma 16: `"1d10 + 3 force"`.
  - Without the invocation: no damage text and no badge.
  - The Actions-tab attack (`tacticalActions.ts`) gives the same string.
- [x] `grep -n -i "eldritch blast\|agonizing" src/components/tabs/SpellsTab.tsx` prints nothing (paste it).
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Spells WIDTHS=320 npm run layout:check` is green (paste the summary line).
