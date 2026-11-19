# Spec: Inventory and Hit Point transitions in the rules

**Status:** done (full layout gate pending)

Architecture review candidate #8 (2026-11-18). Decided with the user on 2026-11-19.

## Problem

- **"Equipped" has three meanings.** An item saves both `isEquipped` and `section` (`"equipped" | "carried"`), and older saves can disagree.
  - The Inventory tab lists an item as equipped when either says so (`src/components/tabs/InventoryTab.tsx` ~108).
  - Armor counts for AC only when both do (`src/rules/ac.ts` ~64-65).
  - Weapons and speed read `isEquipped` alone (`attacks.ts` ~162, ~275, ~352; `speed.ts` ~91).

  An old save can show armor as equipped that gives no AC.
- **Item transitions live in the tab.** `InventoryTab.tsx` (~110-260) holds equip, quantity, remove, the attunement limit of 3 and its swap, the coin changes, and the building of a library or custom item, all untested.
- **The Stats tab's HP buttons pick the wrong pool in Wild Shape.**
  - Damage and Heal (`src/components/tabs/StatsTab.tsx` ~183-189) always change normal HP.
  - Its temp HP button (~191-198) and the quick-edit hook (`src/hooks/useHpQuickEdit.ts`) change the form's.
  - The rules are already in `src/rules/hitPoints.ts` and `src/rules/wildShapeHp.ts`: damage hits the form and the excess carries over.
- **The AC badges parse a display string.** The Stats tab finds "(Defense)", "Enhanced Defense" and "Repulsion Shield" in `armorClass(...).breakdown` with regexes (~165-171) to show its "Defense +1" and "Infused +N" badges.

## Decisions

1. **One definition of equipped.**
   - On load, `migrateCharacter` marks an item equipped when either field says so, then drops `section`.
   - `section` leaves `InventoryItem`; every writer stops writing it.
   - Every reader asks `item.isEquipped`.
   - A conflicting old save can gain the AC or the attack its Inventory already showed.
2. **An Inventory module.** `src/rules/inventory.ts` owns the item and coin transitions and the attunement limit. The tab only calls it.
3. **A Hit Point module decides the pool.**
   - With a form active, Damage hits the form, with the excess carrying over, and Heal and temp HP go to the form.
   - Without one, they change normal HP.
   - The Stats tab and the quick-edit hook call one function. An explicit target (the header's normal-HP badge) still wins.
   - Refined with the user on 2026-11-19, after a screenshot: while a form is active, the Active Wild Shape card is the one place to act on it (Damage, Heal, Temp HP). The Hit Points card shows normal HP read-only.
4. **The AC result carries its parts.** `armorClass` returns structured parts beside the text, and the Stats tab reads them, not the string.

## Tickets

1. `issues/01-one-definition-of-equipped.md`
2. `issues/02-inventory-module.md`
3. `issues/03-hit-point-pool.md`
4. `issues/04-armor-class-parts.md`
