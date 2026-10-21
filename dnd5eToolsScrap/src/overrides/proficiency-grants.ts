import type { GrantOverride } from "../parser/proficiency-grants.ts";

/**
 * Reviewed Proficiency Grants for features the extractor cannot parse.
 *
 * Names only: each entry says which feature (owner, feature name, level) and
 * which grants it has, with grant names. No rule prose goes in this file. An
 * entry replaces the extracted grants for its feature. An entry that names a
 * feature the scrape does not contain is an error.
 *
 * A TypeScript module rather than a JSON file, because the in-app scraper
 * bundles these modules and cannot read files at runtime.
 */
export const PROFICIENCY_GRANT_OVERRIDES: {
  classes: GrantOverride[];
  feats: GrantOverride[];
  races: GrantOverride[];
  subraces: GrantOverride[];
} = {
  subraces: [
    // Each of these gives one language of choice by its trait text, which the subrace's own entries do not
    // carry as a structured entry. An override replaces the whole block, so each keeps the weapon and armor
    // entries its record states.
    {
      owner: "Subrace",
      feature: "Gith (Githyanki)",
      level: 0,
      grants: [
        { kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
        { kind: "fixed", category: "weapons", names: ["shortsword", "longsword", "greatsword"] },
        { kind: "fixed", category: "armor", names: ["light armor", "medium armor"] },
      ],
    },
    {
      owner: "Subrace",
      feature: "Elf (Sea)",
      level: 0,
      grants: [
        { kind: "fixed", category: "languages", names: ["Common", "Elvish", "Aquan"] },
        { kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
        { kind: "fixed", category: "weapons", names: ["spear", "trident", "light crossbow", "net"] },
      ],
    },
    { owner: "Subrace", feature: "Elf (Kaladesh) (Vahadar)", level: 0, grants: [{ kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }] },
    { owner: "Subrace", feature: "Human (Amonkhet)", level: 0, grants: [{ kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }] },
    // These subraces' language entries restate their race's choice, so the subrace grants no language beyond the race.
    // Their fixed skills are kept, because an override replaces the whole structured block.
    { owner: "Subrace", feature: "Merfolk (Ixalan; Blue)", level: 0, grants: [{ kind: "fixed", category: "skills", names: ["History", "Nature"] }] },
    { owner: "Subrace", feature: "Merfolk (Ixalan; Green)", level: 0, grants: [] },
    { owner: "Subrace", feature: "Human (Keldon)", level: 0, grants: [{ kind: "fixed", category: "skills", names: ["Athletics"] }] },
  ],
  races: [
    // Its tool and skill come after each long rest, not as standing proficiencies, so the race holds
    // no tool grant. The language every character speaks, and the one language of choice, are kept.
    {
      owner: "Race",
      feature: "Githyanki",
      level: 0,
      grants: [
        { kind: "fixed", category: "languages", names: ["Common"] },
        { kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
      ],
    },
  ],
  classes: [
    { owner: "Artificer/Alchemist", feature: "Tool Proficiency", level: 3, grants: [{ kind: "fixed", category: "tools", names: ["alchemist's supplies"] }] },
    {
      owner: "Artificer/Armorer",
      feature: "Tools of the Trade",
      level: 3,
      grants: [
        { kind: "fixed", category: "armor", names: ["heavy armor"] },
        { kind: "fixed", category: "tools", names: ["smith's tools"] },
      ],
    },
    { owner: "Artificer/Artillerist", feature: "Tool Proficiency", level: 3, grants: [{ kind: "fixed", category: "tools", names: ["woodcarver's tools"] }] },
    { owner: "Artificer/Battle Smith", feature: "Tool Proficiency", level: 3, grants: [{ kind: "fixed", category: "tools", names: ["smith's tools"] }] },
    { owner: "Barbarian/Path of the Giant", feature: "Giant Power", level: 3, grants: [{ kind: "fixed", category: "languages", names: ["Giant"] }] },
    // The Tiger is one option of the Aspect of the Beast choice, so its skill choice applies only while that
    // pick names the Tiger. The requirement is the Catalog's gate; the grant itself is what the prose says.
    {
      owner: "Barbarian/Path of the Totem Warrior",
      feature: "Tiger",
      level: 6,
      grants: [
        {
          kind: "choice",
          category: "skills",
          count: 2,
          pool: { kind: "names", names: ["Athletics", "Acrobatics", "Stealth", "Survival"] },
          requires: { feature: "Aspect of the Beast", level: 6 },
        },
      ],
    },
    {
      owner: "Bard/College of Swords",
      feature: "Bonus Proficiencies",
      level: 3,
      grants: [
        { kind: "fixed", category: "armor", names: ["medium armor"] },
        { kind: "fixed", category: "weapons", names: ["scimitar"] },
      ],
    },
    {
      owner: "Cleric/Knowledge Domain",
      feature: "Blessings of Knowledge",
      level: 1,
      grants: [
        { kind: "choice", category: "languages", count: 2, pool: { kind: "any" } },
        { kind: "choice", category: "skills", count: 2, pool: { kind: "names", names: ["Arcana", "History", "Nature", "Religion"] } },
      ],
    },
    { owner: "Cleric/Death Domain", feature: "Bonus Proficiency", level: 1, grants: [{ kind: "fixed", category: "weapons", names: ["martial weapons"] }] },
    { owner: "Cleric/Arcana Domain", feature: "Arcane Initiate", level: 1, grants: [{ kind: "fixed", category: "skills", names: ["Arcana"] }] },
    { owner: "Druid", feature: "Druidic", level: 1, grants: [{ kind: "fixed", category: "languages", names: ["Druidic"] }] },
    {
      owner: "Fighter/Purple Dragon Knight (Banneret)",
      feature: "Royal Envoy",
      level: 7,
      grants: [{ kind: "fixed", category: "skills", names: ["Persuasion"] }],
    },
    {
      owner: "Fighter/Arcane Archer",
      feature: "Arcane Archer Lore",
      level: 3,
      grants: [{ kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["Arcana", "Nature"] } }],
    },
    {
      owner: "Fighter/Cavalier",
      feature: "Bonus Proficiency",
      level: 3,
      grants: [
        {
          kind: "choice",
          category: "skills",
          count: 1,
          pool: { kind: "names", names: ["Animal Handling", "History", "Insight", "Performance", "Persuasion"] },
        },
      ],
    },
    {
      owner: "Fighter/Samurai",
      feature: "Bonus Proficiency",
      level: 3,
      grants: [{ kind: "choice", category: "skills", count: 1, pool: { kind: "names", names: ["History", "Insight", "Performance", "Persuasion"] } }],
    },
    { owner: "Fighter/Samurai", feature: "Elegant Courtier", level: 7, grants: [{ kind: "fixed", category: "savingThrows", names: ["Wisdom"] }] },
    {
      owner: "Fighter/Rune Knight",
      feature: "Bonus Proficiencies",
      level: 3,
      grants: [
        { kind: "fixed", category: "tools", names: ["smith's tools"] },
        { kind: "fixed", category: "languages", names: ["Giant"] },
      ],
    },
    // The brush choice is #0 and stays first, so its shipped grant id does not change.
    {
      owner: "Monk/Way of the Kensei",
      feature: "Path of the Kensei",
      level: 3,
      grants: [
        { kind: "choice", category: "tools", count: 1, pool: { kind: "names", names: ["calligrapher's supplies", "painter's supplies"] } },
        { kind: "choice", category: "weapons", count: 1, pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"], attackType: "melee" } },
        { kind: "choice", category: "weapons", count: 1, pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"], attackType: "ranged" } },
      ],
    },
    // Later kensei weapons are either kind: "another type of weapon, either melee or ranged".
    {
      owner: "Monk/Way of the Kensei",
      feature: "One with the Blade",
      level: 6,
      grants: [{ kind: "choice", category: "weapons", count: 1, pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"] } }],
    },
    {
      owner: "Monk/Way of the Kensei",
      feature: "Sharpen the Blade",
      level: 11,
      grants: [{ kind: "choice", category: "weapons", count: 1, pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"] } }],
    },
    {
      owner: "Monk/Way of the Kensei",
      feature: "Unerring Accuracy",
      level: 17,
      grants: [{ kind: "choice", category: "weapons", count: 1, pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["heavy", "special"], plus: ["longbow"] } }],
    },
    {
      owner: "Monk/Way of Mercy",
      feature: "Implements of Mercy",
      level: 3,
      grants: [
        { kind: "fixed", category: "skills", names: ["Insight", "Medicine"] },
        { kind: "fixed", category: "tools", names: ["herbalism kit"] },
      ],
    },
    { owner: "Monk/Way of the Ascendant Dragon", feature: "Draconic Disciple", level: 3, grants: [{ kind: "fixed", category: "languages", names: ["Draconic"] }] },
    { owner: "Ranger", feature: "Deft Explorer", level: 1, grants: [{ kind: "choice", category: "languages", count: 2, pool: { kind: "any" } }] },
    { owner: "Ranger", feature: "Favored Enemy", level: 1, grants: [{ kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }] },
    {
      owner: "Ranger",
      feature: "Favored Enemy and Natural Explorer improvements",
      level: 6,
      grants: [{ kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }],
    },
    { owner: "Ranger", feature: "Favored Enemy improvement", level: 14, grants: [{ kind: "choice", category: "languages", count: 1, pool: { kind: "any" } }] },
    { owner: "Ranger/Gloom Stalker", feature: "Iron Mind", level: 7, grants: [{ kind: "fixed", category: "savingThrows", names: ["Wisdom"] }] },
    { owner: "Ranger/Drakewarden", feature: "Draconic Gift", level: 3, grants: [{ kind: "fixed", category: "languages", names: ["Draconic"] }] },
    {
      owner: "Rogue/Mastermind",
      feature: "Master of Intrigue",
      level: 3,
      grants: [
        { kind: "fixed", category: "tools", names: ["disguise kit", "forgery kit"] },
        {
          kind: "choice",
          category: "tools",
          count: 1,
          pool: { kind: "names", names: ["dice set", "dragonchess set", "playing card set", "three-dragon ante set"] },
        },
        { kind: "choice", category: "languages", count: 2, pool: { kind: "any" } },
      ],
    },
    { owner: "Rogue/Scout", feature: "Survivalist", level: 3, grants: [{ kind: "fixed", category: "skills", names: ["Nature", "Survival"] }] },
    { owner: "Sorcerer/Draconic Bloodline", feature: "Dragon Ancestor", level: 1, grants: [{ kind: "fixed", category: "languages", names: ["Draconic"] }] },
    { owner: "Sorcerer/Storm Sorcery", feature: "Wind Speaker", level: 1, grants: [{ kind: "fixed", category: "languages", names: ["Primordial"] }] },
    {
      owner: "Warlock/The Hexblade",
      feature: "Hex Warrior",
      level: 1,
      grants: [
        { kind: "fixed", category: "armor", names: ["medium armor", "shields"] },
        { kind: "fixed", category: "weapons", names: ["martial weapons"] },
      ],
    },
    {
      owner: "Wizard/Bladesinging",
      feature: "Training in War and Song (Bladesinging)",
      level: 2,
      grants: [
        { kind: "fixed", category: "armor", names: ["light armor"] },
        { kind: "fixed", category: "skills", names: ["Performance"] },
        {
          kind: "choice",
          category: "weapons",
          count: 1,
          pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: ["two-handed"], plus: [], attackType: "melee" },
        },
      ],
    },
    {
      owner: "Expert Sidekick",
      feature: "Bonus Proficiencies",
      level: 1,
      grants: [
        { kind: "choice", category: "savingThrows", count: 1, pool: { kind: "names", names: ["Dexterity", "Intelligence", "Charisma"] } },
        { kind: "choice", category: "skills", count: 5, pool: { kind: "any" } },
        { kind: "fixed", category: "armor", names: ["light armor"] },
      ],
    },
    {
      owner: "Spellcaster Sidekick",
      feature: "Bonus Proficiencies",
      level: 1,
      grants: [
        { kind: "choice", category: "savingThrows", count: 1, pool: { kind: "names", names: ["Wisdom", "Intelligence", "Charisma"] } },
        {
          kind: "choice",
          category: "skills",
          count: 2,
          pool: {
            kind: "names",
            names: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Performance", "Persuasion", "Religion"],
          },
        },
        { kind: "fixed", category: "armor", names: ["light armor"] },
      ],
    },
    {
      owner: "Warrior Sidekick",
      feature: "Bonus Proficiencies",
      level: 1,
      grants: [
        { kind: "choice", category: "savingThrows", count: 1, pool: { kind: "names", names: ["Strength", "Dexterity", "Constitution"] } },
        {
          kind: "choice",
          category: "skills",
          count: 2,
          pool: {
            kind: "names",
            names: ["Acrobatics", "Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"],
          },
        },
        { kind: "fixed", category: "armor", names: ["light armor", "medium armor", "heavy armor"] },
      ],
    },
  ],
  feats: [
    {
      owner: "Feat",
      feature: "Artificer Initiate",
      level: 0,
      grants: [
        {
          kind: "choice",
          category: "tools",
          count: 1,
          pool: {
            kind: "names",
            names: [
              "alchemist's supplies", "brewer's supplies", "calligrapher's supplies", "carpenter's tools",
              "cartographer's tools", "cobbler's tools", "cook's utensils", "glassblower's tools", "jeweler's tools",
              "leatherworker's tools", "mason's tools", "painter's supplies", "potter's tools", "smith's tools",
              "tinker's tools", "weaver's tools", "woodcarver's tools",
            ],
          },
        },
      ],
    },
    { owner: "Feat", feature: "Chef", level: 0, grants: [{ kind: "fixed", category: "tools", names: ["cook's utensils"] }] },
    { owner: "Feat", feature: "Gunner", level: 0, grants: [{ kind: "fixed", category: "weapons", names: ["firearms"] }] },
    { owner: "Feat", feature: "Linguist", level: 0, grants: [{ kind: "choice", category: "languages", count: 3, pool: { kind: "any" } }] },
    { owner: "Feat", feature: "Poisoner", level: 0, grants: [{ kind: "fixed", category: "tools", names: ["poisoner's kit"] }] },
    {
      owner: "Feat",
      feature: "Prodigy",
      level: 0,
      grants: [
        { kind: "choice", category: "skills", count: 1, pool: { kind: "any" } },
        { kind: "choice", category: "tools", count: 1, pool: { kind: "any" } },
        { kind: "choice", category: "languages", count: 1, pool: { kind: "any" } },
      ],
    },
    { owner: "Feat", feature: "Quicksmithing", level: 0, grants: [{ kind: "fixed", category: "tools", names: ["quicksmith's tools"] }] },
    {
      owner: "Feat",
      feature: "Resilient",
      level: 0,
      grants: [
        {
          kind: "choice",
          category: "savingThrows",
          count: 1,
          pool: { kind: "names", names: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] },
        },
      ],
    },
    { owner: "Feat", feature: "Skill Expert", level: 0, grants: [{ kind: "choice", category: "skills", count: 1, pool: { kind: "any" } }] },
    { owner: "Feat", feature: "Skilled", level: 0, grants: [{ kind: "choice", category: "skills", count: 3, pool: { kind: "any" } }] },
    { owner: "Feat", feature: "Tavern Brawler", level: 0, grants: [{ kind: "fixed", category: "weapons", names: ["improvised weapons"] }] },
    {
      owner: "Feat",
      feature: "Weapon Master",
      level: 0,
      grants: [
        {
          kind: "choice",
          category: "weapons",
          count: 4,
          pool: { kind: "weapons", base: ["simple", "martial"], withoutProperties: [], plus: [] },
        },
      ],
    },
  ],
};

/** A feature, named by owner, feature name and level, with no rule prose. */
export interface ReviewedFeature {
  owner: string;
  feature: string;
  level: number;
}

/**
 * Features reviewed and found to grant no proficiency, though their prose
 * matches the proficiency vocabulary. Names only. The coverage gate fails on a
 * mark that names an unknown feature, or a feature that has grants.
 */
export const REVIEWED_GRANTS_NOTHING: ReviewedFeature[] = [
  // A table option (optional rule), not a grant every Artificer has.
  { owner: "Artificer", feature: "Optional Rule: Firearm Proficiency", level: 1 },
  // Header stubs that only list their sub-features.
  { owner: "Artificer/Alchemist", feature: "Alchemist", level: 3 },
  { owner: "Artificer/Artillerist", feature: "Artillerist", level: 3 },
  { owner: "Artificer/Battle Smith", feature: "Battle Smith", level: 3 },
  { owner: "Bard/College of Lore", feature: "College of Lore", level: 3 },
  { owner: "Bard/College of Valor", feature: "College of Valor", level: 3 },
  { owner: "Bard/College of Swords", feature: "College of Swords", level: 3 },
  { owner: "Cleric/Life Domain", feature: "Life Domain", level: 1 },
  { owner: "Cleric/Nature Domain", feature: "Nature Domain", level: 1 },
  { owner: "Cleric/Tempest Domain", feature: "Tempest Domain", level: 1 },
  { owner: "Cleric/War Domain", feature: "War Domain", level: 1 },
  { owner: "Cleric/Death Domain", feature: "Death Domain", level: 1 },
  { owner: "Cleric/Solidarity Domain (PSA)", feature: "Solidarity Domain (PSA)", level: 1 },
  { owner: "Cleric/Strength Domain (PSA)", feature: "Strength Domain (PSA)", level: 1 },
  { owner: "Cleric/Zeal Domain (PSA)", feature: "Zeal Domain (PSA)", level: 1 },
  { owner: "Cleric/Forge Domain", feature: "Forge Domain", level: 1 },
  { owner: "Cleric/Order Domain", feature: "Order Domain", level: 1 },
  { owner: "Cleric/Twilight Domain", feature: "Twilight Domain", level: 1 },
  { owner: "Fighter/Cavalier", feature: "Cavalier", level: 3 },
  { owner: "Fighter/Samurai", feature: "Samurai", level: 3 },
  { owner: "Fighter/Rune Knight", feature: "Rune Knight", level: 3 },
  { owner: "Monk/Way of the Drunken Master", feature: "Way of the Drunken Master", level: 3 },
  { owner: "Rogue/Assassin", feature: "Assassin", level: 3 },
  // Expertise and proficiency-bonus features.
  { owner: "Artificer", feature: "Tool Expertise", level: 6 },
  { owner: "Bard", feature: "Expertise", level: 3 },
  { owner: "Bard", feature: "Expertise", level: 10 },
  { owner: "Bard", feature: "Bardic Versatility", level: 4 },
  { owner: "Rogue", feature: "Expertise", level: 1 },
  { owner: "Rogue", feature: "Expertise", level: 6 },
  { owner: "Expert Sidekick", feature: "Expertise", level: 3 },
  { owner: "Expert Sidekick", feature: "Expertise", level: 15 },
  { owner: "Ranger", feature: "Natural Explorer", level: 1 },
  { owner: "Ranger/Beast Master", feature: "Ranger's Companion", level: 3 },
  { owner: "Mystic", feature: "Strength of Mind", level: 4 },
  // Features whose proficiency is a rule choice, a temporary or swappable grant, or a sense rather than a grant.
  { owner: "Barbarian", feature: "Primal Knowledge", level: 3 },
  { owner: "Cleric/Knowledge Domain", feature: "Channel Divinity: Knowledge of the Ages", level: 2 },
  { owner: "Druid", feature: "Wild Shape", level: 2 },
  { owner: "Monk", feature: "Deflect Missiles", level: 3 },
  { owner: "Monk", feature: "Tongue of the Sun and Moon", level: 13 },
  { owner: "Monk/Way of the Sun Soul", feature: "Radiant Sun Bolt", level: 3 },
  { owner: "Mystic", feature: "Telepathy", level: 2 },
  { owner: "Mystic/Order of the Nomad", feature: "Breadth of Knowledge", level: 1 },
  { owner: "Rogue/Thief", feature: "Thief", level: 3 },
  { owner: "Rogue/Phantom", feature: "Whispers of the Dead", level: 3 },
  { owner: "Rogue/Phantom", feature: "Tokens of the Departed", level: 9 },
  { owner: "Rogue/Soulknife", feature: "Psychic Whispers", level: 3 },
  { owner: "Expert Sidekick", feature: "Sidekick Class", level: 1 },
  { owner: "Spellcaster Sidekick", feature: "Sidekick Class", level: 1 },
  { owner: "Sorcerer/Aberrant Mind", feature: "Telepathic Speech", level: 1 },
  { owner: "Warlock/The Great Old One", feature: "Awakened Mind", level: 1 },
  { owner: "Wizard/School of Divination", feature: "The Third Eye", level: 10 },
  { owner: "Wizard/School of Transmutation", feature: "Transmuter's Stone", level: 6 },
  // Feats.
  { owner: "Feat", feature: "Great Weapon Master", level: 0 },
  { owner: "Feat", feature: "Initiate of High Sorcery", level: 0 },
  { owner: "Feat", feature: "Rune Shaper", level: 0 },
  { owner: "Feat", feature: "Sharpshooter", level: 0 },
  { owner: "Feat", feature: "Telepathic", level: 0 },
];
