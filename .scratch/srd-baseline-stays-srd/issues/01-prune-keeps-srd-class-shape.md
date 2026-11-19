# 01: The prune keeps the SRD class shape

**What to build:**

- **A testable prune.** Move the class step of `scripts/prune-to-srd.mjs` into a pure function `pruneClasses(rawClasses)` in a new TypeScript module `scripts/srdBaseline.ts`, and have the script import it. Node 24 strips types, so the `.mjs` script can import a `.ts` file.
  - If `npm run lint`, `typecheck` or `typecheck:checks` need `scripts/` added to a config, add it.
  - If importing `.ts` from the script does not work, say why and pick the nearest working form.
- **`pruneClasses` does what the script does today, plus three rules:**
  - Keep: the SRD archetype filter, and source `"SRD"` on each class and kept subclass.
  - Every class's `description` becomes `""`. The PHB intro prose is non-SRD (ADR 0014).
  - Every option in a feature's `choices.options`, on class and subclass features, gets source `"SRD"`.
  - Every option in a subclass's `spellChoice.options` gets source `"SRD"`.
- **Regenerate.** Run `node scripts/prune-to-srd.mjs`. Restore `src/data/summary.json` if only its timestamp changed. The `src/data` diff must be exactly:
  - Ranger Hunter: 16 features become 5, with folded choices carrying SRD sources.
  - Circle of the Land: a `spellChoice`.
  - Way of the Open Hand: `additionalSpells[0].ability`.
  - Grappler: the bullet spacing in `feats.json`.

  Anything else means the scraper data drifted. Stop and report it.
- **The guard test.** In `checks/featureOptionsDescription.test.ts`, "Dual-Mode: SRD features render unchanged, with no folded options":
  - Replace "no SRD feature has `choices`" with "every folded option in the SRD Baseline has source `SRD`".
  - Keep the render check for features without choices.
  - Rename the test to match.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests (`checks/srdBaseline.test.ts`, feeding `pruneClasses` a small raw input):
  - A class description becomes `""`.
  - A non-SRD subclass is dropped.
  - A folded option and a `spellChoice` option become source `SRD`.
- [ ] Tests on the regenerated baseline, through the function the Class Choices step reads (find it from `src/rules/classChoices.ts`):
  - An SRD Ranger 3 Hunter is offered one Hunter's Prey pick of Colossus Slayer, Giant Killer and Horde Breaker, with the PHB book switched off.
  - An SRD Ranger 7 Hunter also gets Defensive Tactics.
  - The Features tab text for Hunter's Prey lists the three options: `describeClassFeature` with the SRD source and default books.
  - A saved SRD Ranger 5 Hunter made before this change loads through `migrateCharacter` and reconciles without error, and its Hunter's Prey pick is pending.
- [ ] Paste the `git diff --stat src/data` and the Hunter's feature names after the run.
- [ ] `npm run check:all` and `npm run check:live` pass.
- [ ] Scoped layout: find the scenarios that seed a Ranger (`grep -rn "Ranger" checks/layout`) and run them at `WIDTHS=393`, SRD. If one shows the Class Choices step for a Ranger at level 3 or above, open its screenshot and describe the Hunter's Prey pick. If none does, add `Class Choices SRD Hunter` (a Ranger 3 Hunter in the builder's Class Choices step, seeded the way the other Class Choices scenarios are) and describe its screenshot.
