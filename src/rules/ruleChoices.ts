import type { Character, RuleChoiceEntry } from "../types/character.ts";
import type { RaceData, TraitChoiceData, TraitData } from "../types/dnd5e.ts";
import { ALL_RESOURCE_BOOKS } from "../constants/books.ts";
import { getSpells } from "../services/dataService.ts";
import { setRuleChoicePick } from "./builderTransitions.ts";
import { totalLevel } from "./proficiencies.ts";
import { DND_SKILLS } from "../constants/rules.ts";
import { RACE_SKILL_PROFICIENCIES, skills } from "./skills.ts";

import {
  type AvailableRuleChoice,
  formatCantripOptions,
  getSubclassName,
  ruleChoiceId,
} from "./choices/types.ts";
import {
  fightingStyleRuleChoices,
  pickFightingStyleChoice,
} from "./choices/fightingStyles.ts";
import {
  battleMasterManeuverChoices,
  isManeuverChoiceId,
} from "./choices/maneuvers.ts";
import {
  warlockPactBoonChoices,
  warlockTomeCantripChoices,
  warlockAncientSecretsStartingRituals,
  warlockMysticArcanumChoices,
  warlockInvocationChoices,
  isMysticArcanumChoiceId,
  isInvocationChoiceId,
  syncWarlockTomeCantrips,
  syncAncientSecretsRituals,
  pruneInvalidInvocations,
  pruneInvalidMysticArcanum,
} from "./choices/warlockChoices.ts";
import {
  artificerInfusionChoices,
  isInfusionChoiceId,
  pickInfusionChoice,
} from "./choices/artificerInfusions.ts";

export * from "./choices/types.ts";
export * from "./choices/fightingStyles.ts";
export * from "./choices/maneuvers.ts";
export * from "./choices/warlockChoices.ts";
export * from "./choices/artificerInfusions.ts";

export const BARBARIAN_CLASS_SKILLS = [
  "Animal Handling",
  "Athletics",
  "Intimidation",
  "Nature",
  "Perception",
  "Survival",
] as const;

export function getUnchosenBarbarianSkills(
  character: Character,
  currentChoiceId: string
): string[] {
  // Build a temporary character without this specific choice's picks so current pick isn't filtered out
  const tempChar: Character = {
    ...character,
    ruleChoices: (character.ruleChoices || []).filter((rc) => rc.id !== currentChoiceId),
  };

  const evalSkills = skills(tempChar);
  const proficientFromOtherSources = new Set(
    evalSkills.filter((s) => s.isProficient).map((s) => s.name.toLowerCase())
  );

  const currentPicked = new Set(
    (character.ruleChoices?.find((rc) => rc.id === currentChoiceId)?.picked || []).map((p) =>
      p.toLowerCase()
    )
  );

  return BARBARIAN_CLASS_SKILLS.filter(
    (skill) =>
      currentPicked.has(skill.toLowerCase()) ||
      !proficientFromOtherSources.has(skill.toLowerCase())
  );
}

/**
 * A Rule Choice is a selection from a fixed set of options granted by a single
 * trait, of which exactly one takes effect. The catalog declares them
 * declaratively; this module resolves them for a character.
 *
 * Choice identity leads with source because two ancestries share a subrace
 * name - DMG and MToF both ship an Eladrin, with different Fey Step text.
 */

export const LINEAGE_NAMES = new Set(["Dhampir", "Hexblood", "Reborn"]);

