# 03: Starting Grants Reconciliation and Mode Switching

**What to build:** Allow players to switch between "Starting Gold" and "Starting Equipment" in the character builder without accumulating duplicate gold or leaving orphaned starting items in inventory. When a player switches from equipment to gold, previously granted starting equipment is removed from inventory and the appropriate class starting gold is deposited into the pouch. Conversely, switching back removes the starting gold grant and restores the chosen starting equipment.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Claiming starting equipment adds class equipment to inventory and records the grant mode.
- [x] Claiming starting gold adds class starting gold to the pouch and records the grant mode.
- [x] Switching between equipment and gold cleanly reconciles: old starting items/gold are removed, and new items/gold are applied without touching custom items or manually earned currency.
- [x] Clear UI indicators show which starting grant mode is currently applied.
- [x] Unit checks cover starting grant application, switching modes, and idempotency.
