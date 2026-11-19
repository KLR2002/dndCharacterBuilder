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

**Status:** ready-for-agent

- [ ] Tests, `checks/inventory.test.ts`:
  - toggle equip both ways
  - quantity +1, and −1 at 1 removes the item
  - attune up to 3; a 4th returns `swapNeeded`; swap moves attunement; unattune
  - a coin never goes below 0; `setCoin` with `"abc"` gives 0
  - `customItem` with "Longsword +1" and a damage sets `bonusWeapon` 1
  - `itemFromCatalog` keeps rarity, attunement and AC from the record
- [ ] `npm run check:all` passes.
- [ ] Scoped layout: `ONLY=Inventory WIDTHS=393`, SRD and `-- --integrated`, green.
