# 28: Claiming class equipment takes one option per slot

**What to build:** Owner request. The rules half. A claim of starting equipment grants the class's fixed items plus the items of the one option the player picked in each slot, and nothing else. Today `applyStartingGrants`/`reclaimStartingGrants` (`src/rules/builderTransitions.ts`) grant the whole `CLASS_STARTING_EQUIPMENT` table. Replace that table with the class's `startingEquipment` slots from the catalog (ticket 27) and let the player's picks decide the items.

**Blocked by:** 27

**Status:** ready-for-agent

## Design notes

- A new rules module (for example `src/rules/startingEquipment.ts`) owns: reading the first class's slots from the compendium (resolve the class entry the way other rules resolve the character's class; if the character's class has several prints, use the one the character's class entry names, otherwise the first with slots), resolving a generic entry to the catalog items of that type, turning a set of picks into `InventoryItem[]`, and saying whether the picks are complete.
- Picks live on the character, by stable slot id (ticket 27's ids): which option letter each slot took, and for each generic entry the chosen item name(s) (a quantity of 2 needs two picks; the same item may be picked twice). Add the field to the `Character` type with a safe default for old saves, and keep it in the save/export paths the other character fields use. A changed class clears the picks.
- Generic resolution over `ItemData` (names are the key; the item filters are by `type`/weapon category, which the catalog already carries; see `itemCategory`, `type` and the weapon category field on items): `weaponSimple`/`weaponMartial` are weapons of that category (melee or ranged), the `...Melee` variants only melee weapons, `instrumentMusical` is `Instrument` items, `focusSpellcasting*` is `Spellcasting Focus` items of that kind (arcane, holy, druidic; read what the catalog gives and report if the kind cannot be told apart). Only items of the active books and the SRD baseline are offered, each name once.
- Fixed and picked entries become inventory items with ids `start_<class>_<n>` (the `start_` prefix is how a later claim cleans up). Equip rule: one body armor and a shield are equipped; melee weapons are equipped; ranged weapons, ammunition, packs, tools, instruments and foci are carried. Quantity from the entry. An item the catalog does not know still gets added by its printed name and source so a claim never silently loses an item.
- `applyStartingGrants` keeps its contract (clean earlier `start_` items, gold handling, markers) and gets the resolved items from the picks; calling it for equipment with incomplete picks must not grant a partial kit (return the character unchanged; the UI keeps Claim disabled until complete). `reclaimStartingGrants` adds the same resolved items on top, ids unique, as now.
- A class with no slots (a 2024-print class, a homebrew class): equipment cannot be claimed; the character can still take gold. Expose a helper `hasStartingEquipmentChoices(character, compendium)` for the UI.
- Delete `CLASS_STARTING_EQUIPMENT` and its imports once nothing reads it (the UI preview in `StartingGrantsSection.tsx` is replaced in ticket 29; keep it compiling by having that component read the new module's helper for now, or make ticket 29's change minimal here, whichever keeps `check:all` green). `STARTING_GOLD_BY_CLASS` stays.
- Test first at the module seam with an invented class record (a fixed slot, an a/b slot with different item counts, a generic slot with quantity 2) and a small invented item list: picks complete/incomplete, the exact items granted for each option, no item from the unpicked option, the equip rule, a claim then a changed pick then a re-claim leaving no stale `start_` items, old save without the picks field loads. One test over the real SRD baseline Fighter proves the printed structure (chain mail or the leather/longbow/arrows option; no both).
- Existing characterization baselines that change: re-record only through their recorder env var and explain each changed row.

## Acceptance criteria

- [ ] A claim grants only the fixed items and the picked option of each slot; never items of both options.
- [ ] A generic slot is resolved by a picked catalog item; quantity-2 slots take two picks.
- [ ] Incomplete picks grant nothing; the class change clears picks; old saves load.
- [ ] `CLASS_STARTING_EQUIPMENT` is gone. `npm run check:all` passes.
