/** The Sorcerer's Metamagic options: the name, the sorcery point cost and the rule text. */
export const METAMAGIC_OPTIONS = [
  {
    name: "Careful Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell's full force. Spend 1 sorcery point and choose up to Cha mod creatures; they automatically succeed on their save.",
  },
  {
    name: "Distant Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that has a range of 5 feet or greater, you can spend 1 sorcery point to double the range of the spell. When you cast a spell that has a range of touch, you can spend 1 sorcery point to make the range 30 feet.",
  },
  {
    name: "Empowered Spell",
    cost: "1 Sorcery Point",
    desc: "When you roll damage for a spell, you can spend 1 sorcery point to reroll a number of damage dice up to your Charisma modifier (minimum of one). You must use the new rolls.",
  },
  {
    name: "Extended Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell that has a duration of 1 minute or longer, you can spend 1 sorcery point to double its duration, to a maximum duration of 24 hours.",
  },
  {
    name: "Heightened Spell",
    cost: "3 Sorcery Points",
    desc: "When you cast a spell that forces a creature to make a saving throw to resist its effects, you can spend 3 sorcery points to give one target of the spell disadvantage on its first saving throw made against the spell.",
  },
  {
    name: "Quickened Spell",
    cost: "2 Sorcery Points",
    desc: "When you cast a spell that has a casting time of 1 action, you can spend 2 sorcery points to change the casting time to 1 bonus action for this casting.",
  },
  {
    name: "Subtle Spell",
    cost: "1 Sorcery Point",
    desc: "When you cast a spell, you can spend 1 sorcery point to cast it without somatic or verbal components.",
  },
  {
    name: "Twinned Spell",
    cost: "Spell Level (1 for Cantrip)",
    desc: "When you cast a spell that targets only one creature and doesn't have a range of self, you can spend sorcery points equal to the spell's level (1 for cantrip) to target a second creature in range with the same spell.",
  },
];
