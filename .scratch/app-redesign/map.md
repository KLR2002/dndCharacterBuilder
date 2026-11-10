# Map: App redesign

**Label:** wayfinder:map

## Destination

One spec, `.scratch/app-redesign/spec.md`, covering the Creation Flow, the Level-Up Flow, the visual system (`DESIGN.md`: themes, contrast, modals) and dice, ready for `/to-tickets` and `/implement-spec`.

## Notes

- Design skill: `/impeccable`. App UI is Operate mode. Impeccable needs `PRODUCT.md` (its `init`) before any redesign work.
- Coding goes to Mistral Large 4 as a T3 delegate (`docs/agents/subagent-tiering.md`); the main session plans and reviews (user, 2026-11-08). Prototype code included.
- Rules: 2014 5e only (`GLOSSARY.md`). Terms for this effort sit under "Building and rolling" in `GLOSSARY.md`.
- Gates: `npm run check:all`, `npm run layout:check`, and `npm run layout:android` for native-only changes (`AGENTS.md`).
- Grilling and spec decisions so far are recorded in the spec draft, `spec.md`, under "Decisions (verbatim)".
- Facts found while charting: one dark base theme plus 7 accent palettes (`src/constants/theme.ts`); crimson `#dc2626` on `#0a0a0c` is about 4.0:1 and `textMuted` `#64748b` fails AA too. The shared `src/components/ui/Modal.tsx` already closes on a backdrop press, but on phones it covers almost the whole screen. The builder is four freely switchable sections in `src/components/tabs/BuilderTab.tsx`; no level-up flow exists.

## Decisions so far

- Charting: one map toward one spec; dice is its own branch of it.
- Charting: Creation Flow order is Class (with a level picker, default 1) → Subclass → Race → Subrace → Background → Abilities → Class Choices → ASI/Feats → Spells → Equipment → Details → Review; steps that do not apply are skipped.
- Charting: creation is single-class; Multiclassing enters only through the Level-Up Flow.
- Charting: finished steps can be revisited, later steps are locked; changing an earlier pick releases invalidated later picks and flags their steps.
- Charting: the Builder tab is replaced by Level up and Edit Build on the character header; Edit Build can lower levels, only Level up adds them.
- Charting: Level-Up Flow is Class → Hit Points → Subclass → ASI/Feat → Class Choices → Spells → Review, applied at once on confirm; the Spells tab keeps learning and swapping spells.
- Charting: drafts resume at their step; no sheet until Review; old characters count as finished.
- Charting: Details holds only name (required), gender and alignment.
- Charting: Rolled Abilities is 4d6 drop lowest, six times, placed like Standard Array, unlimited rerolls.
- Charting: rolls come from Rolled Abilities, the Actions tab (attack, damage doubled on a crit), the floating dice button, the Stats tab (checks, saves, skills) and level-up Hit Points; every d20 Roll offers advantage and disadvantage; rolls spend nothing.
- Charting: one session Roll Log, each entry naming the character and source.
- Charting: the floating dice button is on every screen, visible on the character sheet; only an open modal's overlay covers it.
- Charting: text result always; 3D dice optional in Settings, off under reduced motion; the lightest technique wins; dice follow the current accent.
- Charting: WCAG AA (4.5:1 text, 3:1 UI and large text) for every accent, enforced by an automated check; dark only.
- [01: Product context for the redesign](issues/01-product-context.md): `PRODUCT.md` written; players preparing and at the table, free/offline and phone-first, platform android.
- [02: Dice rendering technique](issues/02-dice-rendering-technique.md): 2.5D dice with Reanimated transforms, tinted by accent, landing on the predetermined face; scripted 3D is the upgrade path.
- Charting: modals become bottom sheets on phones (backdrop strip, swipe down to close) and close on Escape on web, as part of the visual system.
- [03: Creation Flow and visual direction prototype](issues/03-creation-flow-prototype.md): variant B, step chips plus an identity bar that opens a bottom sheet; Character Select layout with the existing themes; no non-deciding facts on choice rows; wide screens get a designed layout.
- [04: Visual system](issues/04-visual-system.md): existing themes kept and fixed for AA with two tones per accent (saturated fill, bright ink); Source Serif 4 for names and titles; sheets on phones, dialogs on wide; designed wide layouts; contrast check over every accent.
- [05: Level-Up Flow and dice prototype](issues/05-level-up-and-dice-prototype.md): pool-builder tray; tap a bonus to roll, hold for a Disadvantage / Roll / Advantage sheet; a result card above the dice button, Roll Log as a tab in the tray; Level-Up Flow in the Creation Flow's layout.
- [20: Character sheet and Home](issues/20-sheet-and-home-restyle.md): all six tabs in one bottom bar on phones; compact header with a menu on phones, header actions in the left rail at 768px and up; two columns on wide screens; Home a list on phones, a grid on wide screens.
- [21: Character sheet and Home restyle](issues/21-sheet-and-home-build.md): build ticket for ticket 20's picks, ready-for-agent.
- [22: Builder and flow overflows at wide widths](issues/22-wide-builder-overflows.md): 13 pre-existing violations at 768/1280; wide widths join the default layout run. ready-for-agent.
- Build: tickets 06-14 landed on `feat/app-redesign` at `a7a1e85`, gate PASS (`evidence.md`). Tickets 15-19 landed at `cf714f8`, gate PASS (`evidence.md`, "Tickets 15-19"). Tickets 05 and 20 resolved; ticket 21 (sheet and Home restyle) is ready-for-agent.

## Not yet specified

- Screens that no ticket designs yet once the sheet and Home are settled (Options, the first-run screen, catalog sync): revisit after ticket 20.

## Out of scope

- A light theme.
- Multiclassing during creation.
- Saving the Roll Log with the Character.
- Rolls that spend spell slots, feature uses or ammunition.
