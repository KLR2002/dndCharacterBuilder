# 04: Proficiency Sheet for tools and languages

**What to build:** A Proficiency Sheet function, derived on every read from the character and a Compendium, returns the character's tools and languages from fixed Proficiency Grants of race, background, class levels, subclass features, feats and multiclass proficiencies, deduplicated. The card reads it. Before changing any reader, a characterization test (the recorder pattern used for the subclass choice baseline, never hand-edited) records what existing characters show for tools and languages today and proves it unchanged except where a grant is newly applied. The catalog format number goes up so the stale-catalog gate forces a re-sync.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] A recorded baseline of tools and languages for existing representative characters exists first, and the only differences after the change are newly applied grants, each listed.
- [ ] The sheet reads race, background, class, subclass-feature and feat fixed grants, and applies level gating: a grant appears at its feature's level and disappears when the level, class, subclass, background or feat no longer applies.
- [ ] Rule-granted entries cannot be removed by hand.
- [ ] The card's tool and language lists read the sheet.
- [ ] Without the Integrated Catalog, SRD characters get their grants from the baseline.
- [ ] The catalog format number is increased and the stale gate test covers it.
- [ ] Tests run at the sheet function with `makeChar()` and the catalog fixture, using invented rule names where fixtures need new rules.
- [ ] `npm run check:all` passes.
