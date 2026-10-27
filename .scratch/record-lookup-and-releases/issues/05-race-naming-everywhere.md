# 05: Race naming everywhere

**Status:** done

**Landed:** every race pick trait text and the legacy cantrip migration notice use the race title rule ("High Elf Cantrip (choose 1)"); the prepared-spell badge already read "High Elf" and is pinned by a test; pick and counter ids unchanged. check:all, check:live and the full integrated layout run green. Open: the ancestry banner "Elf — High" and the race-picker subrace badge still show the subrace alone; saved rule choices keep the trait label they were saved with; the Vahadar subrace reads "Vahadar Elf (Kaladesh)".

Spec: `.scratch/record-lookup-and-releases/spec.md`.

## What to build

A High Elf's builder rule-choice trait reads "High Elf Cantrip (choose 1)" and the class-list badge of prepared race spells reads "High Elf", using the race title rule from the earlier work (the subrace alone when it has more than one word or contains the race name, else `<subrace> <race>`, from the character's own race) in every place a race is named. The layout scenario that asserts the old trait text is updated.

## Owns

- AC-11: Race naming

## Acceptance Criteria

- [x] The builder trait of the High Elf cantrip pick reads "High Elf Cantrip (choose 1)" and the prepared-spell badge reads "High Elf" (AC-11).
- [x] A multi-word subrace (a Half-Elf descent) reads by its own name in both places.
- [x] `npm run check:all` passes; the builder race and Spells-tab layout scenarios pass at four widths, integrated, with screenshots viewed.

## Verification

| Criterion | Seam | Evidence required |
| --- | --- | --- |
| AC-11 | The rule-choice trait text and the class-list badge | Red-then-green test of both strings |
| AC-11 (UI) | Layout check, `-- --integrated` | Scenario with the High Elf, four widths, screenshots viewed |

## Constraints

Follow `docs/agents/subagent-tiering.md` "Implementer Rules". Invent names in tests except where real data is the point (SRD and live-catalog tests). No non-SRD name in app code. The saved source of a character is never rewritten. Notices read "X removed from Y: reason"; no new explanatory copy; layout per CODING_STANDARDS §7.

## Blocked by

None
