# 04: Proficiency Sheet for tools and languages

**What to build:** A Proficiency Sheet function, derived on every read from the character and a Compendium, returns the character's tools and languages from fixed Proficiency Grants of race, background, class levels, subclass features, feats and multiclass proficiencies, deduplicated. The card reads it. Before changing any reader, a characterization test (the recorder pattern used for the subclass choice baseline, never hand-edited) records what existing characters show for tools and languages today and proves it unchanged except where a grant is newly applied. The catalog format number goes up so the stale-catalog gate forces a re-sync.

**Blocked by:** 02, 03

**Note:** Race, background and class starting proficiencies are not in the enriched `grants`; the sheet reads their existing structured model fields and adapts them into the grant shape.

**Status:** ready-for-agent

- [ ] A recorded baseline of tools and languages for existing representative characters exists first, and the only differences after the change are newly applied grants, each listed.
- [ ] The sheet reads race, background, class, subclass-feature and feat fixed grants, and applies level gating: a grant appears at its feature's level and disappears when the level, class, subclass, background or feat no longer applies.
- [ ] Rule-granted entries cannot be removed by hand.
- [ ] The card's tool and language lists read the sheet.
- [ ] Without the Integrated Catalog, SRD characters get their grants from the baseline.
- [ ] The catalog format number is increased and the stale gate test covers it.
- [ ] Tests run at the sheet function with `makeChar()` and the catalog fixture, using invented rule names where fixtures need new rules.
- [ ] `npm run check:all` passes.

## Design notes (main session)

- **Shape.** A new rules module holds the Proficiency Sheet function. It takes the character and a catalog bundle that is a **required** argument (never an optional one whose default quietly means "no catalog"; see the diagnosis on quick fix 04). For this ticket it returns tools and languages only, each entry a normalized name plus whether it is rule-granted; the type leaves room for the other four categories and for added entries (ticket 06).
- **Sources.** Race, background, class base and multiclass proficiencies keep the existing structured readers; the sheet calls them and normalizes their output, so their results must not change. New: fixed `grants` (categories tools and languages) of class features, subclass features and feats. Reuse the granted-features pass for level gating, enabled optional features and replaced base features by carrying `grants` through the feature instance; check that feats from the ability score selections and from the origin-feat list are both included. Choice grants are ticket 05; ignore `choice` grants here.
- **Normalization.** Grant names arrive lowercase from the catalog ("smith's tools", "giant"); tools go through the existing tool-name normalizer and languages are matched to the known language names. Deduplicate case-insensitively.
- **Readers.** `evaluateCharacter`'s tool and language lists, the evaluated tools with Expertise, and the Builder's language picker (which locks known languages) all read the sheet. The old resolver functions stay as thin wrappers for now and are deleted by the contract ticket.
- **Catalog format.** The catalog format number is increased in the scraper output and in the app's required-format constant, together, and the stale gate test is updated.
- **Characterization.** First commit, before any change: a recorder-generated baseline (the pattern of the subclass choice baseline: an environment variable regenerates it, never hand-edited) of tools and languages for a matrix of representative characters (several races and subraces, backgrounds, classes and subclasses at several levels, multiclass, with picks), run against the SRD baseline and the integrated test compendium. After the change the test requires every baseline entry to still be present and every new entry to be in an explicit allowlist of (scenario, entry) pairs, each traceable to a subclass-feature or feat grant. Fixtures use invented rule names; no real 5e prose.
