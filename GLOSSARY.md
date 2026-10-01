# 5e 2014 Character Builder

A digital character sheet and progression builder strictly adhering to the 2014 Fifth Edition Dungeons & Dragons ruleset.

## Language

**Character**:
The persistent state and sheet of an adventurer, including ability scores, classes, background, inventory, and spellcasting progression.
_Avoid_: Avatar, hero record, player profile

**Ability Scores**:
The six core physical and mental attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma) calculated as base scores plus racial traits and Ability Score Improvements (ASI).
_Avoid_: Stats, attributes, raw scores

**Effective Ability Scores**:
The final ability scores after combining base scores, fixed racial bonuses, choice racial bonuses, class level ASIs, and feat bonuses.
_Avoid_: Total stats, final scores

**Spellcasting Profile**:
A class-specific profile tracking spell save DC, spell attack bonus, spellcasting ability modifier, and prepared spell limits for a single casting class within a character's progression.
_Avoid_: Spell manager, spell slot pool

**Pact Magic**:
Warlock-specific spell slots that reset on a Short or Long Rest, tracked independently from standard multiclass spell slots.
_Avoid_: Warlock slots, short slots

**Multiclassing**:
Gaining levels in multiple classes subject to ability score prerequisites and the 2014 multiclass spell slot progression rules.
_Avoid_: Cross-classing, hybrid class

**Rule Choice**:
A selection the player makes from a fixed set of options granted by a single rule, where exactly one option takes effect. Distinct from a *Proficiency Choice*, which grants proficiency rather than a feature, and from a *Replacement*, which substitutes one fixed feature for another with no player choice.
_Avoid_: variant, option, mode, toggle

**Ancestral Variant**:
An Ancestry that **replaces** a named feature of its base ancestry rather than adding to it. A Variant Half-Elf has no Skill Versatility of its own; it takes exactly one feature from its descent's offered set, which may include Skill Versatility.
_Avoid_: subrace, upgrade, alternate ancestry

**Season**:
The Eladrin's chosen season (Autumn, Winter, Spring, Summer), which determines the additional effect its Fey Step gains at 3rd level. Changeable by the player whenever a Long Rest is taken.
_Avoid_: alignment, element, stance

**Revelation**:
The Celestial Revelation an Aasimar selects at 3rd level (Necrotic Shroud, Radiant Consumption, or Radiant Soul), determining the effect of its transformation. Distinct from *Celestial Legacy*, the earlier Aasimar feature that grants spells instead.
_Avoid_: transformation, aura, boon

**Rest**:
A period of downtime—either Short Rest (1 hour, recovers Pact slots, short-reset counters, and spent hit dice healing) or Long Rest (8 hours, full HP recovery, resets standard spell slots and all resource counters, decrements exhaustion, recovers up to half total hit dice).
_Avoid_: Sleep, camp, recovery phase
