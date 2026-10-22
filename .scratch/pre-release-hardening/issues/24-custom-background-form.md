# 24: One Custom Background: tool-or-language picks and a borrowed feature in the creation form

**What to build:** Owner request. The background step lists two custom backgrounds: the catalog's own "Custom Background" entry (PHB, feature "Choose a Feature") in the background list, and the "Custom Background" creator card above it. Keep only the creator card, and make its form complete:

1. Remove the catalog's "Custom Background" entry from the background list (filter it out of the list the Builder shows; do not edit `dnd5eToolsScrap/data/` or `src/data/`). A saved character that already holds it keeps working.
2. The creation form asks for the two tool-or-language picks (the custom background's choice from ticket 22, any combination of tools and languages) next to the two skills, with the same two-pick counter behaviour as the skills. "Apply" needs the name, 2 skills and 2 tool-or-language picks. The picks are stored as the proficiency picks of that choice's grant id (export the id constant next to `CUSTOM_BACKGROUND_SKILLS_ID` in `src/rules/customBackground.ts`). They stay changeable afterwards in the background's Proficiency Choices card, as the skills do.
3. The form lets the player optionally choose a feature from another background. The options are the features of the backgrounds in the active books, one row per feature, labelled `Feature name (Background name)`, with a search field because the list is long. The placeholder feature of the catalog's own "Custom Background" entry is not an option. The chosen feature is stored on the background as `customFeatureName` and `customFeatureDesc` (fields already on `Character["background"]`), and the Features tab lists it, attributed to the custom background. Today `grantedFeatures` reads those fields only when `background.isCustom` is set while `setCustomBackground` sets only `source: "Custom"`; make one rule decide what a custom background is (`isCustomBackground` in `src/rules/customBackground.ts`) and use it in both places. Check the other `isCustom` readers on the background (`src/rules/builderTransitions.ts` near the starting-grant code, `src/rules/legacyBackgroundSkills.ts`, the tabs) so none changes behaviour for existing characters.

**Blocked by:** 22 (done)

**Status:** ready-for-agent

## Design notes

- The rule layer: extend `setCustomBackground` (`src/rules/builderTransitions.ts`) to take the tool-or-language picks and the optional borrowed feature, ending in the Character Reconciler as now. Test it first, including: picks stored under the grant id; the borrowed feature appears in `grantedFeatures` with origin Background; clearing the background drops them; a custom background with no borrowed feature behaves as today.
- The form lives in `src/components/builder/BackgroundSection.tsx`. Chips for the tool-or-language picks come from the grant's pool (`poolNames`); a name the character already holds from another source is not offered, as in the offers module. Keep UI copy to essential mechanics only (`CODING_STANDARDS.md` section 8) and obey the layout rules in section 7 (the lists wrap on narrow widths, no horizontal overflow).
- Use invented names in fixtures. Real feature names may be read from the catalog in a test only to build the option list.

## Acceptance criteria

- [ ] The background list no longer shows the catalog's "Custom Background"; the creator card remains.
- [ ] The creation form takes name, 2 skills, 2 tool-or-language picks and an optional `Feature name (Background name)` choice; Apply is enabled only with name, 2 skills and 2 picks.
- [ ] After applying, the sheet shows the picked tools and languages, the Features tab shows the borrowed feature, and the Proficiency Choices card still lets the player change the picks.
- [ ] `npm run check:all`, `npm run layout:check` and `npm run layout:check -- --integrated` pass.
