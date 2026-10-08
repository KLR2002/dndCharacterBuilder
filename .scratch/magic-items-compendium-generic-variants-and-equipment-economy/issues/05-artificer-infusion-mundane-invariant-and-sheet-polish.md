# 05: Artificer Infusion Mundane Invariant & Character Sheet Polish

**What to build:**
Enforce the 2014 RAW rule that Artificer infusions (*Enhanced Weapon*, *Enhanced Defense*, etc.) can only be applied to nonmagical mundane objects. Restrict available target items in `ActiveInfusionsSection.tsx` and infusion helper functions to items with `rarity: "None"` (or undefined) and no inherent magic bonuses. Polish the Rest modal to provide attunement reminders during Short Rests, verify complete suite integrity, and ensure zero lint or type errors.

**Blocked by:** 04-first-class-attunement-ledger-and-3-slot-limit

**Status:** closed

- [x] In `src/rules/ruleChoices.ts` and `src/components/ActiveInfusionsSection.tsx`, filter infusion target choices to nonmagical mundane items (`(!item.rarity || item.rarity === "None") && !item.bonusWeapon && !item.bonusAc`)
- [x] If an item is already magical, disable it from infusion selection with an explanatory message: *"Requires nonmagical object"*
- [x] In `RestModal.tsx`, display an attunement reminder during Short Rest: *"Short Rest completed: You can attune or unattune magic items in your Inventory."*
- [x] Ensure all item interaction touch targets meet the $\ge 44$px requirement with appropriate hitSlop
- [x] Add unit tests in `checks/artificerInfusionsMundane.test.ts` verifying that magical items are rejected as infusion targets
- [x] Verify full test suite passes with `npm run check:all` (tests, typecheck, lint)
