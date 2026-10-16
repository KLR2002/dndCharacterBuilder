# 10: Class and subclass Rule Choices become table rows

**What to build:** The hand-written subclass chain becomes declarative rows with frozen ids, an owner, an explicit source book, and static or resolver-derived options. No new content is added and saved characters' picks are unchanged.

**Blocked by:** 09

**Status:** ready-for-agent

- [ ] Every shipped row id is snapshot-tested
- [ ] Each existing subclass choice produces the same offered options and levels as before
- [ ] Book-gated options (e.g. SCAG totem options) appear only when the book is active
- [ ] Domain cantrip choices resolve from the Compendium in both SRD and integrated modes
- [ ] Existing suite passes (`npm run check:all`)
