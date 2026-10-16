# Coding Standards

Judgement calls and rules conventions enforced during code review.
(Mechanical rules like formatting, syntax, and glossary terms are enforced deterministically by `npm test` and `npm run lint`).

## 1. Subclass & Archetype Predicates
- **Conjunctive Checks Only**: When testing whether a character or spell profile possesses an archetype or subclass, never treat the base class name alone as sufficient (e.g. `cls === "fighter" || sub.includes("eldritch knight")` is invalid).
- Always verify both the base class and the specific subclass name (or match against the canonical archetype name if already normalized).
- **Tiered Multi-Milestone Predicates**: When an archetype offers recurring option names across multiple level milestones (e.g. Path of the Totem Warrior Bear at 3, 6, and 14), logic evaluating benefits for a specific milestone must target that exact milestone ID/trait and strictly exclude other tiers.

## 2. Spellcasting Budgets & Counter Fidelity
- **Strict Separation of Prepared vs. Known**:
  - Prepared casters (Cleric, Druid, Paladin, Artificer, Wizard) must never display always-prepared domain spells under "spells known".
  - Always-prepared spells must never decrement or count against the character's base preparation budget (`preparedLimit`).
- **Subclass Feature Supremacy**:
  - If a subclass is active under active sourcebooks, spells on its granted or expanded list are accessible regardless of individual spell book origins.
- **Synthetic Spell Data Invariant**:
  - Consumers of `ClassSpellProfile` (e.g. character sheet tabs, action generators) must preserve passed `SpellData` objects from `subclassKnownSpells` and `alwaysPreparedSpells` as primary source of truth, using `findSpell()` only as catalog fallback for name-only references. Synthetic subclass spells (e.g. Monk Elemental Disciplines *Water Whip*, *Fist of Unbroken Air*) are generated dynamically and do not exist in static catalog files.

## 3. Feature Lifecycle, Teardown & Review Audit
- **Comprehensive Teardown Invariant**:
  - Any builder transition that alters a subclass, swaps a pact boon, removes an invocation/infusion/feat, deletes a class, or de-levels a character must cleanly prune all dependent secondary states.
  - Secondary states that must be cleansed include:
    - `character.ruleChoices` for sub-choices (e.g. Tome cantrips, Ancient Secrets starting rituals, Fighting Initiate styles, Martial Adept maneuvers).
    - `character.knownSpells` granted by pact boons or features (e.g. `ownerKey === "Warlock__Tome"`, `ownerKey === "Barbarian__BGG"`).
    - `character.ritualBook` entries when *Book of Ancient Secrets* or *Pact of the Tome* is lost.
    - `character.activeInfusions` and temporary infused items when Artificer infusions are unlearned or de-leveled.
    - Obsolete resource counters and subclass spell swaps (`subclassSpellSwaps`).
- **Descriptive Audit Logging in `needsReview`**:
  - Whenever secondary states are pruned or an option is automatically removed because prerequisites are no longer satisfied, a descriptive audit message must be appended to `character.needsReview` (e.g., `"Pact of the Tome Cantrips removed: character no longer possesses Pact of the Tome"`).

## 4. Test Invariants & Negative Cases
- **Boundary Verification**:
  - Test suites for swap, replacement, learning, or milestone mechanics must explicitly assert negative cases:
    - Subclass spell replacements (e.g., TCoE Clockwork Soul / Aberrant Mind) must reject cantrips (`level === 0`).
    - Gated spell levels, invalid schools, and foreign class lists must be verified for rejection.
    - Level-gated milestones (e.g., Monk Elemental Disciplines, class archetype unlocks): must verify higher-tier choices are absent/rejected at lower levels, and pre-unlock levels offer zero choices.
- **Dual-Mode SRD vs. Compendium Invariant**:
  - Mechanics or UI altering ancestry traits, race variants, or class progression must verify behavior across both SRD-only mode and integrated compendium mode to ensure changes for one mode do not regress choices in the other.

## 5. Equipment Economy, Attunement & Mundane Invariants
- **Attunement Gating**:
  - Any equipment bearing an `attunement` requirement must withhold all numerical and mechanical bonuses (`bonusWeapon`, `bonusAc`, special tactical riders) unless `item.isAttuned === true`.
  - Unattuned magic items must explicitly surface an `[Unattuned]` calculation badge on weapon and armor cards.
- **Mundane Invariant for Enhancements**:
  - Features requiring mundane targets (e.g., Artificer Infusions like *Enhanced Weapon* or *Enhanced Defense*) must verify `isMundaneItem` (`rarity: "None"` or undefined, and no inherent `bonusWeapon` or `bonusAc`) before binding.
  - Sheet reconcilers and teardown routines must purge any active enhancements bound to magical items and append a descriptive notice to `character.needsReview`.

## 6. Cross-Platform Runtime & Storage
- **Mobile-Native Compatibility**:
  - Shared services and storage layers must never access browser DOM globals (`window`, `document`, `indexedDB`, `localStorage`) without platform checking (`Platform.OS === "web"`). Mobile targets (Android/iOS) must use `AsyncStorage` or native file-system adapters.
