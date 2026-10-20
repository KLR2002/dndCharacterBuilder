# Review decisions for ticket 02 (main session)

Names only. Each row is a feature (owner / feature / level) and the grants to write in the override file. `fixed` = names granted outright. `choose N from [..]` = a Proficiency Choice with a names pool. `choose N any` = pool `any`. Categories: skills, tools, languages, weapons, armor, savingThrows. Use the same casing the scraper uses for names already in the enriched data (for example "heavy armor" there; the Proficiency Sheet normalizes later).

Rules applied: a fixed grant stays fixed even when the book says "if you already have it, pick another" (the user decided that duplicates are kept once); an either/or across categories (skill OR language) models only the skills choice; conditional grants (for example "if it is a humanoid") are left out; features whose grant is temporary, swappable at rests, or already handled by a Rule Choice are marked "reviewed, grants nothing".

## Grants to add

| Owner | Feature (level) | Grants |
|---|---|---|
| Artificer | Optional Rule: Firearm Proficiency (1) | weapons fixed: Firearms |
| Artificer/Alchemist | Tool Proficiency (3) | tools fixed: Alchemist's Supplies |
| Artificer/Armorer | Tools of the Trade (3) | armor fixed: Heavy armor; tools fixed: Smith's Tools |
| Artificer/Artillerist | Tool Proficiency (3) | tools fixed: Woodcarver's Tools |
| Artificer/Battle Smith | Tool Proficiency (3) | tools fixed: Smith's Tools |
| Barbarian/Path of the Giant | Giant Power (3) | languages fixed: Giant |
| Bard/College of Swords | Bonus Proficiencies (3) | armor fixed: Medium armor; weapons fixed: Scimitars |
| Cleric/Knowledge Domain | Blessings of Knowledge (1) | languages choose 2 any; skills choose 2 from [Arcana, History, Nature, Religion] |
| Cleric/Death Domain | Bonus Proficiency (1) | weapons fixed: Martial weapons |
| Cleric/Arcana Domain | Arcane Initiate (1) | skills fixed: Arcana |
| Druid | Druidic (1) | languages fixed: Druidic |
| Fighter/Purple Dragon Knight (Banneret) | Royal Envoy (7) | skills fixed: Persuasion |
| Fighter/Arcane Archer | Arcane Archer Lore (3) | skills choose 1 from [Arcana, Nature] |
| Fighter/Cavalier | Bonus Proficiency (3) | skills choose 1 from [Animal Handling, History, Insight, Performance, Persuasion] |
| Fighter/Samurai | Bonus Proficiency (3) | skills choose 1 from [History, Insight, Performance, Persuasion] |
| Fighter/Samurai | Elegant Courtier (7) | savingThrows fixed: Wisdom |
| Fighter/Rune Knight | Bonus Proficiencies (3) | tools fixed: Smith's Tools; languages fixed: Giant |
| Monk/Way of the Kensei | Path of the Kensei (3) | tools choose 1 from [Calligrapher's Supplies, Painter's Supplies] (the kensei weapons choices come with the Kensei weapons ticket) |
| Monk/Way of Mercy | Implements of Mercy (3) | skills fixed: Insight, Medicine; tools fixed: Herbalism Kit |
| Monk/Way of the Ascendant Dragon | Draconic Disciple (3) | languages fixed: Draconic |
| Ranger | Deft Explorer (1) | languages choose 2 any |
| Ranger | Favored Enemy (1) | languages choose 1 any |
| Ranger | Favored Enemy and Natural Explorer improvements (6) | languages choose 1 any |
| Ranger | Favored Enemy improvement (14) | languages choose 1 any |
| Ranger/Gloom Stalker | Iron Mind (7) | savingThrows fixed: Wisdom |
| Ranger/Drakewarden | Draconic Gift (3) | languages fixed: Draconic |
| Rogue/Mastermind | Master of Intrigue (3) | tools fixed: Disguise Kit, Forgery Kit; tools choose 1 from [Dice Set, Dragonchess Set, Playing Card Set, Three-Dragon Ante Set]; languages choose 2 any |
| Rogue/Scout | Survivalist (3) | skills fixed: Nature, Survival |
| Sorcerer/Draconic Bloodline | Dragon Ancestor (1) | languages fixed: Draconic |
| Sorcerer/Storm Sorcery | Wind Speaker (1) | languages fixed: Primordial |
| Warlock/The Hexblade | Hex Warrior (1) | armor fixed: Medium armor, Shields; weapons fixed: Martial weapons |
| Wizard/Bladesinging | Training in War and Song (Bladesinging) (2) | armor fixed: Light armor; skills fixed: Performance; weapons choose 1 from a weapons pool: simple and martial, without two-handed, melee only |
| Expert Sidekick | Bonus Proficiencies (1) | savingThrows choose 1 from [Dexterity, Intelligence, Charisma]; skills choose 5 any; armor fixed: Light armor |
| Spellcaster Sidekick | Bonus Proficiencies (1) | savingThrows choose 1 from [Wisdom, Intelligence, Charisma]; skills choose 2 from [Arcana, History, Insight, Investigation, Medicine, Performance, Persuasion, Religion]; armor fixed: Light armor |
| Warrior Sidekick | Bonus Proficiencies (1) | savingThrows choose 1 from [Strength, Dexterity, Constitution]; skills choose 2 from [Acrobatics, Animal Handling, Athletics, Intimidation, Nature, Perception, Survival]; armor fixed: Light armor, Medium armor, Heavy armor |
| Feat | Artificer Initiate | tools choose 1 from the seventeen artisan's tools |
| Feat | Chef | tools fixed: Cook's Utensils |
| Feat | Gunner | weapons fixed: Firearms |
| Feat | Linguist | languages choose 3 any |
| Feat | Poisoner | tools fixed: Poisoner's Kit |
| Feat | Prodigy | skills choose 1 any; tools choose 1 any; languages choose 1 any |
| Feat | Quicksmithing | tools fixed: Quicksmith's Tools |
| Feat | Resilient | savingThrows choose 1 from the six abilities (the Proficiency Sheet ticket for saving throws will tie it to the ability the feat raises) |
| Feat | Skill Expert | skills choose 1 any |
| Feat | Skilled | skills choose 3 any (the "or tools" half cannot be modelled; the player can add tools by hand) |
| Feat | Tavern Brawler | weapons fixed: Improvised weapons |
| Feat | Weapon Master | weapons choose 4 from a weapons pool: simple and martial, no excluded properties |

