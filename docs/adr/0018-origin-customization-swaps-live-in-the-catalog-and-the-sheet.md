# 0018 Origin Customization: Swap Rules Live in the Catalog, Swaps Are Derived Grants

## Context
Tasha's Customizing Your Origin lets a player move a race's ability score increases and replace its languages and its skill, tool, weapon and armor proficiencies. Its Proficiency Swaps table is non-SRD content (ADR 0014), and a per-character on/off switch would have to be kept in step with the active books.

## Decision
- The swap table is parsed by the scraper from the rule's own record in `data/variantrules.json` into an `originRules` Catalog collection of structured rows (the kind replaced and the kinds that may replace it, no prose). The scrape fails when the record, the table or a cell is missing or unrecognized. The Catalog Format is 12. The SRD Baseline carries no rows, so no swap is offered without the Catalog.
- There is no flag on the character. The rule is available when TCE is an active book, the Catalog holds the table, and the held race or subrace has an ability increase. Saved swaps are kept while the rule is unavailable and applied only while it is, as a Rule Choice's saved picks are (GLOSSARY).
- Ability swaps are slots, one per (ability, amount) of the race's and subrace's own increases, stored only when they differ from the default. The reconciler derives the stored racial ability bonuses from the slots at their targets plus the chosen picks, and releases or drops swaps with a notice. The held race resolves against the unscoped records, so turning a book off changes nothing saved.
- A language, skill, tool, weapon or armor swap is a derived fixed grant on the Race or Subrace feature, keyed `<grant id>#swap:<name>` and saved in `proficiencyPicks`. It exists only inside the Proficiency Sheet's own feature list, which stays the only reader of race proficiency fields (ADR 0015). Normal Proficiency Choice offers never list it, and a background, class, subclass or feat grant of the same name is never swapped or removed. A narrower-pool choice's picked value is swappable; a choice over an "any" pool is not.
- Languages use the SRD language list already in the app. Skills, tools and weapons use the app's lists and the Compendium items, limited to what the Catalog's table row allows.

## Consequences
Persisted swap ids must never change. The reconciler now writes `racialAbilityBonuses` for every held race, which also keeps a Half-Elf's fixed Charisma increase once its chosen increases are saved (it was lost before). A swap whose original disappears, or whose replacement another source now grants, is released with a notice. A weapon grant that names no catalog weapon, or one the Compendium cannot classify, has no swap.

## Considered Options
A per-character "customized origin" flag was rejected: it duplicates the book gate and has to be released when the book goes. Hand-writing the table in `src/` was rejected for the reason in ADR 0014. Storing swaps as Rule Choices was rejected because Rule Choices nest on a trait with a level (ADR 0003), and a swap has neither.
