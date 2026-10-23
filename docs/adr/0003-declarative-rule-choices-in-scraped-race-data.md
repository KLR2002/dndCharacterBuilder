# Declarative Rule Choices in scraped race data

Half-Elf variants, Eladrin seasons, and Aasimar revelations were all unimplemented even though 5e.tools stores them in a uniform `inset` / `list` shape. We lift that shape into a `choices` field on the trait that grants it (`traits[].choices = { pick, options: [{ name, description }] }`) in the scraper, rather than hand-writing three special cases alongside the existing `CHOICE_ASI_RACES` and `RACE_SKILL_PROFICIENCIES` sets — the half-elf variant already fell out of that approach, because the skill reader (`src/rules/proficiencySources/skillGrants.ts`, then `skills.ts`) looked for a trait literally named `Skill Versatility` that SCAG variants do not have.

## Consequences

Choices nest on the trait that grants them, so the aasimar revelation hangs off `Celestial Revelation` and the half-elf descent options off `Variant Feature (Choose 1)` through one code path. A choice's `level` is **not** scraped: it is a curated override table, because "When you reach 3rd level" only exists as prose in the source and parsing prose is brittle. A test fails if a scraped choice has no level.

The scraper also strips the `Variant; ` prefix from subrace names and sets `isVariant: true`, replacing four `subraceName === "Variant"` comparisons that matched only 1 of 13 variant subraces.

Selected options live on the character as `ruleChoices?: RuleChoiceEntry[]` (`{ id, origin, choose, from, picked }`), matching the existing `SkillChoiceEntry` and `ClassChoice` precedent rather than introducing a `Record`. The id is `source__race__subraceSource__trait` — source first, because DMG and MTF both ship a subrace named `Eladrin`.

Choices below their level are hidden rather than shown locked, and existing characters get a `needsReview` flag when their ancestry implies a choice they never recorded, since the variant-half-elf ASI path is deliberately untouched and must not be entangled with this change.