export function lineageInheritsElements(character: Character, raceCatalog: RaceData[]): boolean {
  if (!character.lineageReplacement || !character.race?.name) return false;
  if (LINEAGE_NAMES.has(character.race.name)) return false;

  const priorRace = raceCatalog.find(
    (r) => r.name === character.race?.name && (!character.race?.source || r.source === character.race.source)
  );
  const priorSubrace = character.race?.subraceName
    ? priorRace?.subraces?.find(
        (s) =>
          s.name === character.race?.subraceName &&
          (!character.race?.subraceSource || s.source === character.race.subraceSource)
      )
    : undefined;

  const hasSpecialSpeed = Boolean(
    ((priorRace?.speed?.swim ?? 0) > 0) ||
    ((priorRace?.speed?.climb ?? 0) > 0) ||
    ((priorRace?.speed?.fly ?? 0) > 0) ||
    ((priorSubrace?.speed?.swim ?? 0) > 0) ||
    ((priorSubrace?.speed?.climb ?? 0) > 0) ||
    ((priorSubrace?.speed?.fly ?? 0) > 0)
  );

  let hasSkills = Boolean(
    (priorRace?.name && (RACE_SKILL_PROFICIENCIES[priorRace.name]?.length ?? 0) > 0) ||
    (priorSubrace?.name && (RACE_SKILL_PROFICIENCIES[priorSubrace.name]?.length ?? 0) > 0)
  );

  if (!hasSkills) {
    const priorTraits = [...(priorRace?.traits || []), ...(priorSubrace?.traits || [])];
    for (const t of priorTraits) {
      const desc = t.description || "";
      for (const skill of DND_SKILLS) {
        const reg = new RegExp(
          `(?:proficient in|proficiency in)(?: the)?\\s+${skill.name}\\s+skill|\\{@skill\\s+${skill.name}\\}`,
          "i"
        );
        if (reg.test(desc)) {
          hasSkills = true;
          break;
        }
      }
      if (hasSkills) break;
    }
  }

  return hasSpecialSpeed || hasSkills;
}

/**
 * Every Rule Choice the character's ancestry grants, ignoring level gating.
 * Level gating is applied by `availableRuleChoices`, which needs the level.
 */
export function ancestryRuleChoices(character: Character, raceCatalog: RaceData[]): AvailableRuleChoice[] {
  const choice = character.race;
  const lineageName = character.lineageReplacement || (choice && LINEAGE_NAMES.has(choice.name) ? choice.name : null);

  if (lineageName) {
    const inherits = lineageInheritsElements(character, raceCatalog);
    if (!inherits) {
      return [
        {
          id: ruleChoiceId({ source: "VRGR", race: lineageName, trait: "Ancestral Legacy" }),
          traitName: "Ancestral Legacy: Skill Proficiencies",
          choose: 2,
          level: 1,
          effectLevel: 1,
          options: DND_SKILLS.map((s) => ({
            name: s.name,
            description: `Gain proficiency in ${s.name} (${s.ability.toUpperCase()})`,
          })),
        },
      ];
    }
    return [];
  }

  if (!choice) return [];

  const race = raceCatalog.find(
    (r) => r.name === choice.name && (!choice.source || r.source === choice.source)
  );
  const subrace = choice.subraceName
    ? race?.subraces?.find(
        (s) =>
          s.name === choice.subraceName &&
          (!choice.subraceSource || s.source === choice.subraceSource)
      )
    : undefined;

  const source = subrace?.source ?? choice.source;
  const traitSource = subrace ? source : race?.source ?? choice.source;

  const toChoice = (trait: TraitData, data: TraitChoiceData): AvailableRuleChoice => ({
    id: ruleChoiceId({ source: traitSource, race: choice.name, subrace: subrace ? { name: subrace.name } : null, trait: trait.name }),
    traitName: trait.name,
    choose: data.pick,
    level: data.level,
    effectLevel: data.effectLevel ?? data.level,
    ...(data.replaces ? { replaces: data.replaces } : {}),
    options: data.options,
  });

  const out: AvailableRuleChoice[] = [];
  for (const trait of [...(race?.traits ?? []), ...(subrace?.traits ?? [])]) {
    if (trait.choice) out.push(toChoice(trait, trait.choice));
  }
  return out;
}

/**
 * The Rule Choices a character may make right now: gated by level, and by the
 * active resource books. Below its level a choice is absent rather than locked.
 */
