# 03: Rule Choice storage and migration

**Blocked by:** 01 — Rule Choice data in the scraper.

**Status:** ready-for-agent

- [ ] The character records its Rule Choice selections in the same entry-array shape the codebase already uses for skill and class selections.
- [ ] Selection identity includes source before race and subrace, so two ancestries sharing a subrace name cannot collide.
- [ ] A saved character with no recorded selections migrates without error and defaults to none.
- [ ] A character whose ancestry offers a Rule Choice it has no recorded pick for is flagged for review.
- [ ] A character with no Rule Choices is not flagged.
- [ ] Selections survive save and reload.
- [ ] Changing background or class leaves selections intact; changing ancestry clears selections belonging to the previous ancestry.
