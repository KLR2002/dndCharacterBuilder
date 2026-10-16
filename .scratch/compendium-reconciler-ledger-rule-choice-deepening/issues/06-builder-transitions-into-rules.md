# 06: Move builder-component transitions into the rules layer

**What to build:** Removing a class level (with skill-choice pruning), changing a subclass (with unlearning orphaned spells) and changing race become pure transitions in the rules layer that end in the Reconciler. The builder components call them instead of assembling state themselves.

**Blocked by:** 04

**Status:** done

- [x] Each transition is a pure function of character and inputs, tested without a component
- [x] Each ends in the Reconciler
- [x] Removing a class level reproduces the skill-pick pruning that the component does today
- [x] Changing subclass unlearns orphaned spells and clears the old subclass's dependents
- [x] Changing race clears race-origin choices and skill picks
- [x] Existing suite passes (`npm run check:all`)
