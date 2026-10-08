# 02: Innate Magic Rules & Long Rest Integration

**What to build:** Build the rules engine for racial spells and cantrips (`src/rules/innateMagic.ts`). Resolve racial spells and cantrips based on ancestry and character level (e.g. High Elf cantrip, Drow *Dancing Lights* / *Faerie Fire* / *Darkness*, Gith psionics, Tiefling legacy, Deep Gnome innate spells). Compute spell save DC and attack bonus using racial spellcasting ability. Integrate 1/long rest spell counters into `character.resourceCounters` with `resetOn: "long"`.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Implement `src/rules/innateMagic.ts` resolving innate cantrips and leveled spells by character level.
- [x] Calculate innate spell DC and attack bonus from racial ability scores and proficiency bonus.
- [x] Connect daily racial spell usage to `character.resourceCounters` ensuring Long Rest restores them.
- [x] Add unit tests in `checks/innateMagic.test.ts` for High Elf, Drow, Gith, Tiefling, and Deep Gnome progression.
- [x] Verify zero TypeScript errors and all tests pass with `npm test`.
