# 21: Picks on a grant id shared by two class prints are kept

**What to build:** A saved Proficiency Choice pick stays when its grant id is produced by two same-named classes from different sources (the 2014 and 2024 prints both list the same subclass), as long as the character holds either class.

**Blocked by:** None

**Status:** done

**Landed:** merged from `pr/22-shared-subclass-owner` (4697fc8, merge 355b874). Found by the owner: with the catalog the in-app sync builds (30 classes), Kensei, Samurai and every other subclass listed under both prints of its class had each pick released at once with "no longer granted", because the owner map kept one owner per grant id and the last (2024) class lost to the held (2014) class. `grantSourcesIn` now keeps every owner per id and a pick is released only when none is held; alias migration reads every owner's aliases. `check:all` passes (1110 app tests, 144 scraper tests, 322 known type errors none new). Replay of the owner's Fighter/PHB Samurai + Monk/PHB Kensei against the live-mirror catalog: before, all four choices released; after, all kept. 71 grant ids collide in the live catalog, all subclass-owned. Open items: one stored pick is shared by both prints of an id, and the two prints' pools were not compared; no test runs the in-app scraper output (the tracked data has 17 classes, the live catalog 30), so a duplicate-print shape can still escape; non-proficiency subclass rule-choice ids were not examined beyond this replay.

- [x] A character holding either print keeps its pick through a pick and a reconcile, covered with invented classes.
- [x] A character holding neither print still has the pick released with a notice.
- [x] An alias saved on only one print migrates.
- [x] `npm run check:all` passes.
