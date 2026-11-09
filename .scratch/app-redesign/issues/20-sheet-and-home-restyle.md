# 20: Character sheet and Home in the new system

**Type:** prototype

**Blocked by:** 04

**Status:** open

## Question

How do the character sheet and the Home list look in the visual system of ticket 04, on a phone and at wide widths? The sheet's header (identity, Level up, Edit Build), its tab navigation (bottom tabs on phones, a left rail at 768px and up), one representative tab (Stats) in one and two columns, and the Home list with finished characters and drafts ("Draft · Background"). Several structurally different versions on a throwaway Expo route, coded by Mistral Large 4.

## Prototype

Branch `prototype/sheet-home` (commit `0a21755`, local, not pushed), route `/prototype-sheet-home`. Params: `screen=sheet|home`, `tabs=A|B|C` (phones: bottom bar 4 + More, bottom bar with all six, top tabs that fit), `header=A|B|C` (compact bar with a menu, identity card collapsing on scroll, header icons that move into the rail on wide screens), `wide=A|B|C` (one column, two columns, two columns plus a side panel at 1200px and up), `home=A|B` (list, grid on wide screens); a collapsible switcher changes them. Every layout at 768px and up uses a left rail. Screenshots at 360/768/1280: `.scratch/app-redesign/prototype-20/` on that branch. Owner's input before the prototype: the tab bar, the header rows and wide screens bother them most; Home rows keep the person icon, the row buttons and the Lvl badge and drop the HP badge. Waiting on the owner's picks.