The weapons pool type needs one optional new field, `attackType?: "melee" | "ranged"`, added to the type in `dnd5eToolsScrap/src/types/proficiency.ts`.

## Reviewed, grants nothing (marks)

Everything else the matcher flags after the noise reduction below, including at least: Artificer / Spellcasting, Tool Expertise; every Expertise feature of Bard and Rogue and the sidekick Expertise features; Bardic Versatility; Barbarian / Primal Knowledge (a Rule Choice handles it); Cleric / Channel Divinity: Knowledge of the Ages; Druid / Wild Shape; Monk / Dedicated Weapon, Deflect Missiles, Tongue of the Sun and Moon; Way of the Sun Soul / Radiant Sun Bolt; Mystic / Telepathy, Strength of Mind; Mystic/Order of the Nomad / Breadth of Knowledge; Ranger / Natural Explorer; Ranger/Beast Master / Ranger's Companion; Rogue/Thief / Thief; Rogue/Swashbuckler / Panache; Rogue/Phantom / Whispers of the Dead, Tokens of the Departed; Rogue/Soulknife / Psi-Bolstered Knack, Psychic Whispers; the three sidekick "Sidekick Class" features; Sorcerer/Aberrant Mind / Telepathic Speech; Warlock/The Great Old One / Awakened Mind; Bard/College of Whispers / Shadow Lore; Bard/College of Eloquence / Universal Speech; the feats Crossbow Expert, Defensive Duelist, Great Weapon Master, Initiate of High Sorcery, Observant, Rune Shaper, Sharpshooter, Telepathic; the "header" stub features that only list their sub-features (for example Alchemist, Artillerist, Battle Smith, the college and domain headings); the feats and features whose only match is a saving throw DC formula or the proficiency bonus.

## Noise reduction for the matcher

The vocabulary matcher also flags sentences that only mention the proficiency bonus (for example "your proficiency bonus is doubled", "8 + your proficiency bonus + your modifier"), saving throw DC formulas, conditional references to a proficiency the character already has ("a weapon you are proficient with", "if you're proficient with…", "with which you have proficiency", "you must be proficient"), and language words that are not grants ("share a language", "the language you speak", "a language you know"). These must not count as matches. Tighten the matcher accordingly, with a test on invented sentences for each excluded kind, and keep a regression test that every feature in the "Grants to add" table above is still matched (by name, over the tracked data) before its override exists.

## Notes for the user (go into the final review.md)

- Either/or grants (Cavalier and Samurai: a skill, or alternatively a language) model only the skill choice. The language alternative can be added by hand.
- "If you already have it, choose another" is not modelled, by decision: a duplicate fixed grant is kept once.
- Skilled ("three skills or tools") is modelled as three skills; tools can be added by hand.
- Resilient's choice is a free pick of one ability until the saving-throw ticket ties it to the feat's raised ability.
- Sidekick classes keep only the unconditional parts of their bonus proficiencies.
- The Kensei weapons choices are not in this batch; they come with the Kensei weapons ticket.