export function availableRuleChoices(
  character: Character,
  raceCatalog: RaceData[],
  level?: number,
  activeBooks?: string[]
): AvailableRuleChoice[] {
  const currentLevel = level ?? totalLevel(character);
  const books = activeBooks ? new Set(activeBooks.map((b) => b.toUpperCase())) : null;

  return ancestryRuleChoices(character, raceCatalog).filter((choice) => {
    if (choice.level > currentLevel) return false;
    if (books) {
      const source = choice.id.split("__")[0]?.toUpperCase();
      if (source && !books.has(source)) return false;
    }
    return true;
  });
}

/**
 * Resolves a granted feature against the character's recorded choice.
 *
 * A trait that grants a Rule Choice keeps its own prose and gains the chosen
 * option's text beneath it, but only once the character's level reaches the
 * choice's effect level. The trait is suppressed entirely when the catalog marks
 * the choice as replacing it.
 */
export function applyRuleChoice<T extends { name: string; description: string }>(
  character: Character,
  feature: T,
  data: TraitChoiceData | undefined,
  choiceId: string
): T & { chosenOption?: string; suppressed?: boolean } {
  if (!data) return feature;

  const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choiceId);
  const picked = entry?.picked?.[0];

  const option = picked && data.options.find((o) => o.name === picked);
  const inEffect = option != null && totalLevel(character) >= (data.effectLevel ?? data.level);

  // A trait that grants a choice has the options rendered into its description
  // upstream, so the sheet would list every option regardless of the pick. Show
  // the trait's own prose plus only the chosen option's effect.
  const base = withoutOptionList(feature.description, data);
  if (!inEffect || !option) return { ...feature, description: base, chosenOption: undefined };

  return {
    ...feature,
    chosenOption: option.name,
    description: base
      ? `${base}\n\n**${option.name}** ${option.description}`
      : `**${option.name}** ${option.description}`,
  };
}

/**
 * Drops the trailing bullet list of options a choice-granting trait carries, so
 * the sheet shows the chosen option rather than every option. Falls back to the
 * original text when no such list is found.
 */
