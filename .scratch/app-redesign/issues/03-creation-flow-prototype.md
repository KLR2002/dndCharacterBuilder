# 03: Creation Flow and visual direction prototype

**Type:** prototype

**Blocked by:** 01

**Status:** resolved

## Question

What do the Creation Flow and the app's new visual direction look like? Several very different versions of the flow (step rail, Class step with its level picker, a choice step, Rolled Abilities, Review) on a throwaway Expo route, switched by a URL param on the web build, built with `/impeccable`.

## Answer

Variant B, "Step chips + character drawer": a slim top bar of horizontally scrolling step chips (finished steps tappable with a check, the current one in the accent, locked ones dim with a lock, steps needing attention marked), the step's choice list filling the screen, and a one-line identity summary above the primary action that opens the full character panel in a bottom sheet. The user: "I think B it's nice meet in the middle".

Visual direction: Character Select (cRPG creation screen), taken for its layout. Colours stay the app's existing dark base and accent palettes, adjusted to AA in ticket 04 and 11. The serif on titles stays provisional.

Corrections from the user's review:
- "please refrain from unnecesery description like subclass level on class choices or speed info on race choices": choice rows and their opened details show only what tells the options apart for that decision.
- "i know we focus more on mobile, but sheet looks terrible at wider screen, remember about that": every surface has a designed wide layout (≥768px), not a stretched phone column. How the step chips, the list and the identity sheet adapt at wide widths is part of ticket 04.

Known prototype rough edges not to carry over: the dice button took its own row above the primary action (it floats over the content); the empty identity panel was tall and mostly dashes.

Prototype: branch `prototype/creation-flow` (commit `ac9e7ff`, local, not pushed), route `/prototype-creation-flow?variant=A|B|C`, run with `npm run prototype:creation`. Not merged into main.
