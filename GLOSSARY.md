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
A selection the player makes from a fixed set of options granted by a single rule, where exactly one option takes effect. It originates from ancestry, class, or subclass, and its id is its persisted identity, so ids never change once shipped. Distinct from a *Proficiency Choice*, which grants proficiency rather than a feature, and from a *Replacement*, which substitutes one fixed feature for another with no player choice.
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

**Origin Feat**:
A feat granted at 1st level by a character's race (Variant Human, Custom Lineage) or background (e.g., *Giant Foundling*, *Rune Carver*, *Astral Drifter*), tracked independently from class-level Ability Score Improvements.
_Avoid_: Bonus feat, starting feat, level 1 perk

**Innate Magic**:
Spells or cantrips granted directly by a character's race or lineage (e.g., High Elf cantrip, Drow magic, Gith psionics, Tiefling legacy) that scale with total character level rather than class levels, use racial spellcasting abilities, and reset on a Long Rest.
_Avoid_: Racial casting, bonus cantrip, innate slots

**Feat Prerequisite**:
A requirement (minimum ability score, armor or weapon proficiency, spellcasting capability, character level, or race) that must be satisfied before taking a feat.
_Avoid_: Feat lock, qualification, feat gate

**Class Spell List**:
The canonical collection of spells a class can learn or prepare from its spellcasting feature in the sourcebook where the class or spell was defined.
_Avoid_: Spell pool, class spell table, spell catalog

**Alternative Spell List**:
Optional additions to a class's spell list introduced by an expansion book (such as TCoE "Additional Class Spells"), granting classes access to spells beyond their base rules list when that expansion book is active.
_Avoid_: Extra spells, variant spellbook, expanded spell list (which refers specifically to subclass patron/domain spells)

**Supplement Spell**:
A spell introduced in an expansion sourcebook (e.g., XGE, TCE, FTD, SCC, EGW) that is available to casting classes whenever its originating sourcebook is active.
_Avoid_: DLC spell, bonus spell, non-core spell

**Wild Shape**:
A Druid class feature (gained at 2nd level) allowing the character to magically assume the shape of a beast they have seen before for up to half their druid level in hours, expending a use from a pool that recovers on a Short or Long Rest.
_Avoid_: Shapeshift, polymorph, animal form, morph

**Circle Forms**:
The Circle of the Moon subclass feature that replaces the standard Wild Shape CR limit with higher combat ratings (CR 1 at 2nd level, CR equal to Druid level divided by 3 at 6th level and higher), while continuing to adhere to standard swimming and flying speed level restrictions.
_Avoid_: Combat wild shape, moon forms, enhanced shape

**Beast Statblock**:
The complete game statistics (size, AC, hit points, speeds, ability scores, traits, and actions) of a beast creature available for Wild Shape reference and active transformation tracking.
_Avoid_: Monster sheet, creature profile, beast card

**Elemental Wild Shape**:
The 10th-level Circle of the Moon feature allowing the expenditure of two Wild Shape uses simultaneously to assume the form of an Air, Earth, Fire, or Water Elemental.
_Avoid_: Elemental form, circle elementals

**Always-Prepared Spells**:
Spells granted automatically by a character's subclass (e.g. Cleric Domain Spells, Druid Circle Spells, Paladin Oath Spells, Artificer Specialist Spells) that are permanently prepared, do not count against the character's prepared spell limit, and count as spells of that class.
_Avoid_: Auto spells, free prepared spells, bonus domain slots

**Expanded Spell List**:
Spells added by a subclass (such as an Otherworldly Patron) to the pool of spells a character can choose from when learning spells, without automatically being prepared or counting as free spells known.
_Avoid_: Patron spells, extra spells, bonus known spells

**Subclass Spells Known**:
Spells granted directly into a character's known spells by a subclass (such as Ranger Conclaves, Clockwork Soul, Aberrant Mind, or Divine Soul) that do not count against the character's standard class spells known limit.
_Avoid_: Bonus spells known, free learned spells

**Subclass Spell Replacement**:
The class feature rule (e.g., TCoE Clockwork Magic or Psionic Spells) allowing a character upon gaining a class level to swap one subclass-granted spell for an eligible spell of the same level from specific schools on the Sorcerer, Warlock, or Wizard spell lists.
_Avoid_: Spell reroll, school swap, spell retrain

