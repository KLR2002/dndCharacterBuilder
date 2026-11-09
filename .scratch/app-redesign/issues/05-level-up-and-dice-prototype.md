# 05: Level-Up Flow and dice prototype

**Type:** prototype

**Blocked by:** 02, 04

**Status:** resolved

## Question

How do the Level-Up Flow, the dice tray behind the floating button, and the roll triggers on the Actions and Stats tabs (including the advantage and disadvantage choice and the crit damage roll), and the Roll Log (where it lives and how it reads), look and behave in the chosen visual system?

## Answer

The user: "1 - A, 2 - something between and c (i dont want this arrow next to attack roll, single tap - roll imidiately, hold - modal to chose adv/dis), 3 - A, 4 - [...] A looks nice".

- Dice tray: pool builder (variant A). A row of die buttons d4, d6, d8, d10, d12, d20, d100; each tap adds one die; the pool reads as an expression line with removable chips; a modifier with − and + steppers; Disadvantage / Normal / Advantage only for a pool of exactly one d20; one full-width primary action labelled with the pool ("Roll 2d6 + 1d8 + 3").
- Roll triggers on Actions and Stats: a tap on a bonus badge ("+6 to hit", a check, save or skill bonus) rolls at once with no advantage; holding it opens a roll sheet (the shared Modal) with Disadvantage, Roll and Advantage. No chevron or other extra control beside the badge, and no mode switch. A tap on a damage badge rolls the damage. Tapping a row still opens its details. Holding is not reachable by keyboard or screen reader, so the badge also exposes "Roll with advantage" and "Roll with disadvantage" as accessibility actions, and on web a keyboard path opens the same sheet.
- Results and Roll Log: result card (variant A). Each Roll shows a card just above the floating dice button (full width minus the gutters on phones, at most 360px at the bottom-right on wide screens) with the source ("Kara · Longsword attack"), the die faces (the dropped d20 struck through), the modifier and the total, "Natural 20" / "Natural 1" on d20s and "Critical" on critical damage. It stays until dismissed, replaced or about 8 seconds pass. After an attack it offers "Roll damage", or "Roll critical damage" after a natural 20. Tapping the card opens the Roll Log, a "Log" segment in the dice tray ("Dice | Log"), newest first.
- Level-Up Flow: the Creation Flow's layout (variant A). Step chips on phones; at 768px and up a step list on the left, the step in the centre and the identity panel on the right showing level and hit points before → after (the character as it stands before any pick). Class step: the current class first with only its level change ("4 → 5"), then the other classes with "1"; a class whose multiclass requirement is missed is disabled and shows only the missing score ("Int 13"). Hit Points step: Average (+8) or Roll (1d10+2), rolled once, logged as "Hit Points". Review lists what changes and confirms with "Level up"; Cancel asks before discarding.
- The floating dice button sits above a flow's primary-action bar on phones, never on its own row.

The user could not open the level-up screen from the prototype switcher (the screenshots and `?screen=levelup` show it); the prototype is thrown away, so this was not fixed.

## Prototype

Branch `prototype/level-up-dice` (commit `e839022`, local, not pushed), route `/prototype-level-up-dice`, run with `npx expo start --web` on that branch. Params: `screen=levelup|actions|stats|tray`, `tray=A|B`, `trigger=A|B|C`, `result=A|B|C`, `levelup=A|B`; a collapsible switcher top-right changes them and can force the next d20 to 20 or 1. Brief, screenshots at 360/768/1280 and the flow checks (`verify.mjs`, all pass): `.scratch/app-redesign/prototype-05/` on that branch.
