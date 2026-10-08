# 03: Book of Ancient Secrets Ritual Ledger & Adventure Inscription

**What to build:**
A complete ritual magic engine for Warlocks taking the *Book of Ancient Secrets* invocation. Prompt the player to select their 2 starting 1st-level ritual spells from any class upon taking the invocation. Store all rituals in an isolated `character.ritualBook` ledger that never counts against the Warlock's known spells limit. On the Spells tab, render a dedicated "Ritual Book" section with `[Ritual Only]` badges and provide an "Inscribe Ritual" modal to add discovered rituals during adventures, strictly enforcing the level cap of $\le \lceil \text{Warlock Level}/2 \rceil$.

**Blocked by:** 02 (Pact of the Tome Cantrips Selection & Spells Tab Integration)

**Status:** closed

- [x] In `src/types/character.ts`, add `ritualBook?: { name: string; source: string; level: number; isStarting?: boolean }[]` to `Character`.
- [x] In `src/rules/ruleChoices.ts`, implement `warlockAncientSecretsStartingRituals(character, activeBooks)` generating `Warlock__Book of Ancient Secrets__Starting Rituals` (choose: 2, 1st-level ritual spells across all classes).
- [x] Automatically seed the chosen starting rituals into `character.ritualBook` with `isStarting: true`.
- [x] On `SpellsTab.tsx`, render a **"Ritual Book (Book of Ancient Secrets)"** card listing all inscribed rituals with `[Ritual Only]` indicators.
- [x] Provide an "Inscribe Ritual" button and modal on `SpellsTab.tsx` displaying all ritual spells from active books where `spell.level <= Math.ceil(warlockLevel / 2)`.
- [x] Adding an inscribed ritual appends it to `character.ritualBook`; deleting an inscribed ritual removes it (starting rituals can only be altered in the builder).
- [x] Ensure rituals in `character.ritualBook` are strictly excluded from Warlock spells-known counters and prepared limits.
- [x] Add unit tests in `checks/ritualBook.test.ts` verifying starting ritual selection, adventure inscription, level ceiling enforcement, and ledger isolation.
