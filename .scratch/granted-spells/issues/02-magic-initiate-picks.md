# 02: Magic Initiate picks

**What to build:** The pick mechanism, end to end, with Magic Initiate. In the feat picker (level-up and origin feat) the player chooses the class, then the two cantrips and the 1st-level spell, from the spells of the active books that match the grant's filter. Picks are saved as rule choices keyed by the granting source, so two sources never collide. Removing or swapping the feat releases its picks and raises a review notice, as Fighting Initiate does; a required pick not yet made shows a "needs review" notice and that part of the card is absent. The card shows the picked cantrips at will and the 1st-level spell once per long rest, titled by the feat and the class, with the ability that matches the class.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-ad35bb447bcdabbec` (tip 02d88b1). `check:all` passes (1306 app, 251 scraper); `check:live` 69/69; layout scenario "Builder Class feat spell picks" green (integrated, all widths; 320 screenshot viewed). Picks are made on the held feat's card (like Fighting Initiate), not before adding the feat. Strixhaven (ability choice) and school filters are ticket 03. Open items: no layout scenario seeds the Spells-tab "Needs review" cards (ticket 09).

- [x] The reader supports a choice between named entries (the class) and a `choose` filter on class list and spell level with a count; nothing in app code names Magic Initiate.
- [x] Engine tests against an invented catalog: picking an entry then spells gives the card; an unpicked part gives a review notice and no entry; the offered spells are limited to active books and the filter; removing the feat releases the picks with a notice; swapping the feat releases them; two sources with picks never collide.
- [x] The feat picker shows the controls for the class and spell picks and saves them as rule choices; the controls use the shared UI components and CODING_STANDARDS §7.
- [x] `npm run check:all` passes. A short `ONLY=<name> WIDTHS=320 npm run layout:check` visit of the touched screen passes if the implementer added a scenario; the full layout run is ticket 09.
