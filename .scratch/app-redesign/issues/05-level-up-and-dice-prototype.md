# 05: Level-Up Flow and dice prototype

**Type:** prototype

**Blocked by:** 02, 04

**Status:** resolved

## Question

How do the Level-Up Flow, the dice tray behind the floating button, and the roll triggers on the Actions and Stats tabs (including the advantage and disadvantage choice and the crit damage roll), and the Roll Log (where it lives and how it reads), look and behave in the chosen visual system?

## Prototype

Branch `prototype/level-up-dice` (commit `e839022`, local, not pushed), route `/prototype-level-up-dice`, run with `npx expo start --web` on that branch. Params: `screen=levelup|actions|stats|tray`, `tray=A|B`, `trigger=A|B|C`, `result=A|B|C`, `levelup=A|B`; a collapsible switcher top-right changes them and can force the next d20 to 20 or 1. Brief, screenshots at 360/768/1280 and the flow checks (`verify.mjs`, all pass): `.scratch/app-redesign/prototype-05/` on that branch. Waiting on the owner's picks.