**Expertise**:
A class feature (such as Rogue 1st/6th level, Bard 3rd/10th level, Knowledge Cleric 1st level, Ranger Deft Explorer, or the Skill Expert feat) that doubles the character's proficiency bonus (2 × PB) on ability checks using a chosen proficient skill or tool.
_Avoid_: Double proficiency, mastery, skill mastery, spec

**Scaling Combat Die**:
A class-specific die (such as Bardic Inspiration, Rogue Sneak Attack, or Monk Martial Arts) whose die face or dice pool size scales automatically at specific class level milestones.
_Avoid_: Growth die, level die, damage counter

**Categorical Weapon Proficiencies**:
Broad weapon proficiency groups ("Simple weapons", "Martial weapons") that supersede and deduplicate individual weapon proficiencies belonging to that category (e.g., Elf Longsword, Dwarf Battleaxe) on character sheets.
_Avoid_: Weapon bundles, mass proficiencies, weapon sets

**Monk Weapon**:
Shortswords and any simple melee weapons that do not have the two-handed or heavy property, allowing a Monk to use Dexterity for attack and damage rolls and substitute their scaling Martial Arts die if it is higher than the weapon's base damage die.
_Avoid_: Martial arts weapon, ki weapon

**Ki Spellcasting Profile**:
A class spellcasting profile for Monk traditions (Way of the Four Elements, Way of Shadow, Way of the Sun Soul) that cast spells using Ki points and Wisdom save DCs rather than traditional spell slots.
_Avoid_: Ki slots, discipline manager

**Movement Modes**:
The distinct rates of movement available to a character (walking, swimming, climbing, flying), each evaluated with its own rules, relative scaling, and armor restrictions.
_Avoid_: Alternate speeds, speed types, movement channels

**Ancestral Legacy**:
The rule governing when a character adopts a Lineage (Dhampir, Hexblood, Reborn), retaining the climbing, flying, or swimming speeds and skill proficiencies of their previous race while replacing other ancestral traits.
_Avoid_: Lineage inheritance, race carryover, hybrid perks

**Primal Knowledge**:
The TCoE Barbarian optional feature granting an additional skill proficiency from the Barbarian skill list at 3rd level and 10th level.
_Avoid_: Extra barbarian skills, barbarian bonus proficiencies

**Totem Milestone**:
The single animal spirit choice (Bear, Eagle, Wolf, Elk, Tiger) made at 3rd (Totem Spirit), 6th (Aspect of the Beast), and 14th (Totemic Attunement) level by a Path of the Totem Warrior Barbarian.
_Avoid_: Animal perk, totem toggle, spirit badge

**Fighting Style**:
A martial specialization chosen by Fighter (1st & 10th level), Paladin (2nd level), or Ranger (2nd level), or via the Fighting Initiate feat, granting a distinct passive combat modifier or tactical reaction.
_Avoid_: Martial stance, combat perk, weapon discipline

**Superiority Die**:
A combat die (d8, d10, d12, or d6) expended to fuel Battle Master maneuvers, recovering on a Short or Long Rest.
_Avoid_: Maneuver die, tactic counter, stamina die

**Maneuver**:
A tactical combat technique chosen by a Battle Master Fighter (or granted by Superior Technique or Martial Adept) modifying weapon attacks, reactions, or bonus actions.
_Avoid_: Combat skill, martial ability, trick

**Eldritch Invocation**:
A modular magical gift bestowed by an Otherworldly Patron starting at 2nd level Warlock (or via the Eldritch Adept feat), subject to level, pact boon, and spell prerequisites.
_Avoid_: Warlock talent, pact trait, eldritch perk

**Artificer Infusion**:
A magical augmentation formula known by an Artificer, used to infuse mundane objects or replicate magic items at the end of a Long Rest.
_Avoid_: Artificer craft, gadget, enchantment

**Active Infusion**:
A specific mundane item or replicated magic item currently infused by an Artificer, counting toward their simultaneous active infusion limit.
_Avoid_: Bound item, charged gadget

**Replicate Magic Item**:
An Artificer infusion that allows reproducing a specific magic item chosen from level-gated replicable item tables or common magic items.
_Avoid_: Item cloner, magic replicator

**Mystic Arcanum**:
A Warlock class feature unlocked at 11th (6th level), 13th (7th level), 15th (8th level), and 17th (9th level) level. Each Arcanum grants one spell of that tier cast once per Long Rest without expending a spell slot, tracked independently from Pact Magic slots.
_Avoid_: Warlock high slot, 6th-level pact slot, daily arcanum

