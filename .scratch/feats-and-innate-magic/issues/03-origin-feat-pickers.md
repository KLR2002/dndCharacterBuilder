# 03: Ancestry & Background Origin Feat Pickers

**What to build:** In `AncestrySection.tsx` and `BackgroundSection.tsx`, render origin feat selection cards. For Variant Human and Custom Lineage, provide an inline feat selector with prerequisite warning badges and an ability score dropdown for half-feats. For feat-granting backgrounds (e.g. *Giant Foundling*, *Rune Carver*, *Astral Drifter*), automatically award or allow choosing their granted origin feat. Store selected feats in `character.originFeats`.

**Blocked by:** 01-feat-prerequisites-and-origin-engine

**Status:** done

- [x] In `AncestrySection.tsx`, add Origin Feat selector for Variant Human and Custom Lineage with half-feat stat picker.
- [x] In `BackgroundSection.tsx`, detect and award feat grants from backgrounds (e.g. *Strike of the Giants*, *Rune Shaper*).
- [x] Render informative warning badges next to feats whose prerequisites are not yet met.
- [x] Ensure mobile responsive layout (320px minimum) for feat picker cards and modal dialogs.
- [x] Verify zero TypeScript errors and zero lint errors.
