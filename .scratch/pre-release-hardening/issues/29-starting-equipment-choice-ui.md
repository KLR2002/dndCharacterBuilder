# 29: The Builder asks for one option per equipment slot before Claim

**What to build:** Owner request. The UI half. In the Builder's "Starting Equipment & Gold" card, with Equipment selected, show each slot of the class: a fixed slot lists its items; an a/b/c slot shows the options as radio-like choices (exactly one selectable, the items of each listed in the label); a generic entry inside the chosen option shows a picker for the specific item (two pickers for a quantity of 2). "Claim Starting Equipment" is enabled only when every slot is complete. After claiming, the card shows the claimed state as now, and the picks stay visible and changeable (changing them and pressing "Claim again"/switching works through ticket 28's functions). A class with no slots shows only the gold option with no Equipment choice (use `hasStartingEquipmentChoices`).

**Blocked by:** 28

**Status:** ready-for-agent

## Design notes

- Edit `src/components/builder/StartingGrantsSection.tsx` (and the handlers in `src/components/tabs/BuilderTab.tsx`, `ClassProgressionSection.tsx` prop passing). Replace the "Standard equipment pack" badge preview. Pickers can reuse an existing searchable chooser if the Builder has one (for example the `BackgroundSection.tsx` chips/search or a shared `ui/` component); otherwise a plain list with a search field for lists longer than about 12 items. Do not create a new design language.
- UI copy carries essential mechanics only (`CODING_STANDARDS.md` section 8): option labels are the item names with quantities; no explanatory paragraphs. Obey section 7: option rows and item lists wrap at 320 px, no horizontal overflow; touch targets as elsewhere.
- Picks write through the same `onUpdate` pattern as the other builder choices, using ticket 28's functions; nothing computes inventory in the component.
- Add a permanent scenario to `scripts/layout-check.mjs` (using `scripts/lib/app-driver.mjs`) that opens the Builder with a Fighter and checks the equipment card at the three widths in both catalog modes (no horizontal overflow, Claim disabled until the slots are filled). Follow `docs/agents/driving-the-app.md`. Run `npm run layout:check` and `npm run layout:check -- --integrated`; look at the screenshots yourself and describe what you saw.
- Component logic worth a test (which slots are complete, the claim-enabled rule) lives in ticket 28's module, not in the component.

## Acceptance criteria

- [ ] For the Fighter, the card shows four slots; each can take only one option; Claim is disabled until all four (and any generic pickers inside the chosen options) are filled.
- [ ] Claiming adds only the chosen items to the inventory.
- [ ] No horizontal overflow at 320, 360 and 412 px in both catalog modes.
- [ ] `npm run check:all`, `npm run layout:check` and `npm run layout:check -- --integrated` pass.
