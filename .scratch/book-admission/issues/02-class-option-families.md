# 02: Class option families ask `admits`

**What to build:** Every book comparison in these files goes through `compendium.for(activeBooks).admits(source)` (or `catalogListings(...)`), with no `toUpperCase` on book codes, no `activeBooks.includes`/`.some`, and no `SRD_SOURCE` comparison used for admission:

- `src/rules/choices/warlockChoices.ts`: all sites, including Ritual Book eligibility `isSpellEligibleForRitualBook` (~200), which admits SRD by hand today. If the function takes no Compendium, add a parameter, or take the listings, and update its callers (`spellPage.ts`).
- `src/rules/choices/fightingStyles.ts`. The `heldSourceOf(..., { source: SRD_SOURCE })` fallback at ~53 is not admission; leave it.
- `src/rules/choices/maneuvers.ts`
- `src/rules/choices/artificerInfusions.ts` ~176: "TCE or ERLW is active" becomes `admits("TCE") || admits("ERLW")`. An empty list now offers no infusion, where it used to offer all.

Keep each function's signature unless it needs the Compendium or listings to ask `admits`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Before changing the code, write characterization tests for each family with `integratedTestCompendium()` and books `["PHB", "XGE", "TCE"]`: the names offered for Pact Boons, Eldritch Invocations, Fighting Styles, maneuvers and infusions. They must pass before and after.
- [ ] New tests for the agreed rule:
  - Books `[]`: no infusion offered, and no Fighting Style from a book.
  - Mixed-case books `["phb", "tce"]` give the same offers as `["PHB", "TCE"]`.
  - The Ritual Book offers an SRD-sourced spell with books `["PHB"]`.
- [ ] `grep -nE "toUpperCase|SRD_SOURCE|activeBooks\??\.(includes|some)" src/rules/choices/{warlockChoices,fightingStyles,maneuvers,artificerInfusions}.ts`: paste the output. What remains must not be admission.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: `ONLY="Class Choices" WIDTHS=393 npm run layout:check` green, SRD and `-- --integrated`.
