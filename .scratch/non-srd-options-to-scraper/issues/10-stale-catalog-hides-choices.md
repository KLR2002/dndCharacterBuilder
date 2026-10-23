# 10: A stale catalog hides the choices that need the new fields

**What to build:** Ticket 01 adds the catalog format number and a stale flag. Tickets 02 and 06 hide a choice only when the catalog has no `choices` or no `AI` records. A catalog synced before the change can still hold infusion records without the umbrella flag and without Replicate Magic Item rows, so those are not detected as missing. The Compendium (or the Rule Choice reader) reads the stale flag, so the Totem choices and the Infusions Known choice are hidden whenever the loaded catalog is stale, and saved picks are kept. Every other behaviour is unchanged.

**Blocked by:** 01, 02, 06

**Status:** done

**Landed:** merge `3267d1d`.

- [x] A stale catalog offers no Totem choices and no Infusions Known choice, even when old records exist
- [x] A catalog at the current format offers them as before
- [x] The SRD Baseline is never stale and its behaviour is unchanged
- [x] Saved picks are untouched in both cases
- [x] Tests at the Rule Choice interface seam cover stale, current and SRD
- [x] Existing suite passes (`npm run check:all`)
