# 12: Totem Warrior Tiger and the Kensei rule from the Catalog

**What to build:** The Totem Warrior Tiger grant applies when the Aspect of the Beast pick that gates it is made, with the gate's data coming from the Catalog and not from an app table. The Kensei weapon rule is recognised by the shape of its grant (a weapon choice on a subclass feature whose pick also marks a Monk Weapon), declared in the data, and the subclass name is no longer in app code.

**Blocked by:** 07, 11

**Status:** ready-for-agent

- [ ] The Totem Warrior option table and the Kensei subclass name constant are deleted from the app.
- [ ] The Tiger proficiencies apply only with the Aspect of the Beast pick, and are released with a notice when the pick changes, covered by a test.
- [ ] Kensei weapon picks are Monk Weapons, held weapons are still offered, and the Kensei tests stay green.
- [ ] Another subclass whose data declares the same grant shape would behave the same, covered by a test with an invented subclass.
- [ ] Data changed only through the enrich step and the prune script; the coverage gate stays green.
- [ ] `npm run check:all` passes.
