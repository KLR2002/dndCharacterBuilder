# 06: Character Sheet Spells, Features & Inventory Mobile Polish

**What to build:** In `SpellsTab.tsx`, `FeaturesTab.tsx`, and `InventoryTab.tsx`, equip high-frequency toggles (spell slot checkboxes, hit dice, and resource counters) with ≥40px `hitSlop` to prevent mis-taps. Ensure the multiclass spellcasting profiles switcher wraps cleanly. Optimize inventory item cards, quantity steppers, and encumbrance bars for 320px screens.

**Blocked by:** 01-responsive-layout-foundation

**Status:** ready-for-agent

- [ ] In `SpellsTab.tsx`, apply `hitSlop` to spell slot checkboxes and ensure the spell profiles switcher wraps cleanly on small screens.
- [ ] In `FeaturesTab.tsx`, apply `hitSlop` to resource pool counters (Sorcery Points, Ki, Channel Divinity, Rage, Wild Shape).
- [ ] In `InventoryTab.tsx`, format item rows and carrying weight progress bar cleanly on 320px viewports.
- [ ] Verify zero TypeScript errors, zero lint errors, and 132/132 unit tests passing.
