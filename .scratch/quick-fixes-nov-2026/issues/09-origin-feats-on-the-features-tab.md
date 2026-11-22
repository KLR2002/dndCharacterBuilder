# 09: Origin feats on the Features tab

**What to build:**

- **The problem.** The Features tab (`src/components/tabs/FeaturesTab.tsx`, "5. Feats" in `originFeatures`) lists only `character.asiSelections`. A feat the race gives (Variant Human, Custom Lineage) or the background gives is saved in `character.originFeats`, so the tab never lists it.
- **The seam.** A pure function `featFeatureRows(character, compendium, activeBooks)` in a new module `src/rules/featFeatures.ts`. It returns `{ id, name, source, description }[]`, and the tab maps it to its `FeatureDisplay` rows with origin `"Feat"`, replacing the loop.
  - Origin feats come first, then the ASI feats, each in saved order. Only entries with `type === "feat"` and a `featName`.
  - Name: `<featName> (Feat, Lvl <level>)` for both lists. An origin feat's level is always shown as 1: older saves hold level 0.
  - An ASI row keeps exactly what the tab shows today: id, name, `findFeat` for the source, `findHeldRecord` for the description, and the `"Feat benefits."` fallback.
  - An origin row with a book source resolves the same way. One with `BACKGROUND_FEAT_SOURCE` resolves through `featOfSelection` (`src/rules/spellGrants.ts`) with `backgroundSource: character.background?.source`, as `BackgroundSection.tsx` does, and shows that record's source and description. With no record, its source is `Background` and its description is the fallback.
  - Ids are unique, also when the same feat is held as an origin feat and as an ASI feat.
- No new copy, no style change, no change to saved data.

**Blocked by:** None

**Status:** done

**Landed:** merge 53abbdc1 (aff89b78).
- **Fix:** `featFeatureRows` in `src/rules/featFeatures.ts`; the Features tab maps its rows. Seven tests, six red before the fix.
- **Seen on web with the integrated catalog:** a Variant Human with a level 4 feat (393 and 1280), a race feat beside a Giant Foundling's background feat (393), and a feat picked through the builder (1280).
- **Found, not fixed:** `milestonesFromSheet` (`src/rules/expertise.ts`) reads only `asiSelections`, so Skill Expert and Prodigy taken as origin feats offer no Expertise.
- check:all, check:live and the full layout check (SRD and integrated) passed.

- [x] Tests in `checks/featFeatures.test.ts`, red first, with invented feat names and text:
  - A Variant Human's origin feat is listed at level 1 with its book and description, before a level 4 ASI feat.
  - An origin feat saved with level 0 reads level 1.
  - A Custom Lineage feat is listed.
  - A background's feat shows the book of its record, choosing the background's book when two share the name.
  - A background's feat with no record is still listed.
  - An ASI-only character's rows are unchanged, and an ability score increase is not listed.
  - A feat held in both lists gives two distinct ids.
- [x] `npm run check:all` and `npm run check:live` pass.
- [x] Seen on the running Features tab: a Variant Human with an origin feat and a level 4 feat (main session).
