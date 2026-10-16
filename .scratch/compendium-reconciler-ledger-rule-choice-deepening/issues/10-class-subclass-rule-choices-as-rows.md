# 10: Class and subclass Rule Choices become table rows

**What to build:** The hand-written subclass chain becomes declarative rows with frozen ids, an owner, an explicit source book, and static or resolver-derived options. No new content is added and saved characters' picks are unchanged.

**Blocked by:** 09

**Status:** done

- [x] Every shipped row id is snapshot-tested
- [x] Each existing subclass choice produces the same offered options and levels as before
- [x] Book-gated options (e.g. SCAG totem options) appear only when the book is active
- [x] Domain cantrip choices resolve from the Compendium in both SRD and integrated modes
- [x] Existing suite passes (`npm run check:all`)

## Notes

- The owner subclass is matched by fragment (case- and space-insensitive) rather than the full subclass name, so "Nature" matches "Nature Domain".
- The characterization baseline (`checks/fixtures/subclassChoiceBaseline.json`) is about 490 KB. Re-record it deliberately with `UPDATE_SUBCLASS_CHOICE_BASELINE=1`.
- An optional `source` field was added to `AvailableRuleChoice`. Table rows set it and gate on it; other choices still gate on the id prefix.
- `requiresOptionalFeature` was added to the rows for Primal Knowledge.
- The refactor commit (80f6b68) added 448 new baseline scenarios (`druid short land name`). The 1280 pre-existing scenarios are unchanged, but the new ones were recorded after the refactor, not from the unchanged code.
