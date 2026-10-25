# 01: An ability-modifier Initiative Bonus reaches initiative (Swashbuckler first)

**What to build:** The first complete path for an **Initiative Bonus**. The Catalog gains an Initiative Bonus field on class and subclass features, the scraper reads it from sentences that add an ability modifier to initiative, the catalog format rises to 8, and a character's evaluated initiative includes it. A Swashbuckler 3 with DEX 14 and CHA 16 shows initiative +5. Tactical Wit (INT), Temporal Awareness (INT) and Dread Ambusher (WIS) work with no further code because they use the same kind of sentence. The evaluated character exposes `initiativeBreakdown`: a list of `{ label, value }` parts, Dexterity first, then one part per Initiative Bonus labelled with the name of the feature that grants it. An ability-modifier bonus never counts below 0 (a CHA 8 Swashbuckler gets +0 from Rakish Audacity, not −1). A rule counts once however many ways it reaches the character. Level gating, a changed subclass, and switched-off optional features behave as they do for Proficiency Grants. See the spec and ADR 0016.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Initiative Bonus type exists beside the Proficiency Grant types, shared by the scraper models and the app catalog types, as the spec's type shape: `ability` (with an ability key), `proficiency`, `flat` (with a value). Only the `ability` kind is extracted in this ticket; the other kinds are declared.
- [ ] The scraper extractor turns "a bonus to your initiative rolls equal to your <Ability> modifier" and "add your <Ability> modifier to your initiative rolls" into an `ability` bonus. Sentence-level tests (with invented names and invented sentences, no real rules prose) cover both phrasings and sentences that must NOT match: advantage on initiative, "shares your initiative count", "when you roll initiative, regain…".
- [ ] A reviewed override mechanism for Initiative Bonuses exists in its own list, keyed by owner, feature and level like the proficiency overrides, and throws when an override names no feature.
- [ ] The tracked data is re-enriched through the sanctioned enrich tool (extended to write the Initiative Bonus field) and the catalog format is 8; the in-app sync path produces the same field.
- [ ] `grantedFeatures` carries a feature's Initiative Bonus on its feature instance; `evaluateCharacter` returns `initiative` (total) and `initiativeBreakdown`.
- [ ] Engine tests against a small invented test catalog (not real rule text): DEX-only character; Swashbuckler-like feature with positive and negative modifier (negative counts 0); a feature above the character's level is absent; changing subclass swaps the bonus; two features from different classes add; the same feature instance is counted once; an ability-score change moves the bonus; the breakdown's labels and order.
- [ ] `check:live` asserts that Rakish Audacity, Tactical Wit, Temporal Awareness and Dread Ambusher carry the expected `ability` bonus in the catalog the in-app sync builds, and that a Swashbuckler 3 (DEX 14, CHA 16) evaluates to initiative +5.
- [ ] The SRD Baseline is regenerated through the prune script in its own commit only if its bytes change.
- [ ] `npm run check:all` and `npm run check:live` pass.
