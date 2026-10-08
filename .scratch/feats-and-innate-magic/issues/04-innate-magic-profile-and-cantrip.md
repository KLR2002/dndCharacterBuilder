# 04: Innate Magic Profile & High Elf Cantrip

**What to build:** In `AncestrySection.tsx`, provide a cantrip picker for High Elf (and Variant Half-Elf with High Elf descent) choosing from Wizard cantrips. In `SpellsTab.tsx`, add a dedicated **Innate & Racial Spells** profile alongside class profiles, displaying racial spell DC and attack bonus, listing unlocked innate spells and cantrips, and providing daily 1/long rest checkboxes wired directly to resource counters.

**Blocked by:** 02-innate-magic-rules

**Status:** done

- [x] In `AncestrySection.tsx`, render Wizard cantrip picker for High Elf.
- [x] In `SpellsTab.tsx`, render dedicated "Innate & Racial Spells" profile when innate spells or cantrips exist.
- [x] Display racial spell save DC and attack bonus.
- [x] Render 1/long rest daily checkboxes connected to `character.resourceCounters`.
- [x] Verify zero TypeScript errors, zero lint errors, and all tests passing.
