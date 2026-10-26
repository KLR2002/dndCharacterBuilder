# 06: Jack of All Trades and Remarkable Athlete apply to initiative; Remarkable Athlete on skills

**What to build:** Initiative is a Dexterity check, so the two half-proficiency rules reach it. A Bard of level 2 or higher adds half the proficiency bonus (rounded down) to initiative. A Champion of level 7 or higher adds half the proficiency bonus (rounded up) to initiative and to Athletics, Acrobatics, Sleight of Hand and Stealth that they are not proficient in. When a character has both, only the higher applies, on initiative and on skills. Each appears as its own line in the initiative breakdown. Both rules are SRD content and stay in code, matched on class and level the way Jack of All Trades already is for skills. Jack of All Trades on skills already works and must not regress.

**Blocked by:** 01

**Status:** done

**Landed:** fast-forward of `worktree-agent-a4fd978886c42b31d` (tip 02fe3e5). `check:all` passes (1252 app, 209 scraper); `check:live` 59/59. One helper (`halfProficiencyFor`) serves skills and initiative; the higher rule wins, a tie is named Remarkable Athlete; the existing ½ indicator is reused. No baseline row changed. Open items: the skill list has no Constitution skill, so that clause has no visible effect today; the breakdown modal (ticket 05) is expected to show the new line, to verify at integration.

- [x] Initiative: a Bard 2+ gets floor(PB/2); a Champion 7+ gets ceil(PB/2); a Bard/Champion multiclass gets the larger, not the sum; neither applies below its level.
- [x] The breakdown shows a "Jack of All Trades" or "Remarkable Athlete" line after the Initiative Bonus lines, only when it contributes.
- [x] Skills: a non-proficient Athletics, Acrobatics, Sleight of Hand or Stealth gets Remarkable Athlete's ceil(PB/2); a proficient or expertise skill is unchanged; non-STR/DEX/CON skills are unaffected; with both rules the higher applies per skill; the existing Jack of All Trades skill test still passes.
- [x] The skill row exposes which rule applied so the Stats tab's existing Jack indicator can distinguish it, or the existing indicator is reused with no UI change if that is simpler; no new interface copy beyond the rule's name.
- [x] The skills characterization baseline is re-recorded only through its recorder variable if, and only if, an existing row legitimately changes; every changed row is explained in the report.
- [x] `npm run check:all` passes.