**Pact of the Tome**:
A Warlock Pact Boon feature chosen at 3rd level granting a grimoire (Book of Shadows) with three cantrips chosen from any class spell list that count as Warlock spells using Charisma.
_Avoid_: Spell tome, grimoire boon, cantrip book

**Book of Ancient Secrets**:
An Eldritch Invocation requiring Pact of the Tome that grants ritual casting of Warlock spells, two 1st-level starting rituals from any class, and the ability to scribe new ritual spells into a dedicated Ritual Book.
_Avoid_: Ritual invocation, ritual master, secret book

**Ritual Book**:
A persistent ledger of transcribed rituals maintained by a character (such as a Tome Warlock with Book of Ancient Secrets), allowing ritual casting of inscribed spells up to half the character's rounded-up class level, independent of spells known limits.
_Avoid_: Spellbook, ritual pouch, extra known spells

**Resource Book Categories**:
The organizational grouping of official 2014 sourcebooks in Settings into Core Rules, Rule Supplements, Campaign Settings, Adventures, and Plane Shift / Extras, allowing players to bulk-toggle or fine-tune content accessibility across character creation.
_Avoid_: Source packs, book bundles, module filters

**Evaluated Character Engine**:
The unified domain module deriving all effective ability scores, combat statistics, class spell profiles, DCs, and resource counters in a single pass.
_Avoid_: Stat calculator, sheet loader, character transformer

**Character Reconciler**:
The idempotent domain module enforcing progression prerequisites, modular rule choice validity, and teardown invariants in a single pass.
_Avoid_: Choice cleaner, state sanitizer, pruning cascade

**Spellbook Ledger**:
The pure domain module governing spell slot expenditure, pact magic, sorcery points, ritual inscriptions, Mystic Arcanum, and the identity of known and prepared spells (learning, forgetting, preparing).
_Avoid_: Spell manager, casting controller, slot tracker

**Spell Owner**:
The class spellcasting feature, or granting feature such as Pact of the Tome or Path of the Giant, that a known or prepared spell belongs to. The same spell can be known or prepared separately per Spell Owner on a multiclass character.
_Avoid_: spell class, owner tag

**Tactical Action Ledger**:
The evaluated collection of standard actions, class bonus actions, reactions, and attack riders available to a character in combat.
_Avoid_: Action list, combat menu, ability roster

**Magic Item Variant**:
A template in the compendium (such as *Weapon, +1*, *Armor, +1*, or *Weapon of Warning*) that modifies a base mundane item with magical properties, rarity, and numerical bonuses.
_Avoid_: Item clone, custom preset, enchant template

**Attunement**:
The magical bond between a character and up to three magic items, tracked via dedicated attunement slots, required to activate and benefit from an attuned item's magical properties.
_Avoid_: Equipment binding, soul link, item sync

**Item Category**:
The canonical classification of equipment in the compendium and inventory (*Weapon*, *Armor*, *Shield*, *Potion*, *Ring*, *Rod*, *Wand*, *Scroll*, *Wondrous Item*, *Adventuring Gear*, *Tool*).
_Avoid_: Gear type, item group, classification tag

**Weapon Enhancement Bonus**:
The flat numerical bonus (+1, +2, +3) added to weapon attack rolls and damage formulas by magic weapons.
_Avoid_: Weapon plus, enchant stat, attack booster

**Armor Enhancement Bonus**:
The flat numerical bonus (+1, +2, +3) added to Armor Class by magic armor or shields.
_Avoid_: AC plus, defense upgrade, armor bonus

**SRD Baseline**:
The minimal, unencumbered player compendium strictly derived from the 5.1 System Reference Document (OGL/CC-BY) bundled directly with the application.
_Avoid_: Default books, base sourcebook, vanilla data

**Integrated Catalog**:
The complete player compendium fetched from 5e.tools and persisted in client storage (IndexedDB).
_Avoid_: Scraped dump, external database, download cache

**Sourcebook Gating**:
The UI restriction that hides all sourcebook selection and filtering controls until the Integrated Catalog has been successfully populated.
_Avoid_: Book lock, catalog curtain, toggle hiding

**Compendium**:
The synchronous, read-only view over the active player catalog (the SRD Baseline or the Integrated Catalog). Listings are scoped to the active sourcebooks; lookups by name are not, so a character's existing choices always resolve.
_Avoid_: data service, catalog store, content provider

**Dataset Swapping**:
The runtime cutover mechanism that unloads the SRD Baseline from memory and exclusively queries the Integrated Catalog once integration is active, preventing duplicate entities or overlapping source confusion.
_Avoid_: Source merging, database overriding, data overwrite
