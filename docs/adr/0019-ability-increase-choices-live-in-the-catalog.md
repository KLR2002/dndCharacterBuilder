# 0019 Ability Increase Choices and Subrace Replacement Live in the Catalog

## Context
A race or subrace record states its increases as fixed scores plus an optional choice (`choose`: the scores allowed, how many, the amount), and a subrace record can replace its race's increases (`overwrite.ability`). The scraper kept only the fixed numbers and the app always summed race and subrace, so the SCAG Tiefling variants lost their Dexterity-or-Charisma choice and stacked on the race's Charisma, the MTF Tieflings reached Charisma +4, and Changeling, Warforged and others lost their choice. The app made up for missing choices by knowing Half-Elf, Variant Human and Custom Lineage by name.

## Decision
- The Catalog states both parts as data. `abilityScoreIncrease` keeps only Fixed Increases. A race or subrace with a choice carries `abilityScoreChoices` (each one: the scores allowed, how many, the amount). A subrace whose record replaces its race's increases carries `replacesRaceAbilityScores`. The scraper copies these from the record and does not merge race and subrace. The Catalog Format is raised.
- The app combines them in one place: a subrace that replaces its race's increases gives only its own; otherwise race and subrace add up. The Increase Choice picker, the Flexible Increases rule (an ancestry with neither fixed increases nor choices) and Origin Customization all read that result. No race is known by name for its increases.
- No two racial increases land on the same score. With Origin Customization available, an Increase Choice may go to any score.
- A saved pick that leaves its pool, or goes over a choice's count, is released with a review notice. A character whose scores change only because the data was corrected gets no notice.

## Considered Options
Having the scraper pre-merge each subrace's effective increases was rejected: the race alone and its subraces would disagree about where the race's increases live, and the Origin Customization slot ids, which name race or subrace, would move. Keeping the name checks and adding the Tiefling variants to them was rejected for ADR 0014's reason and because it leaves every other record with a choice wrong.
