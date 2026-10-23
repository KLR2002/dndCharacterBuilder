# 29: The Builder asks for one option per equipment slot before Claim

**What to build:** Owner request. The UI half. In the Builder's "Starting Equipment & Gold" card, with Equipment selected, show each slot of the class: a fixed slot lists its items; an a/b/c slot shows the options as radio-like choices (exactly one selectable, the items of each listed in the label); a generic entry inside the chosen option shows a picker for the specific item (two pickers for a quantity of 2). "Claim Starting Equipment" is enabled only when every slot is complete. After claiming, the card shows the claimed state as now, and the picks stay visible and changeable (changing them and pressing "Claim again"/switching works through ticket 28's functions). Options the character is not proficient to take (ticket 28's gate, e.g. a Cleric without a heavy-armor domain) are not shown. A class with no slots shows only the gold option with no Equipment choice (use `hasStartingEquipmentChoices`).

**Blocked by:** 28

**Status:** done

**Landed:** merged from `pr/29-equipment-choice-ui` (9499f5c, 908a0ae, 1399639, 1df8b04, bc203a7, b4665d2, 1a5f757). `check:all` passes on the merged tip (1190 app tests, 7 skipped, 178 scraper tests, 322 known type errors none new); layout checks green at 320, 360, 393 and 412 px in both catalog modes on the branch. The Builder's equipment card shows each slot as a radio list of options (item names, quantities), with an inline searchable picker under an option that holds a generic entry; Claim is enabled only when every slot is complete; a class with no slots shows gold only; options the character cannot take (the proficiency gate) are not listed. I viewed the Fighter slots, the open picker and the Life Domain Cleric at 320 px: no overflow, Chain Mail offered and the Warhammer not. Permanent layout scenarios added (Fighter slots, picked, picker open, Cleric with and without a domain). Open items: Claim, the claimed state and changing a pick after claiming are covered by rules tests but not driven in the browser; the card tests from the first implementer were not seen red; in SRD mode a Cleric always has Life Domain (the app applies the sole SRD subclass), so the no-domain case exists only with integration; a focus list and a long martial weapon pool were not measured on a real device.

## Design notes

- The rules API is in ticket 28's Landed note (`src/rules/startingEquipment.ts`): read the slots from the class data (`allCatalogClasses` in `src/rules/catalogs.ts`, as `heldClassData` does; export a small reader from the rules module if the component needs the first class's slots), the offered option letters from `startingEquipmentOffers`, the pool of a generic entry from `startingEquipmentPool`, the current picks from `character.startingEquipmentPicks`, completeness from `resolveStartingEquipment(...).complete`. Write picks with `setStartingEquipmentOption` and `setStartingEquipmentItems` through the Builder's `onUpdate` pattern. Today `StartingGrantsSection` shows a text saying to choose an option and a disabled button: replace that with the real controls.

- Edit `src/components/builder/StartingGrantsSection.tsx` (and the handlers in `src/components/tabs/BuilderTab.tsx`, `ClassProgressionSection.tsx` prop passing). Replace the "Standard equipment pack" badge preview. Pickers can reuse an existing searchable chooser if the Builder has one (for example the `BackgroundSection.tsx` chips/search or a shared `ui/` component); otherwise a plain list with a search field for lists longer than about 12 items. Do not create a new design language.
- UI copy carries essential mechanics only (`CODING_STANDARDS.md` section 8): option labels are the item names with quantities; no explanatory paragraphs. Obey section 7: option rows and item lists wrap at 320 px, no horizontal overflow; touch targets as elsewhere.
- Picks write through the same `onUpdate` pattern as the other builder choices, using ticket 28's functions; nothing computes inventory in the component.
- Add a permanent scenario to `scripts/layout-check.mjs` (using `scripts/lib/app-driver.mjs`) that opens the Builder with a Fighter and checks the equipment card at the three widths in both catalog modes (no horizontal overflow, Claim disabled until the slots are filled). Follow `docs/agents/driving-the-app.md`. Run `npm run layout:check` and `npm run layout:check -- --integrated`; look at the screenshots yourself and describe what you saw.
- Component logic worth a test (which slots are complete, the claim-enabled rule) lives in ticket 28's module, not in the component.

## Acceptance criteria

- [ ] For the Fighter, the card shows four slots; each can take only one option; Claim is disabled until all four (and any generic pickers inside the chosen options) are filled.
- [ ] A Cleric with a heavy-armor domain sees the chain mail option; one without does not.
- [ ] Claiming adds only the chosen items to the inventory.
- [ ] No horizontal overflow at 320, 360 and 412 px in both catalog modes.
- [ ] `npm run check:all`, `npm run layout:check` and `npm run layout:check -- --integrated` pass.