function withoutOptionList(description: string, data: TraitChoiceData): string {
  const first = data.options[0]?.name;
  if (!description || !first) return description;
  // The option list renders as a heading ("### Name"), a bullet ("- **Name**") or
  // a bare bold run ("**Name**"), depending on the source entry's shape.
  const markers = [`### ${first}`, `- **${first}**`, `**${first}**`];
  const marker = markers
    .map((candidate) => description.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (marker === undefined) return description;
  return description.slice(0, marker).trim();
}

/** The chosen option for a given choice id, if the character has made it. */
export function selectedRuleChoice(
  character: Character,
  id: string
): RuleChoiceEntry | undefined {
  return (character.ruleChoices ?? []).find((entry) => entry.id === id);
}

/**
 * Names of traits a recorded choice has replaced, which must not appear on the
 * sheet at all. A replaced trait usually carries no choice of its own, so it
 * cannot discover its own replacement by looking inward.
 */
export function replacedTraitNames(character: Character, raceCatalog: RaceData[]): Set<string> {
  const suppressed = new Set<string>();
  for (const choice of ancestryRuleChoices(character, raceCatalog)) {
    if (!choice.replaces) continue;
    const entry = (character.ruleChoices ?? []).find((rc) => rc.id === choice.id);
    const picked = entry?.picked?.[0];
    // Skill Versatility survives only when it is what the player chose; picking
    // anything else means the variant replaced it.
    if (picked && picked !== choice.replaces) suppressed.add(choice.replaces);
  }
  return suppressed;
}

/**
 * Rule Choices a long rest lets the player change: the eladrin's Season is the
 * only one, per MToF ("when finishing a long rest, you can change your season").
 * Modelled as a curated trait name rather than inferred from prose.
 */
export const CHANGEABLE_AT_LONG_REST = new Set(["Fey Step"]);

/**
 * Clears the picks of choices that a long rest lets the player change, so they
 * are offered again. Other choices are untouched.
 */
export function clearChangeableChoices(character: Character): Character {
  const entries = character.ruleChoices;
  if (!entries?.length) return character;
  const kept = entries.filter((entry) => !CHANGEABLE_AT_LONG_REST.has(entry.trait));
  if (kept.length === entries.length) return character;
  return { ...character, ruleChoices: kept };
}

export const CIRCLE_OF_THE_LAND_BIOMES = [
  { name: "Arctic", description: "Hold Person, Spike Growth, Sleet Storm, Slow, Freedom of Movement, Ice Storm, Commune with Nature, Cone of Cold" },
  { name: "Coast", description: "Mirror Image, Misty Step, Water Breathing, Water Walk, Control Water, Freedom of Movement, Conjure Elemental, Scrying" },
  { name: "Desert", description: "Blur, Silence, Create Food and Water, Protection from Energy, Blight, Hallucinatory Terrain, Insect Plague, Wall of Stone" },
  { name: "Forest", description: "Barkskin, Spider Climb, Call Lightning, Plant Growth, Divination, Freedom of Movement, Commune with Nature, Tree Stride" },
  { name: "Grassland", description: "Invisibility, Pass without Trace, Daylight, Haste, Divination, Freedom of Movement, Dream, Insect Plague" },
  { name: "Mountain", description: "Spider Climb, Spike Growth, Lightning Bolt, Meld into Stone, Stone Shape, Stoneskin, Passwall, Wall of Stone" },
  { name: "Swamp", description: "Darkness, Melf's Acid Arrow, Water Walk, Stinking Cloud, Freedom of Movement, Locate Creature, Insect Plague, Scrying" },
  { name: "Underdark", description: "Spider Climb, Web, Gaseous Form, Stinking Cloud, Greater Invisibility, Stone Shape, Cloudkill, Insect Plague" },
];

export const DIVINE_SOUL_AFFINITIES = [
  { name: "Good", description: "Cure Wounds (Affinity spell)" },
  { name: "Evil", description: "Inflict Wounds (Affinity spell)" },
  { name: "Law", description: "Bless (Affinity spell)" },
  { name: "Chaos", description: "Bane (Affinity spell)" },
  { name: "Neutrality", description: "Protection from Evil and Good (Affinity spell)" },
];

export const GENIE_KINDS = [
  { name: "Dao", description: "Earth - Sanctuary, Spike Growth, Meld into Stone, Stone Shape, Wall of Stone" },
  { name: "Djinni", description: "Air - Thunderwave, Gust of Wind, Wind Wall, Greater Invisibility, Seeming" },
  { name: "Efreeti", description: "Fire - Burning Hands, Scorching Ray, Fireball, Fire Shield, Flame Strike" },
  { name: "Marid", description: "Water - Fog Cloud, Blur, Sleet Storm, Control Water, Cone of Cold" },
];

export const ELEMENTAL_DISCIPLINES_LVL3 = [
  { name: "Fangs of the Fire Snake", description: "Spend 1 Ki point to extend unarmed reach by 10 ft with fire damage; +1d10 fire per extra Ki spent." },
  { name: "Fist of Four Thunders", description: "Spend 2 Ki points to cast Thunderwave." },
  { name: "Fist of Unbroken Air", description: "Spend 2 Ki points to blast air: target makes Str save or takes 3d10 bludgeoning damage and pushed 20 ft." },
  { name: "Rush of the Gale Spirits", description: "Spend 2 Ki points to cast Gust of Wind." },
  { name: "Shape the Flowing River", description: "Spend 1 Ki point to shape ice and water within 120 ft." },
  { name: "Sweeping Cinder Strike", description: "Spend 2 Ki points to cast Burning Hands." },
  { name: "Water Whip", description: "Spend 2 Ki points to create a water whip: Dex save or 3d10 bludgeoning and knocked prone or pulled 25 ft." },
];

export const ELEMENTAL_DISCIPLINES_LVL6 = [
  { name: "Clench of the North Wind", description: "Spend 3 Ki points to cast Hold Person." },
  { name: "Gong of the Summit", description: "Spend 3 Ki points to cast Shatter." },
];

export const ELEMENTAL_DISCIPLINES_LVL11 = [
  { name: "Flames of the Phoenix", description: "Spend 4 Ki points to cast Fireball." },
  { name: "Mist Stance", description: "Spend 4 Ki points to cast Gaseous Form on yourself." },
  { name: "Ride the Wind", description: "Spend 4 Ki points to cast Fly on yourself." },
];

export const ELEMENTAL_DISCIPLINES_LVL17 = [
  { name: "Breath of Winter", description: "Spend 6 Ki points to cast Cone of Cold." },
  { name: "Eternal Mountain Defense", description: "Spend 5 Ki points to cast Stoneskin on yourself." },
  { name: "River of Hungry Flame", description: "Spend 5 Ki points to cast Wall of Fire." },
  { name: "Wave of Rolling Earth", description: "Spend 6 Ki points to cast Wall of Stone." },
];


/**
 * Returns all subclass rule choices defined by the character's active classes and subclasses.
 */
export function subclassRuleChoices(
  character: Character,
  activeBooks?: string[]
): AvailableRuleChoice[] {
  const out: AvailableRuleChoice[] = [];
  const classes = character.classes ?? [];

  for (const c of classes) {
    const subName = getSubclassName(c);
    const clsLower = c.className.toLowerCase();

    // 1. Druid with Circle of the Land (level >= 2)
    if (clsLower === "druid" && subName.includes("land") && c.level >= 2) {
      out.push({
        id: "PHB__Druid__Circle of the Land__Biome",
        traitName: "Circle of the Land: Biome",
        choose: 1,
        level: 2,
        effectLevel: 3,
        options: CIRCLE_OF_THE_LAND_BIOMES,
      });
    }

    // 2. Sorcerer with Divine Soul (level >= 1)
    if (
      clsLower === "sorcerer" &&
      (subName.includes("divine soul") || subName.includes("divinesoul")) &&
      c.level >= 1
    ) {
      out.push({
        id: "XGE__Sorcerer__Divine Soul__Affinity",
        traitName: "Divine Soul: Divine Affinity",
        choose: 1,
        level: 1,
        effectLevel: 1,
        options: DIVINE_SOUL_AFFINITIES,
      });
    }

    // 2b. Warlock with The Genie (level >= 1)
    if (clsLower === "warlock" && subName.includes("genie") && c.level >= 1) {
      out.push({
        id: "TCE__Warlock__The Genie__Kind",
        traitName: "The Genie: Genie Kind",
        choose: 1,
        level: 1,
        effectLevel: 1,
        options: GENIE_KINDS,
      });
    }

    // 3. Cleric Domains (level >= 1)
    if (clsLower === "cleric" && c.level >= 1) {
      // Nature Domain
      if (subName.includes("nature")) {
        const druidCantrips = getSpells(activeBooks).filter(
          (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "druid")
        );
        out.push({
          id: "PHB__Cleric__Nature Domain__Acolyte of Nature",
          traitName: "Acolyte of Nature Cantrip",
          choose: 1,
          level: 1,
          effectLevel: 1,
          options: formatCantripOptions(druidCantrips),
        });
      }

      // Death Domain
      if (subName.includes("death")) {
        const necroCantrips = getSpells(activeBooks).filter(
          (s) => s.level === 0 && s.school?.toLowerCase() === "necromancy"
        );
        out.push({
          id: "DMG__Cleric__Death Domain__Reaper",
          traitName: "Reaper Cantrip",
          choose: 1,
          level: 1,
          effectLevel: 1,
          options: formatCantripOptions(necroCantrips),
        });
      }

      // Arcana Domain
      if (subName.includes("arcana")) {
        const wizCantrips = getSpells(activeBooks).filter(
          (s) => s.level === 0 && s.classes?.some((cls) => cls.toLowerCase() === "wizard")
        );
        out.push({
          id: "SCAG__Cleric__Arcana Domain__Arcane Initiate",
          traitName: "Arcane Initiate Cantrips",
          choose: 2,
          level: 1,
          effectLevel: 1,
          options: formatCantripOptions(wizCantrips),
        });
      }
    }

    // 4. Monk with Way of the Four Elements (levels 3, 6, 11, 17)
    if (
      clsLower === "monk" &&
      (subName.includes("four elements") || subName.includes("elements"))
    ) {
      if (c.level >= 3) {
        out.push({
          id: "PHB__Monk__Way of the Four Elements__Discipline 3",
          traitName: "Elemental Discipline (3rd Level)",
          choose: 1,
          level: 3,
          effectLevel: 3,
          options: ELEMENTAL_DISCIPLINES_LVL3,
        });
      }
      if (c.level >= 6) {
        out.push({
          id: "PHB__Monk__Way of the Four Elements__Discipline 6",
          traitName: "Elemental Discipline (6th Level)",
          choose: 1,
          level: 6,
          effectLevel: 6,
          options: [...ELEMENTAL_DISCIPLINES_LVL3, ...ELEMENTAL_DISCIPLINES_LVL6],
        });
      }
      if (c.level >= 11) {
        out.push({
          id: "PHB__Monk__Way of the Four Elements__Discipline 11",
          traitName: "Elemental Discipline (11th Level)",
          choose: 1,
          level: 11,
          effectLevel: 11,
          options: [
            ...ELEMENTAL_DISCIPLINES_LVL3,
            ...ELEMENTAL_DISCIPLINES_LVL6,
            ...ELEMENTAL_DISCIPLINES_LVL11,
          ],
        });
      }
      if (c.level >= 17) {
        out.push({
          id: "PHB__Monk__Way of the Four Elements__Discipline 17",
          traitName: "Elemental Discipline (17th Level)",
          choose: 1,
          level: 17,
          effectLevel: 17,
          options: [
            ...ELEMENTAL_DISCIPLINES_LVL3,
            ...ELEMENTAL_DISCIPLINES_LVL6,
            ...ELEMENTAL_DISCIPLINES_LVL11,
            ...ELEMENTAL_DISCIPLINES_LVL17,
          ],
        });
      }
    }

    // 5. Barbarian Progression and Archetypes
    if (clsLower === "barbarian") {
      // 5a. Primal Knowledge (TCoE Optional Feature)
      const hasPrimalKnowledge = Boolean(
        character.optionalFeatureReplacements?.["Primal Knowledge"] ??
        (character as any).optionalFeatures?.["Primal Knowledge"]
      );
      if (hasPrimalKnowledge) {
        if (c.level >= 3) {
          const id = "TCE__Barbarian__Primal Knowledge 3";
          const unchosen = getUnchosenBarbarianSkills(character, id);
          out.push({
            id,
            traitName: "Primal Knowledge (3rd Level)",
            choose: 1,
            level: 3,
            effectLevel: 3,
            options: unchosen.map((s) => ({
              name: s,
              description: `Gain proficiency in ${s}`,
            })),
          });
        }
        if (c.level >= 10) {
          const id = "TCE__Barbarian__Primal Knowledge 10";
          const unchosen = getUnchosenBarbarianSkills(character, id);
          out.push({
            id,
            traitName: "Primal Knowledge (10th Level)",
            choose: 1,
            level: 10,
            effectLevel: 10,
            options: unchosen.map((s) => ({
              name: s,
              description: `Gain proficiency in ${s}`,
            })),
          });
        }
      }

      // 5b. Path of the Giant (level >= 3)
      if (subName.includes("giant") && c.level >= 3) {
        out.push({
          id: "BGG__Barbarian__Path of the Giant__Giant Power",
          traitName: "Giant Power Cantrip",
          choose: 1,
          level: 3,
          effectLevel: 3,
          options: [
            {
              name: "Druidcraft",
              description: "Whisper with spirits of nature to create minor botanical effects, sensory phenomena, or predict weather.",
            },
            {
              name: "Thaumaturgy",
              description: "Manifest minor wonders and supernatural phenomena, booming voice, flickering flames, or trembling ground.",
            },
          ],
        });
      }

      // 5c. Path of the Totem Warrior (levels 3, 6, 14)
      if (subName.includes("totem") || subName.includes("totem warrior")) {
        const scagActive = !activeBooks || activeBooks.some((b) => b.toUpperCase() === "SCAG");

        const totemSpiritOptions = [
          { name: "Bear", description: "While raging, you have resistance to all damage except psychic damage." },
          { name: "Eagle", description: "While raging and not wearing heavy armor, opportunity attacks against you have disadvantage and you can Dash as a bonus action." },
          { name: "Wolf", description: "While raging, your friends have advantage on melee attack rolls against any hostile creature within 5 ft of you." },
          ...(scagActive
            ? [
                { name: "Elk", description: "While raging and not wearing heavy armor, your walking speed increases by 15 feet." },
                { name: "Tiger", description: "While raging, you can add 10 feet to your long jump distance and 3 feet to your high jump distance." },
              ]
            : []),
        ];

        const aspectBeastOptions = [
          { name: "Bear", description: "Your carrying capacity (including maximum load and lift) is doubled, and you have advantage on Strength checks to push, pull, lift, or break objects." },
          { name: "Eagle", description: "You can see up to 1 mile away with no difficulty, and dim light doesn't impose disadvantage on your Wisdom (Perception) checks." },
          { name: "Wolf", description: "You can track other creatures while traveling at a fast pace, and you can move stealthily while traveling at a normal pace." },
          ...(scagActive
            ? [
                { name: "Elk", description: "Whether mounted or on foot, your travel pace is doubled, as is the travel pace of up to ten companions within 60 ft." },
                { name: "Tiger", description: "You gain proficiency in two skills from: Athletics, Acrobatics, Stealth, and Survival." },
              ]
            : []),
        ];

        const totemicAttunementOptions = [
          { name: "Bear", description: "While raging, hostile creatures within 5 feet have disadvantage on attack rolls against targets other than you." },
          { name: "Eagle", description: "While raging, you have a flying speed equal to your current walking speed in short bursts." },
          { name: "Wolf", description: "While raging, you can use a bonus action to knock a Large or smaller creature prone when you hit it with a melee weapon attack." },
          ...(scagActive
            ? [
                { name: "Elk", description: "While raging, bonus action during move to pass through a Large or smaller creature, dealing 1d12 + Str bludgeoning and knocking prone (Str save)." },
                { name: "Tiger", description: "While raging, move 20 ft straight toward Large or smaller target before melee attack to use bonus action for extra melee weapon attack." },
              ]
            : []),
        ];

        if (c.level >= 3) {
          out.push({
            id: "PHB__Barbarian__Path of the Totem Warrior__Totem Spirit 3",
            traitName: "Totem Spirit (3rd Level)",
            choose: 1,
            level: 3,
            effectLevel: 3,
            options: totemSpiritOptions,
          });
        }
        if (c.level >= 6) {
          out.push({
            id: "PHB__Barbarian__Path of the Totem Warrior__Aspect of the Beast 6",
            traitName: "Aspect of the Beast (6th Level)",
            choose: 1,
            level: 6,
            effectLevel: 6,
            options: aspectBeastOptions,
          });
        }
        if (c.level >= 14) {
          out.push({
            id: "PHB__Barbarian__Path of the Totem Warrior__Totemic Attunement 14",
            traitName: "Totemic Attunement (14th Level)",
            choose: 1,
            level: 14,
            effectLevel: 14,
            options: totemicAttunementOptions,
          });
        }
      }
    }
  }

  out.push(...fightingStyleRuleChoices(character, activeBooks).filter((c) => !c.id.includes("Feat")));
  out.push(...battleMasterManeuverChoices(character, activeBooks).filter((c) => !c.id.includes("Feat")));
  out.push(...warlockPactBoonChoices(character, activeBooks));
  out.push(...warlockTomeCantripChoices(character, activeBooks));
  out.push(...warlockAncientSecretsStartingRituals(character, activeBooks));
  out.push(...warlockMysticArcanumChoices(character, activeBooks));
  out.push(...warlockInvocationChoices(character, activeBooks).filter((c) => !c.id.includes("Feat")));
  out.push(...artificerInfusionChoices(character, activeBooks));

  return out;
}



/**
 * Returns subclass rule choices filtered by active books.
 */
export function availableSubclassRuleChoices(
  character: Character,
  activeBooks?: string[]
): AvailableRuleChoice[] {
  const choices = subclassRuleChoices(character, activeBooks);
  if (!activeBooks || activeBooks.length === 0) return choices;

  const books = new Set(activeBooks.map((b) => b.toUpperCase()));
  const allKnownBooks = new Set(ALL_RESOURCE_BOOKS.map((b) => b.code.toUpperCase()));

  return choices.filter((choice) => {
    const source = choice.id.split("__")[0]?.toUpperCase();
    if (!source || !allKnownBooks.has(source)) return true;
    return books.has(source);
  });
}


/**
 * Records or updates a subclass rule choice pick for a character.
 */
export function pickSubclassRuleChoice(
  character: Character,
  choice: AvailableRuleChoice,
  option: string
): Character {
  if (
    choice.id.includes("Fighting Style") ||
    choice.id.includes("Fighting Initiate") ||
    choice.id.includes("Blessed Warrior") ||
    choice.id.includes("Druidic Warrior")
  ) {
    return pickFightingStyleChoice(character, choice, option);
  }

  const pickClassChoice = () =>
    setRuleChoicePick(
      character,
      choice.id,
      choice.traitName,
      option,
      choice.options.map((o) => o.name),
      choice.choose,
      "class"
    );

  if (choice.id.includes("Pact Boon")) {
    return pruneInvalidInvocations(pickClassChoice());
  }

  if (choice.id === "Warlock__Pact of the Tome__Cantrips" || choice.id.includes("Pact of the Tome")) {
    return syncWarlockTomeCantrips(pickClassChoice());
  }

  if (
    choice.id === "Warlock__Book of Ancient Secrets__Starting Rituals" ||
    (choice.id.includes("Book of Ancient Secrets") && choice.id.includes("Rituals"))
  ) {
    return syncAncientSecretsRituals(pickClassChoice());
  }

  if (isMysticArcanumChoiceId(choice.id)) {
    return pruneInvalidMysticArcanum(pickClassChoice());
  }

  if (isInvocationChoiceId(choice.id)) {
    return pruneInvalidInvocations(pickClassChoice());
  }

  if (isInfusionChoiceId(choice.id)) {
    return pickInfusionChoice(character, choice, option);
  }

  const isManeuver = isManeuverChoiceId(choice.id);
  const origin = isManeuver && (choice.id.includes("Feat") || choice.id.includes("Superior Technique"))
    ? "class"
    : "subclass";

  let updated = setRuleChoicePick(
    character,
    choice.id,
    choice.traitName,
    option,
    choice.options.map((o) => o.name),
    choice.choose,
    origin
  );

  // If this is Path of the Giant cantrip choice, synchronize knownSpells
  if (choice.id.includes("Giant Power") || choice.traitName.includes("Giant Power")) {
    const giantRc = updated.ruleChoices?.find(
      (rc) => rc.id === choice.id || rc.trait === choice.traitName
    );
    const pickedCantrip = giantRc?.picked?.[0];
    const prevKnown = (updated.knownSpells || []).filter(
      (k) => !(k.ownerKey === "Barbarian__BGG" && ["druidcraft", "thaumaturgy"].includes(k.name.toLowerCase()))
    );
    if (pickedCantrip) {
      updated = {
        ...updated,
        knownSpells: [
          ...prevKnown,
          {
            name: pickedCantrip,
            source: "PHB",
            ownerKey: "Barbarian__BGG",
            ability: "wis",
            className: "Barbarian",
          },
        ],
      };
    } else {
      updated = {
        ...updated,
        knownSpells: prevKnown,
      };
    }
  }

  return updated;
}

/** @deprecated Use pickSubclassRuleChoice */
export const toggleSubclassRuleChoice = pickSubclassRuleChoice;

