# 02: An Inventory module

**What to build:** `src/rules/inventory.ts` owns the transitions now in `src/components/tabs/InventoryTab.tsx` (~110-260). Each takes the character and returns the next character, or, for the attunement limit, says that a swap is needed:

- **Equipping:** `toggleEquipped(character, itemId)`.
- **Quantity:** `changeItemQuantity(character, itemId, delta)` (an item at 0 is removed) and `removeItem(character, itemId)`.
- **Attunement:**
  - `ATTUNEMENT_LIMIT` (3, the SRD rule).
  - `toggleAttunement(character, itemId)` returns `{ character } | { swapNeeded: true }` when the limit is reached.
  - `swapAttunement(character, unattuneId, attuneId)`.
- **Coins:** `changeCoin(character, coin, delta)` and `setCoin(character, coin, text)`. Both keep today's rules: never below 0, and a non-number sets 0.
- **Items:** `itemFromCatalog(record)` and `customItem(fields)` build the `InventoryItem` as the tab does today. That includes the custom item's "+N in the name" bonus, `armorCategoryOfType`, and the id from `makeItemId`.

The tab keeps its modal and form state and calls these. Behaviour is unchanged. Add `checks/inventoryTabGuard.test.ts`, in the style of `checks/spellsTabComponents.test.ts`: `InventoryTab.tsx` builds no `InventoryItem` literal and does not map over `items` to change them.

**Blocked by:** 01

**Status:** done

**Landed:** merge 413d584 (13d370e, 4c9a06e).
- **Module:** `src/rules/inventory.ts` holds the item, quantity, attunement (limit 3, swap) and coin transitions, plus `itemFromCatalog`, `customItem`, and an `addItem` beyond the list. `makeItemId` moved here.
- **The tab:** InventoryTab only calls it, and went from 1084 to 1007 lines. Behaviour is unchanged.
- **Tests:** 12 in `checks/inventory.test.ts`, and a 4-rule guard in `checks/inventoryTabGuard.test.ts` that was red on the old tab.
- check:all passed; `ONLY=Inventory` at 393 passed, SRD and integrated.

- [x] Tests, `checks/inventory.test.ts`:
  - toggle equip both ways
  - quantity +1, and −1 at 1 removes the item
  - attune up to 3; a 4th returns `swapNeeded`; swap moves attunement; unattune
  - a coin never goes below 0; `setCoin` with `"abc"` gives 0
  - `customItem` with "Longsword +1" and a damage sets `bonusWeapon` 1
  - `itemFromCatalog` keeps rarity, attunement and AC from the record
- [x] `npm run check:all` passes.
- [x] Scoped layout: `ONLY=Inventory WIDTHS=393`, SRD and `-- --integrated`, green.
