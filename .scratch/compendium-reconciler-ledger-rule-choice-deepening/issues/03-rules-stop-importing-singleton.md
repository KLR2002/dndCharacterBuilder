# 03: Rules modules stop importing the singleton (migrate batch B, then contract)

**What to build:** The choice modules, subclass spells, speed and tactical actions take the Compendium as a parameter. A guard test fails if any rules module imports the old singleton helpers. The dead `|| source === "SRD"` clauses are removed, and the Dual-Mode tests build explicit Compendiums instead of mutating the global.

**Blocked by:** 02

**Status:** done

- [x] No file under the rules layer imports the old singleton helpers (guard test: checks/rulesSingletonGuard.test.ts)
- [x] Dual-Mode tests construct SRD and integrated Compendiums side by side
- [x] Dead SRD-source clauses are removed
- [x] Existing suite passes (`npm run check:all`)
