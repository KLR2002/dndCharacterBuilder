# 02: Compendium Category Filter Pills & Sourcebook Gating in InventoryTab

**What to build:**
Fix category browsing and search in the Compendium picker modal within `InventoryTab.tsx`. Align horizontal category filter pills directly with canonical `itemCategory` so that tapping *Rod*, *Wand*, *Scroll*, *Ring*, etc., displays all matching items without empty screens. Ensure searching "+1", "Warning", etc., works seamlessly, respect `activeBooks` toggles, and preserve new item metadata (`rarity`, `attunement`, `bonusWeapon`, `bonusAc`, `itemCategory`) when adding items from the compendium into the character's inventory.

**Blocked by:** 01-ingestion-pipeline-magic-variants-expansion-and-type-normalization

**Status:** closed

- [x] In `InventoryTab.tsx`, update filter pills to match canonical `itemCategory` (`"All"`, `"Weapon"`, `"Armor"`, `"Shield"`, `"Potion"`, `"Ring"`, `"Rod"`, `"Wand"`, `"Scroll"`, `"Staff"`, `"Wondrous Item"`, `"Adventuring Gear"`, `"Tool"`)
- [x] Update `filteredLibraryItems` logic to compare against `item.itemCategory` rather than raw type substrings
- [x] Verify clicking "Wand", "Rod", "Scroll", "Ring" displays matching items and never an empty list when items exist
- [x] Ensure compendium search handles queries like "+1", "Warning", "Shield +1", and specific weapon names
- [x] In `addItemFromLibrary`, copy `rarity`, `attunement`, `bonusWeapon`, `bonusAc`, and `itemCategory` onto the created `InventoryItem`
- [x] Verify that items from disabled sourcebooks in `activeBooks` are properly filtered out of the compendium
- [x] Add unit tests in `checks/inventoryCompendium.test.ts` verifying category filtering and item addition to character inventory
