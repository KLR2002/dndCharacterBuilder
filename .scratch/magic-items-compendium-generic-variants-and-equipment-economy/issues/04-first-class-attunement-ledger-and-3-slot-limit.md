# 04: First-Class Attunement Ledger & 3-Slot RAW Limit

**What to build:**
Implement a complete Attunement Ledger for magic items according to 2014 RAW rules. Track `attunement?: boolean | string` and `isAttuned?: boolean` on `InventoryItem`. Render an `Attuned: X / 3` indicator in `InventoryTab.tsx` with a 1-tap attune/unattune toggle on items requiring attunement. Present an interactive modal when the player attempts to attune a 4th item at 3/3 capacity, allowing them to select an attuned item to swap or cancel. Strictly gate magical properties in `attacks.ts` and `ac.ts` so items requiring attunement only confer bonuses when `isAttuned === true`.

**Blocked by:** 02-compendium-category-filter-pills-and-sourcebook-gating, 03-combat-economy-engine-weapon-and-armor-enhancement-bonuses

**Status:** closed

- [x] In `src/types/character.ts`, add `attunement?: boolean | string`, `isAttuned?: boolean`, and `rarity?: string` to `InventoryItem`
- [x] In `InventoryTab.tsx`, display `Attuned: ${attunedCount} / 3` in the inventory header
- [x] Render an "Attune" / "Unattune" button on carried and equipped items that specify `attunement`
- [x] When attempting to attune when `attunedCount >= 3`, present a replacement modal listing currently attuned items to unattune, or cancel
- [x] In `src/rules/attacks.ts` and `src/rules/ac.ts`, verify that items with `attunement` only grant `bonusWeapon` or `bonusAc` when `isAttuned === true`
- [x] Display an `[Unattuned]` badge on weapon attack cards and item rows when equipped without active attunement
- [x] Add unit tests in `checks/attunement.test.ts` verifying attunement toggling, 3-slot cap enforcement, and strict combat math gating
