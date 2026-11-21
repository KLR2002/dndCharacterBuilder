# 01: One definition of equipped

**What to build:**

- **On load.** In `src/rules/migrateCharacter.ts`, every inventory item gets `isEquipped: item.isEquipped === true || item.section === "equipped"`, and `section` is removed from the item.
- **The type.** Remove `section` from `InventoryItem` (`src/types/character.ts` ~153). Fix every writer:
  - `src/rules/startingEquipment.ts` (~134, ~420)
  - `src/rules/attacks.ts` (~375, the unarmed strike)
  - `src/rules/builderTransitions.ts` (~982-1041): the starting-equipment item list. Its local `section` becomes an `isEquipped` flag.
  - `src/components/ActiveInfusionsSection.tsx` (~97)
  - `src/components/tabs/InventoryTab.tsx` (~142, ~206, and the custom item's section picker)
  - the layout seeds in `scripts/lib/scenarios.mjs`, the e2e seed and any test fixtures
- **Readers.**
  - `ac.ts` (~65) drops its `section` condition.
  - The Inventory tab's equipped/carried lists split on `isEquipped`.
  - The custom item form's "Equipped / Carried" choice sets `isEquipped`.
- **The guard.** `checks/legacyFieldsGuard.test.ts` (ADR 0026) gains `section` on items only if the guard can tell an item's `section` from other uses; otherwise rely on the type. Say which.

**Blocked by:** None (can start immediately)

**Status:** done

**Landed:** merge 12c3c33 (a99d91f).
- **On load:** `migrateCharacter` marks an item equipped when either field said so, then drops `section`.
- **Writers:** `section` is removed from `InventoryItem` and from every writer: starting equipment, the unarmed strike, background equipment, infusions, the Inventory tab, seeds and about 22 test fixtures.
- **Readers:** armor needs only `isEquipped`.
- **Typecheck baseline:** re-recorded with 66 deletions and no additions, because previously invalid fixtures now type-check.
- **Guard:** none added. A generic `section:` key can't be told apart, so the type does the work.
- **Tests:** 4 in `checks/equippedItems.test.ts`, 3 of them red before.
- check:all, check:live, and `ONLY` Inventory and Actions at 393 passed, SRD and integrated. The screenshot shows the Shield equipped.

- [x] Tests, `checks/equippedItems.test.ts`:
  - An old save's armor with `section: "equipped"` and `isEquipped: false` loads equipped, and `armorClass` counts it. Before this change it did not; show it red.
  - An item with `isEquipped: true` and `section: "carried"` loads equipped.
  - A loaded item has no `section`.
  - An old save's weapon with only `section: "equipped"` is listed by the attacks.
- [x] `grep -rn "section: \"\(equipped\|carried\)\"\|\.section ===" src scripts checks` shows no item `section` left; paste it.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Scoped layout: `ONLY=Inventory WIDTHS=393` and `ONLY=Actions WIDTHS=393`, SRD and `-- --integrated`, green. Open an Inventory screenshot and describe the Equipped and Carried lists.
