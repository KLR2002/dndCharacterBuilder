# 05: Monk Ki Spellcasting Profile and Elemental Disciplines

**What to build:** Monks with spellcasting subclasses (Way of the Four Elements, Way of Shadow, Way of the Sun Soul) receive a dedicated Ki Spellcasting Profile on the Spells tab and combat actions on the Actions tab, calculating Ki Save DC ($8 + \text{PB} + \text{WIS}$) and spell attack bonus ($\text{PB} + \text{WIS}$) and displaying Ki activation costs.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] In `src/rules/spellcasting.ts`, Monk is recognized as a casting class when the subclass is `Way of the Four Elements`, `Way of Shadow`, or `Way of the Sun Soul`.
- [x] Profile calculates:
  - Spellcasting ability: Wisdom (`wis`).
  - Ki Save DC: $8 + \text{PB} + \text{modifiers.wis}$.
  - Spell attack bonus: $\text{PB} + \text{modifiers.wis}$.
  - Slots: Ki-powered (no spell slots consumed).
- [x] Way of Shadow automatically grants *Minor Illusion* cantrip and shadow spells (*Darkness*, *Darkvision*, *Pass without Trace*, *Silence*) with `(2 Ki)` cost annotations.
- [x] Way of the Sun Soul grants *Burning Hands (2 Ki)* at level 6.
- [x] Way of the Four Elements disciplines are selectable via `RuleChoice` in the Builder at levels 3, 6, 11, and 17, with level prerequisites enforced, rendering on Spells tab and Actions tab with Ki costs.
- [x] Spells tab and Actions tab render the Ki Spellcasting Profile and spell attack actions.
- [x] Tested via `checks/monkKiSpells.test.ts`.
