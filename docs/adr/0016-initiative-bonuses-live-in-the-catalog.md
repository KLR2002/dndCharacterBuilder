# 0016 Initiative Bonuses Live in the Catalog

## Context
Initiative was the Dexterity modifier alone. The rules that add to it (Rakish Audacity, Tactical Wit, Temporal Awareness, Dread Ambusher, Alert, Hare-Trigger, Aura of the Sentinel) are all non-SRD and exist only as prose in the Catalog.

## Decision
- An Initiative Bonus is structured data on the class feature, subclass feature, feat or ancestry trait that grants it, in its own field beside `grants`: an ability modifier, the proficiency bonus, or a flat value. It has no id, because there is no pick to save. The scraper extracts it from prose, with reviewed overrides for sentences it cannot parse, following ADR 0015. The app reads the field and names no rule.
- A scraper test fails when a feature's prose adds a number to initiative ("a bonus to your initiative rolls equal to…", "add your … to your initiative rolls", "+5 bonus to initiative") and the feature has neither an Initiative Bonus nor a reviewed mark. Prose about advantage, sharing an initiative count, or triggering on rolling initiative is not matched, so it needs no mark.
- Initiative is the Dexterity modifier plus every Initiative Bonus that applies, each rule counted once. A bonus the text makes optional ("you can give yourself…") always applies; an ability-modifier bonus never counts below 0.
- Advantage on initiative is not modelled: the feature's text already tells the player.
- Magic items are out of scope for now; their bonuses depend on equipped and attuned state.
- Jack of All Trades and Remarkable Athlete reach initiative because initiative is a Dexterity check. They are SRD rules and stay in code, like Jack of All Trades on skills; only the higher of the two applies.

## Considered Options
A curated name-and-number table in `src/` (the ADR 0014 pattern for prose-only rules) was rejected: it would bundle non-SRD rule content in the app, and nothing would reveal features the table misses.
